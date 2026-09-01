import { $ } from "bun";
import { join } from "node:path";

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

export async function getDiff(root: string, args: string[]): Promise<string> {
  const r = await $`git -C ${root} diff --no-color --no-ext-diff ${args}`.quiet().nothrow();
  if (r.exitCode !== 0) throw new Error(`git diff 失败: ${r.stderr.toString().trim()}`);
  return r.text();
}

/** 从透传参数中提取 `--` 之后的 pathspec，用于过滤 untracked 文件 */
export function extractPathspecs(args: string[]): string[] {
  const i = args.indexOf("--");
  return i >= 0 ? args.slice(i + 1) : [];
}

export async function listUntracked(root: string, pathspecs: string[]): Promise<string[]> {
  const r = await $`git -C ${root} ls-files --others --exclude-standard -- ${pathspecs}`
    .quiet()
    .nothrow();
  if (r.exitCode !== 0) return [];
  return r
    .text()
    .split("\n")
    .filter((l) => l.length > 0);
}

/** 为 untracked 文件合成 new-file 风格的 unified diff（git diff 本身不含 untracked） */
export async function getUntrackedDiff(root: string, pathspecs: string[]): Promise<string> {
  const files = await listUntracked(root, pathspecs);
  const parts: string[] = [];
  for (const file of files) {
    const r = await $`git -C ${root} diff --no-index --no-color -- /dev/null ${file}`
      .quiet()
      .nothrow();
    // --no-index 有差异时退出码为 1，大于 1 才是真正的错误
    if (r.exitCode > 1) continue;
    const text = r.text();
    if (!text) continue;
    parts.push(text.replace(/^diff --git .*$/m, `diff --git a/${file} b/${file}`));
  }
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
      oldSide: { type: "rev", rev: base ?? a ?? "HEAD" },
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
    ? { oldSide: { type: "rev", rev: "HEAD" }, newSide: { type: "index" } }
    : { oldSide: { type: "index" }, newSide: { type: "worktree" } };
}

/** 读取 diff 某一侧的文件全文；失败（如该侧不存在此文件）返回 null */
export async function getSideContent(
  root: string,
  side: SideSpec,
  path: string,
): Promise<string | null> {
  try {
    if (side.type === "worktree") {
      const f = Bun.file(join(root, path));
      if (!(await f.exists())) return null;
      return await f.text();
    }
    const spec = side.type === "index" ? `:${path}` : `${side.rev}:${path}`;
    const r = await $`git -C ${root} show ${spec}`.quiet().nothrow();
    return r.exitCode === 0 ? r.text() : null;
  } catch {
    return null;
  }
}
