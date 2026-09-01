/**
 * corpus-check.ts — 真实语料验证：在知名开源仓库的最近 N 个非 merge 提交上跑
 * 「投影 + 简化」管线，统计折叠情况并检测可疑折叠。
 *
 * 可疑折叠：被折叠的 del/add 行对，其原文差异片段（去掉公共前后缀后的中间部分）
 * 切词后含有白名单（常见类型与工程关键字）之外的词 —— 提示简化规则可能抹掉了真实逻辑。
 *
 * 用法：bun run scripts/corpus-check.ts [--commits <n>]（默认 25）
 * 语料缓存在 .corpus/<name>/（已存在则原样复用），报告写入 .corpus/report.md。
 */

import { $ } from "bun";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import parseDiff from "parse-diff";
import { profileForPath } from "../src/analysis/langs";
import { changedLinesOf, type ParsedFile } from "../src/analysis/map";
import { analyzeFile } from "../src/analysis/project";
import { buildSimplifiedRows, simplifySource, type SRow } from "../src/analysis/simplify";

/* ---- 配置 ---- */

const REPOS = [
  { name: "zod", url: "https://github.com/colinhacks/zod" },
  { name: "serde", url: "https://github.com/serde-rs/serde" },
  { name: "pydantic", url: "https://github.com/pydantic/pydantic" },
];

const DEFAULT_COMMITS = 25;
/** clone 深度余量：merge 提交也占用深度（log --no-merges 会跳过），多留几个 */
const CLONE_DEPTH_SLACK = 10;
/** 任一侧超过该字节数的文件跳过（与 server.ts 的降级阈值一致） */
const MAX_FILE_BYTES = 500_000;
const CORPUS_DIR = ".corpus";
const REPORT_PATH = `${CORPUS_DIR}/report.md`;
/** 报告中列出的可疑折叠对上限 */
const TOP_SUSPICIOUS = 40;
/** 报告中随机抽取的非可疑折叠对数量（对照抽查用） */
const CONTROL_SAMPLE_SIZE = 10;

/** 差异片段词白名单：常见类型与工程关键字（只含这些词的差异不视为可疑） */
const WHITELIST = new Set(
  `number string boolean unknown any never void undefined null true false
   pub fn let mut const static struct enum impl trait type interface extends implements
   as keyof readonly crate self super use mod where dyn async await return
   u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64 bool str
   String Vec Option Result Box HashMap BTreeMap Iterator Debug Clone Copy Default
   PartialEq Eq Hash Ord PartialOrd Send Sync From Into TryFrom TryInto Display Error
   ToString AsRef AsMut Deref Drop Fn FnMut FnOnce Sized Unpin
   self cls None True False def elif in is not and or with try except finally raise pass
   lambda yield global nonlocal assert int float bool list dict set tuple bytes object
   Exception print len range enumerate zip isinstance super staticmethod classmethod property`.split(/\s+/),
);

/** 差异片段切词：标识符与数字 */
const TOKEN_RE = /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?/g;

/* ---- 数据结构 ---- */

interface RepoStats {
  /** 实际处理的提交数 */
  commits: number;
  /** 命中 profile 且通过大小过滤、实际进入分析的文件数 */
  files: number;
  parseErrors: number;
  simplifyErrors: number;
  tooLarge: number;
  /** 被折叠为「类型性变更」的行数 */
  folded: number;
  /** 简化视图中仍可见的行数 */
  visible: number;
  /** 可疑折叠对数 */
  suspicious: number;
}

interface FoldPairSample {
  repo: string;
  /** 提交 sha 前 8 位 */
  sha: string;
  path: string;
  oldSeg: string;
  newSeg: string;
  oldLine: string;
  newLine: string;
  /** 差异片段中命中白名单的词数（用于排序，越少越靠前） */
  whitelistHits: number;
  /** 不在白名单中的词（去重） */
  badTokens: string[];
}

function newStats(): RepoStats {
  return {
    commits: 0,
    files: 0,
    parseErrors: 0,
    simplifyErrors: 0,
    tooLarge: 0,
    folded: 0,
    visible: 0,
    suspicious: 0,
  };
}

/* ---- 参数 ---- */

function parseArgs(): number {
  const args = process.argv.slice(2);
  let commits = DEFAULT_COMMITS;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const inline = arg.startsWith("--commits=") ? arg.slice("--commits=".length) : null;
    if (arg === "--commits" || inline != null) {
      const raw = inline ?? args[++i];
      const n = raw == null ? NaN : Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`--commits 需要正整数，收到：${raw ?? "(缺失)"}`);
        process.exit(1);
      }
      commits = n;
    } else {
      console.error(`未知参数：${arg}\n用法：bun run scripts/corpus-check.ts [--commits <n>]`);
      process.exit(1);
    }
  }
  return commits;
}

