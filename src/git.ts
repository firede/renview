import { $ } from "bun";
import { join } from "node:path";
import { lstat } from "node:fs/promises";
import { mapConcurrent } from "./concurrency";
import { readSourceStream, SourceTooLargeError } from "./source";
import { readRepoSource, safeRepoPath } from "./repo-path";
import { messages, type Locale } from "./i18n";

/** git 空树的固定 hash，用于仓库尚无提交时作为对比基准 */
export const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export async function findRepoRoot(cwd: string): Promise<string | null> {
  const r = await $`git -C ${cwd} rev-parse --show-toplevel`.quiet().nothrow();
  return r.exitCode === 0 ? r.text().trim() : null;
}

async function defaultBase(root: string): Promise<string> {
  const r = await $`git -C ${root} rev-parse --verify HEAD`.quiet().nothrow();
  return r.exitCode === 0 ? "HEAD" : EMPTY_TREE;
}

/** 无参时默认对比 HEAD（或空树）；否则参数原样透传给 git diff */
export async function resolveDiffArgs(root: string, args: string[]): Promise<string[]> {
  return args.length > 0 ? args : [await defaultBase(root)];
}

export async function getDiff(root: string, args: string[], locale: Locale): Promise<string> {
  const r =
    await $`git -c core.quotepath=false -C ${root} diff --no-color --no-ext-diff --no-textconv ${args}`
      .quiet()
      .nothrow();
  if (r.exitCode !== 0) {
    throw new Error(messages(locale).api.gitDiffFailed(r.stderr.toString().trim()));
  }
  return r.text();
}

/** 原始 diff 与投影共用同一组来源；仅工作区审阅补入未跟踪文件。 */
export async function getReviewDiff(
  root: string,
  args: string[],
  locale: Locale,
  cache?: UntrackedCache,
) {
  const sides = await resolveSides(root, args);
  const [tracked, untracked] = await Promise.all([
    getDiff(root, args, locale),
    sides.newSide.type === "worktree" ? getUntrackedDiff(root, extractPathspecs(args), cache) : "",
  ]);
  return { diff: tracked + untracked, sides };
}

/** 从透传参数中提取 `--` 之后的 pathspec，用于过滤 untracked 文件 */
export function extractPathspecs(args: string[]): string[] {
  const i = args.indexOf("--");
  return i >= 0 ? args.slice(i + 1) : [];
}

export async function listUntracked(root: string, pathspecs: string[]): Promise<string[]> {
  const r = await $`git -C ${root} ls-files -z --others --exclude-standard -- ${pathspecs}`
    .quiet()
    .nothrow();
  if (r.exitCode !== 0) return [];
  return r
    .text()
    .split("\0")
    .filter((l) => l.length > 0);
}

/** 列出仓库全部文件（已跟踪 + 未跟踪，尊重 gitignore），供查看器浏览 */
export async function listFiles(root: string, locale: Locale): Promise<string[]> {
  const r = await $`git -C ${root} ls-files -z --cached --others --exclude-standard`
    .quiet()
    .nothrow();
  if (r.exitCode !== 0) {
    throw new Error(messages(locale).api.gitLsFilesFailed(r.stderr.toString().trim()));
  }
  return [...new Set(r.text().split("\0").filter(Boolean))].sort();
}

type UntrackedCache = Map<string, { stamp: string; diff: string }>;

/** 每个服务保留未跟踪文件缓存；重叠请求共用读取，完成后仍重新检查工作区。 */
export function createReviewDiffReader(root: string, args: string[]) {
  const cache: UntrackedCache = new Map();
  const pending = new Map<Locale, ReturnType<typeof getReviewDiff>>();
  return (locale: Locale) => {
    let task = pending.get(locale);
    if (!task) {
      task = getReviewDiff(root, args, locale, cache).finally(() => pending.delete(locale));
      pending.set(locale, task);
    }
    return task;
  };
}

