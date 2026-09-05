/**
 * www 演示数据生成：samples/demo 变更集 → 真实管线（scripts/samples.ts，与 server 同构）
 * + shiki 双主题预算 → www/src/lib/demo-data.gen.ts。
 *
 * 生成物提交入库：www 独立部署只构建 www/ 目录，构建期无法访问仓库根部的 samples/；
 * 新鲜度由 test/samples.test.ts 的重生成比对锁定，漂移即测试失败（替代 CI 校验）。
 *
 * 用法：bun run gen:demo
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import langGo from "shiki/langs/go.mjs";
import langRust from "shiki/langs/rust.mjs";
import langTs from "shiki/langs/typescript.mjs";
import themeDark from "shiki/themes/github-dark-default.mjs";
import themeLight from "shiki/themes/github-light-default.mjs";
import { analyzeEntry, loadChangeset, type AnalyzedEntry } from "./samples";
import { decorateLine, type LineDecor } from "../web/src/lineDecor";
import { wordDiffRanges } from "../web/src/worddiff";
import { shikiLangForPath } from "../web/src/langForPath";
import { zhCN } from "../web/src/locales/zh-CN";
import { en } from "../web/src/locales/en";
import type { Strings } from "../web/src/i18n";
import type { Locale } from "../src/i18n";
import type { ChangeKind, ChangeUnit } from "../src/analysis/types";
import type { HToken } from "../web/src/highlight";

const CHANGESET_DIR = "samples/demo";
const OUT_FILE = "www/src/lib/demo-data.gen.ts";

/* ---- 生成物的数据形状（与 www/src/lib/demo-data.gen.ts 头中的类型声明保持一致） ---- */

interface DemoSeg {
  /** 文本 */
  t: string;
  /** 深色/浅色主题色（css var 方式下发，lc 与 dc 相同时省略） */
  dc?: string;
  lc?: string;
  /** 词级差异高亮：a 新增侧 / d 删除侧 */
  hl?: "a" | "d";
  /** 擦除标记：hover 还原的原文片段 */
  e?: string;
  /** 擦除形态：替换段 / 锚定删除点 / 零宽 tick */
  em?: "repl" | "adj" | "mark";
  /** 零宽 tick 的间隙居中偏移（ch），仅 mark */
  mo?: number;
}

interface DemoRowLine {
  k: "ctx" | "del" | "add";
  o?: number;
  n?: number;
  segs: DemoSeg[];
}

interface DemoFoldLine {
  ln: number;
  segs: DemoSeg[];
}

interface DemoRowFold {
  k: "fold";
  count: number;
  summary: string;
  olds: DemoFoldLine[];
  news: DemoFoldLine[];
}

type DemoRow = DemoRowLine | DemoRowFold;

interface DemoBadge {
  kind: string;
  label: string;
  count: number;
}

interface DemoUnit {
  name: string;
  glyph: string;
  tag: string;
  tagKind: string;
  membersAdded: string[];
  membersRemoved: string[];
}

interface DemoFile {
  path: string;
  additions: number;
  deletions: number;
  badges: DemoBadge[];
  units: DemoUnit[];
  simplified: DemoRow[];
  raw: DemoRowLine[];
}

interface DemoChangeset {
  featured: string;
  files: DemoFile[];
}

/* ---- shiki 预算（与产品同为 github-dark-default / github-light-default 双主题） ---- */

const DARK = "github-dark-default";
const LIGHT = "github-light-default";

const highlighter = await createHighlighterCore({
  themes: [themeDark, themeLight],
  langs: [langRust, langGo, langTs],
  engine: createJavaScriptRegexEngine(),
});

function highlightLines(text: string, lang: string, theme: string): HToken[][] {
  return (
    highlighter
      // 离线生成必须完整分词；默认 500ms 超时会让冷启动或慢机器产出不同的高亮。
      .codeToTokens(text, { lang: lang as never, theme, tokenizeTimeLimit: 0 })
      .tokens.map((line) =>
        line.map((t) => ({ content: t.content, color: t.color, fontStyle: t.fontStyle })),
      )
  );
}

interface ThemedLines {
  dark: HToken[][];
  light: HToken[][];
}

/** 一个样例文件的高亮缓存：简化/原始 × 旧/新两侧，按行号（1-based）索引 */
interface FileTokens {
  simpOld: ThemedLines | null;
  simpNew: ThemedLines | null;
  rawOld: ThemedLines | null;
  rawNew: ThemedLines | null;
}

function buildTokens(a: AnalyzedEntry): FileTokens {
  const lang = shikiLangForPath(a.entry.path);
  const themed = (lines: string[] | null): ThemedLines | null =>
    lines && lang
      ? {
          dark: highlightLines(lines.join("\n"), lang, DARK),
          light: highlightLines(lines.join("\n"), lang, LIGHT),
        }
      : null;
  return {
    simpOld: themed(a.oldSimplified?.lines ?? null),
    simpNew: themed(a.newSimplified?.lines ?? null),
    rawOld: themed(a.oldSrc?.replace(/\n$/, "").split("\n") ?? null),
    rawNew: themed(a.newSrc?.replace(/\n$/, "").split("\n") ?? null),
  };
}