/* ---- git 操作 ---- */

interface SourceSide {
  text: string;
  bytes: number;
}

/** 取某 revision 下的文件全文；失败/不存在返回 null（对应文件新增/删除，或浅克隆边界） */
async function gitShowSource(dir: string, rev: string, path: string): Promise<SourceSide | null> {
  const r = await $`git -C ${dir} show ${`${rev}:${path}`}`.quiet().nothrow();
  if (r.exitCode !== 0) return null;
  return { text: r.stdout.toString("utf8"), bytes: r.stdout.length };
}

/** 克隆语料仓库；已存在则原样复用，失败打印原因并以退出码 1 结束 */
async function ensureClone(repo: { name: string; url: string }, dir: string, commits: number) {
  if (existsSync(`${dir}/.git`)) {
    console.log(`[${repo.name}] ${dir} 已存在，原样复用`);
    return;
  }
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true }); // 上次失败留下的残留
  mkdirSync(CORPUS_DIR, { recursive: true });
  const depth = commits + CLONE_DEPTH_SLACK;
  console.log(`[${repo.name}] git clone --depth ${depth} --filter=blob:none ${repo.url}`);
  let r = await $`git clone --depth ${depth} --filter=blob:none ${repo.url} ${dir}`
    .quiet()
    .nothrow();
  if (r.exitCode !== 0) {
    // 旧版 git 不支持 --filter，退回普通浅克隆
    console.warn(
      `[${repo.name}] --filter=blob:none 克隆失败（${r.stderr.toString("utf8").trim()}），退回普通浅克隆重试`,
    );
    rmSync(dir, { recursive: true, force: true });
    r = await $`git clone --depth ${depth} ${repo.url} ${dir}`.quiet().nothrow();
  }
  if (r.exitCode !== 0) {
    console.error(`[${repo.name}] 克隆失败：${r.stderr.toString("utf8").trim() || "(无错误输出)"}`);
    console.error("请检查网络连通性与仓库地址后重试。");
    process.exit(1);
  }
}

/** 最近 N 个非 merge 提交（新→旧） */
async function listCommits(repo: { name: string }, dir: string, commits: number): Promise<string[]> {
  const r = await $`git -C ${dir} log --no-merges -n ${commits} --format=%H`.quiet().nothrow();
  if (r.exitCode !== 0) {
    console.error(`[${repo.name}] 读取提交历史失败：${r.stderr.toString("utf8").trim()}`);
    process.exit(1);
  }
  const shas = r.stdout.toString("utf8").trim().split("\n").filter(Boolean);
  if (shas.length < commits) {
    console.warn(
      `[${repo.name}] 实际可用提交 ${shas.length} 个，少于请求的 ${commits} 个（语料可能来自更早的小深度克隆）`,
    );
  }
  return shas;
}

/* ---- 可疑折叠检测 ---- */