/** 为 untracked 文件合成 new-file diff；缓存仅在元数据未变时使用，不修改 Git 索引。 */
export async function getUntrackedDiff(
  root: string,
  pathspecs: string[],
  cache: UntrackedCache = new Map(),
): Promise<string> {
  const files = await listUntracked(root, pathspecs);
  const present = new Set(files);
  for (const path of cache.keys()) if (!present.has(path)) cache.delete(path);
  const stamp = async (file: string) => {
    const s = await lstat(join(root, file), { bigint: true });
    return `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}:${s.mode}`;
  };
  const parts = await mapConcurrent(files, 8, async (file) => {
    let before: string;
    try {
      before = await stamp(file);
    } catch {
      cache.delete(file);
      return "";
    }
    const hit = cache.get(file);
    if (hit?.stamp === before) return hit.diff;
    cache.delete(file);
    const r =
      await $`git -c core.quotepath=false -C ${root} diff --no-index --no-color --no-ext-diff --no-textconv -- /dev/null ${file}`
        .quiet()
        .nothrow();
    // --no-index 有差异时退出码为 1，大于 1 才是真正的错误。
    if (r.exitCode > 1) return "";
    const diff = r.text();
    // 读取中发生变化时不缓存，下一次请求重新生成。
    if ((await stamp(file).catch(() => null)) === before) cache.set(file, { stamp: before, diff });
    return diff;
  });
  return parts.join("");
}

/** diff 某一侧内容的来源：某个 rev、暂存区（index）、或工作区 */
export interface SideSpec {
  type: "rev" | "index" | "worktree";
  rev?: string;
}

async function mergeBase(root: string, a: string, b: string): Promise<string | null> {
  const r = await $`git -C ${root} merge-base ${a} ${b}`.quiet().nothrow();
  return r.exitCode === 0 ? r.text().trim() : null;
}

/**
 * 从 diff 参数推出新旧两侧的内容来源：
 * A...B → merge-base(A,B) vs B；A..B 或 A B → A vs B；
 * 单 rev R → R vs 工作区（--staged 时为暂存区）；
 * 无 rev → 暂存区 vs 工作区（--staged 时 HEAD vs 暂存区）。
 */
export async function resolveSides(
  root: string,
  args: string[],
): Promise<{ oldSide: SideSpec; newSide: SideSpec }> {
  let staged = false;
  const revs: string[] = [];
  let afterDashDash = false;
  for (const a of args) {
    if (afterDashDash) continue;
    if (a === "--") {
      afterDashDash = true;
      continue;
    }
    if (a === "--cached" || a === "--staged") {
      staged = true;
      continue;
    }
    if (a.startsWith("-")) continue;
    revs.push(a);
  }

  const range = revs.length === 1 ? revs[0] : undefined;
  if (range?.includes("...")) {
    const [a, b] = range.split("...");
    const base = await mergeBase(root, a || "HEAD", b || "HEAD");
    return {
      oldSide: { type: "rev", rev: base ?? (a || "HEAD") },
      newSide: { type: "rev", rev: b || "HEAD" },
    };
  }
  if (range?.includes("..")) {
    const [a, b] = range.split("..");
    return {
      oldSide: { type: "rev", rev: a || "HEAD" },
      newSide: { type: "rev", rev: b || "HEAD" },
    };
  }
  if (revs.length >= 2) {
    return { oldSide: { type: "rev", rev: revs[0]! }, newSide: { type: "rev", rev: revs[1]! } };
  }
  if (revs.length === 1) {
    return {
      oldSide: { type: "rev", rev: revs[0]! },
      newSide: staged ? { type: "index" } : { type: "worktree" },
    };
  }
  return staged
    ? { oldSide: { type: "rev", rev: await defaultBase(root) }, newSide: { type: "index" } }
    : { oldSide: { type: "index" }, newSide: { type: "worktree" } };
}

/** 有界读取 diff 某一侧全文；不存在时返回 null，超限抛出明确的降级信号。 */
export async function getSideContent(
  root: string,
  side: SideSpec,
  path: string,
): Promise<string | null> {
  if (!safeRepoPath(root, path)) return null;
  try {
    if (side.type === "worktree") return await readRepoSource(root, path);
    const spec = side.type === "index" ? `:${path}` : `${side.rev}:${path}`;
    const proc = Bun.spawn(["git", "-C", root, "show", spec], { stdout: "pipe", stderr: "ignore" });
    try {
      const text = await readSourceStream(proc.stdout);
      return (await proc.exited) === 0 ? text : null;
    } finally {
      if (proc.exitCode == null) proc.kill();
      await proc.exited;
    }
  } catch (error) {
    if (error instanceof SourceTooLargeError) throw error;
    return null;
  }
}