function lineAt(
  t: ThemedLines | null,
  ln: number | undefined,
): { dark: HToken[] | null; light: HToken[] | null } {
  return {
    dark: t && ln != null ? (t.dark[ln - 1] ?? null) : null,
    light: t && ln != null ? (t.light[ln - 1] ?? null) : null,
  };
}

/** 一行文本 → 演示段：行装饰几何（擦除锚定/词级差异）与产品共用 decorateLine，双主题各跑一次后按位合并 */
function toDemoSegs(
  text: string,
  toks: { dark: HToken[] | null; light: HToken[] | null },
  decor?: LineDecor,
): DemoSeg[] {
  const segs = decorateLine(text, toks.dark, decor);
  const segsLight = decorateLine(text, toks.light, decor);
  return segs.map((seg, i) => {
    const out: DemoSeg = { t: seg.text };
    if (seg.color) {
      out.dc = seg.color;
      const lc = segsLight[i]?.color;
      if (lc && lc !== seg.color) out.lc = lc;
    }
    if (seg.hl) out.hl = seg.hl === "wadd" ? "a" : "d";
    if (seg.erasure) {
      out.e = seg.erasure.original;
      out.em = seg.erasure.kind;
      if (seg.erasure.offsetCh) out.mo = seg.erasure.offsetCh;
    }
    return out;
  });
}

/* ---- 徽章 / 单元（标签文案取产品 web locales，与线上界面一致） ---- */

const BADGE_ORDER: ChangeKind[] = ["signature", "type-only", "body", "added", "removed"];

function demoBadges(a: AnalyzedEntry, s: Strings): DemoBadge[] {
  return BADGE_ORDER.filter((k) => (a.projection.summary[k] ?? 0) > 0).map((k) => ({
    kind: k,
    label: s.summaryChips[k],
    count: a.projection.summary[k]!,
  }));
}

/** 与 web/src/icons.tsx 的 KIND_GLYPH 保持一致 */
const KIND_GLYPH: Record<ChangeUnit["kind"], string> = {
  function: "ƒ",
  class: "C",
  type: "T",
  variable: "x",
  other: "•",
};

function demoUnits(units: ChangeUnit[], s: Strings): DemoUnit[] {
  return units.map((u) => {
    const shape = u.domain != null && (u.change === "type-only" || u.change === "body");
    return {
      name: u.name,
      glyph: KIND_GLYPH[u.kind] ?? "•",
      tag: shape ? s.domainShape : s.summaryChips[u.change],
      tagKind: shape ? "shape" : u.change,
      membersAdded: u.domain?.added ?? [],
      membersRemoved: u.domain?.removed ?? [],
    };
  });
}

/* ---- 行 ---- */

function simplifiedRows(a: AnalyzedEntry, tk: FileTokens, s: Strings): DemoRow[] {
  const rows = a.simplified?.rows ?? [];
  // 词级差异：同 pair 的 del/add 行求词差（与 SimplifiedView 同规则）
  const pairOf = new Map<number, { del?: number; add?: number }>();
  rows.forEach((r, i) => {
    if ((r.kind === "del" || r.kind === "add") && r.pair != null) {
      const p = pairOf.get(r.pair) ?? {};
      p[r.kind] = i;
      pairOf.set(r.pair, p);
    }
  });
  const wordHl = new Map<number, LineDecor>();
  for (const p of pairOf.values()) {
    if (p.del == null || p.add == null) continue;
    const d = rows[p.del]!;
    const ad = rows[p.add]!;
    if (d.kind !== "del" || ad.kind !== "add") continue;
    const wd = wordDiffRanges(d.text, ad.text);
    if (!wd) continue;
    wordHl.set(p.del, { hl: wd.a, hlClass: "wdel" });
    wordHl.set(p.add, { hl: wd.b, hlClass: "wadd" });
  }

  const out: DemoRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.kind === "note") continue; // 实现摘要注释行已撤回（见 .agents/archived.md），防御性跳过
    if (r.kind === "fold") {
      out.push({
        k: "fold",
        count: r.count,
        summary: r.summary ?? s.foldedTypeFormat(r.count),
        olds: r.oldLines.map((text, j) => ({
          ln: r.oldLns?.[j] ?? 0,
          segs: toDemoSegs(text, lineAt(tk.rawOld, r.oldLns?.[j])),
        })),
        news: r.newLines.map((text, j) => ({
          ln: r.newLns?.[j] ?? 0,
          segs: toDemoSegs(text, lineAt(tk.rawNew, r.newLns?.[j])),
        })),
      });
      continue;
    }
    const useOld = r.kind === "del" || (r.kind === "ctx" && r.newLn == null);
    const toks = lineAt(useOld ? tk.simpOld : tk.simpNew, useOld ? r.oldLn : r.newLn);
    out.push({
      k: r.kind,
      o: r.oldLn,
      n: r.newLn,
      segs: toDemoSegs(r.text, toks, { erases: r.erases, ...wordHl.get(i) }),
    });
  }
  return out;
}