/** 取两行的公共前缀与公共后缀，中间不同部分即「被抹掉的差异」 */
function diffSegments(a: string, b: string): [string, string] {
  let start = 0;
  const min = Math.min(a.length, b.length);
  while (start < min && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  return [a.slice(start, endA), b.slice(start, endB)];
}

function tokensOf(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

/** 遍历 fold 行，按下标配对（两侧都存在的行对），检测可疑折叠 */
function inspectFolds(
  repo: string,
  sha8: string,
  path: string,
  rows: SRow[],
  stats: RepoStats,
  suspiciousAll: FoldPairSample[],
  controlAll: FoldPairSample[],
): void {
  for (const row of rows) {
    if (row.kind !== "fold") continue;
    const n = Math.min(row.oldLines.length, row.newLines.length);
    for (let i = 0; i < n; i++) {
      const oldLine = row.oldLines[i]!;
      const newLine = row.newLines[i]!;
      if (oldLine === newLine) continue;
      const [oldSeg, newSeg] = diffSegments(oldLine, newLine);
      const tokens = [...tokensOf(oldSeg), ...tokensOf(newSeg)];
      if (tokens.length === 0) continue; // 纯空白差异
      const bad = tokens.filter((t) => !WHITELIST.has(t));
      const sample: FoldPairSample = {
        repo,
        sha: sha8,
        path,
        oldSeg,
        newSeg,
        oldLine,
        newLine,
        whitelistHits: tokens.length - bad.length,
        badTokens: [...new Set(bad)],
      };
      if (bad.length > 0) {
        stats.suspicious++;
        suspiciousAll.push(sample);
      } else {
        controlAll.push(sample);
      }
    }
  }
}

/* ---- 主流程 ---- */

async function processRepo(
  repo: { name: string; url: string },
  commits: number,
  suspiciousAll: FoldPairSample[],
  controlAll: FoldPairSample[],
): Promise<RepoStats> {
  const stats = newStats();
  const dir = `${CORPUS_DIR}/${repo.name}`;
  await ensureClone(repo, dir, commits);
  const shas = await listCommits(repo, dir, commits);

  for (const [idx, sha] of shas.entries()) {
    const sha8 = sha.slice(0, 8);
    const diffOut = await $`git -C ${dir} show --format= --no-color --no-ext-diff --no-textconv ${sha}`
      .quiet()
      .nothrow();
    if (diffOut.exitCode !== 0) {
      console.warn(`[${repo.name}] ${sha8} diff 获取失败（可能触及浅克隆边界），跳过`);
      continue;
    }
    stats.commits++;

    let files: ParsedFile[];
    try {
      files = parseDiff(diffOut.stdout.toString("utf8")) as unknown as ParsedFile[];
    } catch (e) {
      console.warn(`[${repo.name}] ${sha8} diff 解析失败：${e instanceof Error ? e.message : e}`);
      continue;
    }

    for (const file of files) {
      const oldPath = file.from && file.from !== "/dev/null" ? file.from : null;
      const newPath = file.to && file.to !== "/dev/null" ? file.to : null;
      const path = newPath ?? oldPath;
      if (!path) continue;
      const profile = profileForPath(path);
      if (!profile) continue;

      const { oldLines, newLines } = changedLinesOf(file);
      if (oldLines.size === 0 && newLines.size === 0) continue; // 无文本变更行（如二进制）

      const oldSrc = oldPath ? await gitShowSource(dir, `${sha}^`, oldPath) : null;
      const newSrc = newPath ? await gitShowSource(dir, sha, newPath) : null;
      if (!oldSrc && !newSrc) continue;
      if ((oldSrc?.bytes ?? 0) > MAX_FILE_BYTES || (newSrc?.bytes ?? 0) > MAX_FILE_BYTES) {
        stats.tooLarge++;
        continue;
      }
      stats.files++;

      const oldText = oldSrc?.text ?? null;
      const newText = newSrc?.text ?? null;

      try {
        await analyzeFile(profile, oldText, newText, oldLines, newLines);
      } catch {
        stats.parseErrors++;
      }

      const simplify = profile.simplify;
      if (simplify) {
        try {
          const sp = { grammarFile: profile.grammarFile, simplify };
          const oldS = oldText != null ? await simplifySource(sp, oldText) : null;
          const newS = newText != null ? await simplifySource(sp, newText) : null;
          const view = buildSimplifiedRows(file, oldS, newS);
          stats.folded += view.stats.folded;
          stats.visible += view.stats.visible;
          inspectFolds(repo.name, sha8, path, view.rows, stats, suspiciousAll, controlAll);
        } catch {
          stats.simplifyErrors++;
        }
      }
    }
    console.log(
      `[${repo.name}] ${idx + 1}/${shas.length} ${sha8} files=${stats.files} folded=${stats.folded} visible=${stats.visible} suspicious=${stats.suspicious}`,
    );
  }
  return stats;
}

/* ---- 输出 ---- */

function foldRate(s: RepoStats): string {
  const denom = s.folded + s.visible;
  return denom === 0 ? "—" : `${((s.folded / denom) * 100).toFixed(1)}%`;
}

const TABLE_HEADER = [
  "repo",
  "commits",
  "files",
  "parse-err",
  "simplify-err",
  "too-large",
  "folded",
  "visible",
  "fold%",
  "suspicious",
];

function renderRows(rows: Array<[string, RepoStats]>): string[][] {
  const body = rows.map(([name, s]) => [
    name,
    String(s.commits),
    String(s.files),
    String(s.parseErrors),
    String(s.simplifyErrors),
    String(s.tooLarge),
    String(s.folded),
    String(s.visible),
    foldRate(s),
    String(s.suspicious),
  ]);
  return [TABLE_HEADER, ...body];
}

function printTable(t: string[][]): void {
  const widths = t[0]!.map((_, c) => Math.max(...t.map((r) => r[c]!.length)));
  for (const r of t) {
    console.log(
      r
        .map((cell, c) => cell.padEnd(widths[c]!))
        .join("  ")
        .trimEnd(),
    );
  }
}

function mdTable(t: string[][]): string {
  const [header, ...body] = t;
  return [
    `| ${header!.join(" | ")} |`,
    `| ${header!.map(() => "---").join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

/** 行内代码：内容含反引号时用双反引号包裹 */
function inlineCode(s: string): string {
  return s.includes("`") ? `\`\` ${s} \`\`` : `\`${s}\``;
}

/** 随机抽 n 条（部分 Fisher–Yates） */
function sampleRandom<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, k);
}

function pushSampleBlock(lines: string[], s: FoldPairSample, withBadTokens: boolean): void {
  if (withBadTokens) {
    lines.push(`- 可疑词：${s.badTokens.map(inlineCode).join(" ")}（白名单命中 ${s.whitelistHits} 个词）`);
  }
  lines.push(`- 差异片段：${inlineCode(s.oldSeg)} → ${inlineCode(s.newSeg)}`);
  lines.push("");
  lines.push("````text");
  lines.push(`- ${s.oldLine}`);
  lines.push(`+ ${s.newLine}`);
  lines.push("````");
  lines.push("");
}

function buildReport(
  commitsRequested: number,
  rows: Array<[string, RepoStats]>,
  suspiciousAll: FoldPairSample[],
  controlAll: FoldPairSample[],
): string {
  const lines: string[] = [];
  lines.push("# renview 语料验证报告");
  lines.push("");
  lines.push(`- 运行日期：${new Date().toISOString()}`);
  lines.push(`- 参数：--commits ${commitsRequested}`);
  lines.push(`- 语料仓库：${REPOS.map((r) => `${r.name}（${r.url}）`).join("、")}`);
  lines.push("");
  lines.push("## 统计");
  lines.push("");
  lines.push(mdTable(renderRows(rows)));
  lines.push("");
  lines.push("- folded：被折叠为「类型性变更」的行数；visible：简化视图中仍可见的行数");
  lines.push("- 折叠率 = folded / (folded + visible)");
  lines.push(`- 可疑折叠对共 ${suspiciousAll.length} 条`);
  lines.push("");

  if (suspiciousAll.length === 0) {
    lines.push("## 可疑折叠");
    lines.push("");
    lines.push("**未发现可疑折叠。**");
    lines.push("");
  } else {
    const sorted = [...suspiciousAll].sort((a, b) => a.whitelistHits - b.whitelistHits);
    const top = sorted.slice(0, TOP_SUSPICIOUS);
    lines.push(`## 可疑折叠（前 ${top.length} 条，按白名单命中数升序）`);
    lines.push("");
    top.forEach((s, i) => {
      lines.push(`### ${i + 1}. ${s.repo} @ \`${s.sha}\` — \`${s.path}\``);
      lines.push("");
      pushSampleBlock(lines, s, true);
    });
  }

  const controls = sampleRandom(controlAll, CONTROL_SAMPLE_SIZE);
  lines.push(`## 对照：随机 ${controls.length} 条非可疑折叠对`);
  lines.push("");
  if (controls.length === 0) {
    lines.push("（无非可疑折叠对）");
    lines.push("");
  }
  controls.forEach((s, i) => {
    lines.push(`### 对照 ${i + 1}. ${s.repo} @ \`${s.sha}\` — \`${s.path}\``);
    lines.push("");
    pushSampleBlock(lines, s, false);
  });

  return lines.join("\n");
}

/* ---- 入口 ---- */

const commits = parseArgs();
console.log(`语料验证：${REPOS.map((r) => r.name).join("、")} 各取最近 ${commits} 个非 merge 提交`);

const suspiciousAll: FoldPairSample[] = [];
const controlAll: FoldPairSample[] = [];
const statRows: Array<[string, RepoStats]> = [];
const total = newStats();
for (const repo of REPOS) {
  const s = await processRepo(repo, commits, suspiciousAll, controlAll);
  statRows.push([repo.name, s]);
  for (const k of Object.keys(total) as Array<keyof RepoStats>) total[k] += s[k];
}
statRows.push(["total", total]);

console.log("\n=== 统计 ===");
printTable(renderRows(statRows));

mkdirSync(CORPUS_DIR, { recursive: true });
writeFileSync(REPORT_PATH, buildReport(commits, statRows, suspiciousAll, controlAll));
console.log(`\n报告已写入 ${REPORT_PATH}（可疑折叠对 ${suspiciousAll.length} 条）`);