function rawRows(a: AnalyzedEntry, tk: FileTokens): DemoRowLine[] {
  const out: DemoRowLine[] = [];
  for (const chunk of a.diffFile.chunks) {
    for (const c of chunk.changes) {
      const text = c.content.slice(1);
      if (c.type === "normal") {
        out.push({
          k: "ctx",
          o: c.ln1,
          n: c.ln2,
          segs: toDemoSegs(text, lineAt(tk.rawNew, c.ln2)),
        });
      } else if (c.type === "del") {
        out.push({ k: "del", o: c.ln, segs: toDemoSegs(text, lineAt(tk.rawOld, c.ln)) });
      } else if (c.type === "add") {
        out.push({ k: "add", n: c.ln, segs: toDemoSegs(text, lineAt(tk.rawNew, c.ln)) });
      }
    }
  }
  return out;
}

/* ---- 组装 ---- */

/** 生成演示数据（两语言各跑一遍管线；高亮与语言无关，按文件缓存复用） */
export async function generateDemoData(): Promise<{ "zh-CN": DemoChangeset; en: DemoChangeset }> {
  const entries = loadChangeset(CHANGESET_DIR);
  const manifest = parseToml(
    readFileSync(`${CHANGESET_DIR}/changeset.toml`, "utf8"),
  ) as unknown as {
    featured?: string;
    order?: string[];
  };
  const orderIdx = new Map((manifest.order ?? []).map((p, i) => [p, i]));
  const ordered = [...entries].sort(
    (x, y) => (orderIdx.get(x.path) ?? 99) - (orderIdx.get(y.path) ?? 99),
  );

  const tokenCache = new Map<string, FileTokens>();
  const result = {} as { "zh-CN": DemoChangeset; en: DemoChangeset };
  for (const [locale, s] of [
    ["zh-CN", zhCN],
    ["en", en],
  ] as const) {
    const files: DemoFile[] = [];
    for (const entry of ordered) {
      const a = await analyzeEntry(entry, locale as Locale);
      let tk = tokenCache.get(entry.path);
      if (!tk) {
        tk = buildTokens(a);
        tokenCache.set(entry.path, tk);
      }
      files.push({
        path: entry.path,
        additions: a.diffFile.additions,
        deletions: a.diffFile.deletions,
        badges: demoBadges(a, s),
        units: demoUnits(a.projection.units, s),
        simplified: simplifiedRows(a, tk, s),
        raw: rawRows(a, tk),
      });
    }
    // 签名变更的文件排最前，组内保持清单顺序（与产品侧栏同规则）
    const hasSig = (f: DemoFile) => f.badges.some((b) => b.kind === "signature");
    result[locale] = {
      featured: manifest.featured ?? ordered[0]?.path ?? "",
      files: [...files.filter(hasSig), ...files.filter((f) => !hasSig(f))],
    };
  }
  return result;
}

/** 生成的 TS 模块文本（接口声明与上文内部类型须同步维护） */
export async function generateDemoModule(): Promise<string> {
  const data = await generateDemoData();
  return `// 由 scripts/gen-demo.ts 生成（bun run gen:demo），勿手改；新鲜度由 test/samples.test.ts 锁定

export interface DemoSeg {
  t: string;
  dc?: string;
  lc?: string;
  hl?: "a" | "d";
  e?: string;
  em?: "repl" | "adj" | "mark";
  mo?: number;
}

export interface DemoRowLine {
  k: "ctx" | "del" | "add";
  o?: number;
  n?: number;
  segs: DemoSeg[];
}

export interface DemoFoldLine {
  ln: number;
  segs: DemoSeg[];
}

export interface DemoRowFold {
  k: "fold";
  count: number;
  summary: string;
  olds: DemoFoldLine[];
  news: DemoFoldLine[];
}

export type DemoRow = DemoRowLine | DemoRowFold;

export interface DemoBadge {
  kind: string;
  label: string;
  count: number;
}

export interface DemoUnit {
  name: string;
  glyph: string;
  tag: string;
  tagKind: string;
  membersAdded: string[];
  membersRemoved: string[];
}

export interface DemoFile {
  path: string;
  additions: number;
  deletions: number;
  badges: DemoBadge[];
  units: DemoUnit[];
  simplified: DemoRow[];
  raw: DemoRowLine[];
}

export interface DemoChangeset {
  featured: string;
  files: DemoFile[];
}

export const demoData: { "zh-CN": DemoChangeset; en: DemoChangeset } = ${JSON.stringify(data, null, 2)};
`;
}

if (import.meta.main) {
  const text = await generateDemoModule();
  writeFileSync(OUT_FILE, text);
  console.log(`已生成 ${OUT_FILE}（${(text.length / 1024).toFixed(1)} KB）`);
}
