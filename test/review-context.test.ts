import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDiff } from "react-diff-view";
import { handleReviewFile } from "../src/server";
import { getReviewDiff } from "../src/git";
import type { ReviewContext, SRow } from "../src/analysis/types";
import {
  changeRow,
  contextGaps,
  expandContext,
  expandedRows,
  rowScope,
  scopeGroups,
} from "../web/src/reviewContext";

const dir = mkdtempSync(join(tmpdir(), "renview-context-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
function git(...args: string[]) {
  const r = Bun.spawnSync(["git", "-C", dir, ...args]);
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return r.stdout.toString();
}
git("init", "-q", "-b", "main");
git("config", "user.email", "test@example.com");
git("config", "user.name", "测试");
const old = [
  "extends Node",
  "",
  "func _build_ui() -> void:",
  ...Array.from({ length: 80 }, (_, i) => `\tprint(${i})`),
  "",
].join("\n");
writeFileSync(join(dir, "main.gd"), old);
writeFileSync(join(dir, "unchanged.txt"), "不变");
git("add", ".");
git("commit", "-qm", "初始版本");
const next = old.replace("\tprint(15)", "\tprint(150)\n\tprint(151)").replace("\tprint(60)\n", "");
writeFileSync(join(dir, "main.gd"), next);
git("add", ".");
git("commit", "-qm", "修改实现");
writeFileSync(join(dir, "main.gd"), "工作区草稿");

async function context(): Promise<ReviewContext> {
  const response = await handleReviewFile(dir, ["HEAD~1...HEAD"], "main.gd", "zh-CN");
  expect(response.status).toBe(200);
  return response.json() as Promise<ReviewContext>;
}

test("审阅上下文使用提交两侧而非工作区，声明归属包含完整签名", async () => {
  const c = await context();
  expect(c.oldFile?.source).toBe(old);
  expect(c.newFile?.source).toBe(next);
  expect(c.newFile?.outline.find((d) => d.name === "_build_ui")?.signature).toBe(
    "func _build_ui() -> void:",
  );
  expect(rowScope({ kind: "add", text: "", newLn: 20 }, c)).toBe("func _build_ui() -> void:");
  expect(rowScope({ kind: "del", text: "", oldLn: 70 }, c)).toBe("func _build_ui() -> void:");
  expect(rowScope({ kind: "ctx", text: "", newLn: 1 }, c)).toBeNull();
});

test("上下文接口只接受当前 diff 中的安全路径", async () => {
  for (const path of ["../main.gd", ".git/config", "/etc/passwd"]) {
    expect((await handleReviewFile(dir, ["HEAD~1...HEAD"], path, "zh-CN")).status).toBe(400);
  }
  expect((await handleReviewFile(dir, ["HEAD~1...HEAD"], "unchanged.txt", "zh-CN")).status).toBe(
    404,
  );
});

test("上下展开与全部展开保持新旧行号和变更不变，无重复行", async () => {
  const c = await context();
  const f = parseDiff(c.diff)[0]!;
  const gaps = contextGaps(f, old);
  expect(gaps).toHaveLength(3);
  const middle = gaps[1]!;
  const partial = expandContext(f, old, [
    [middle.start, middle.start + 5],
    [middle.end - 5, middle.end],
  ]);
  expect(contextGaps(partial, old).find((g) => g.start === middle.start + 5)?.end).toBe(
    middle.end - 5,
  );
  const full = expandContext(
    f,
    old,
    gaps.map((g) => [g.start, g.end]),
  );
  expect(contextGaps(full, old)).toEqual([]);
  const changes = full.hunks.flatMap((h) => h.changes);
  expect(changes.filter((c) => c.type !== "normal")).toEqual(
    f.hunks.flatMap((h) => h.changes).filter((c) => c.type !== "normal"),
  );
  const oldLns: number[] = [];
  const newLns: number[] = [];
  for (const change of changes) {
    if (change.type === "normal") {
      expect(change.content).toBe(old.split("\n")[change.oldLineNumber - 1]!);
      expect(change.content).toBe(next.split("\n")[change.newLineNumber - 1]!);
      oldLns.push(change.oldLineNumber);
      newLns.push(change.newLineNumber);
    } else if (change.type === "delete") oldLns.push(change.lineNumber);
    else newLns.push(change.lineNumber);
  }
  expect(oldLns).toEqual(Array.from({ length: old.split("\n").length - 1 }, (_, i) => i + 1));
  expect(newLns).toEqual(Array.from({ length: next.split("\n").length - 1 }, (_, i) => i + 1));
});

test("简化视图补入上下文时保留原有变更行与折叠对象", async () => {
  const c = await context();
  const f = parseDiff(c.diff)[0]!;
  const baseRows: SRow[] = f.hunks.flatMap((h) => h.changes.map(changeRow));
  const base = { rows: baseRows, stats: { folded: 0, visible: 3 } };
  const full = expandContext(
    f,
    old,
    contextGaps(f, old).map((g) => [g.start, g.end]),
  );
  const result = expandedRows(base, f, full, c);
  for (const r of baseRows) expect(result.rows.includes(r)).toBe(true);
  expect(result.rows.filter((r) => !baseRows.includes(r)).every((r) => r.kind === "ctx")).toBe(
    true,
  );
  expect(result.stats).toBe(base.stats);
  expect(
    scopeGroups(
      full.hunks.flatMap((h) => h.changes),
      c,
    ).map((g) => g.scope),
  ).toEqual([null, "func _build_ui() -> void:"]);
});

test("暂存区上下文读取 index，删除文件仍可查看旧侧", async () => {
  git("rm", "-f", "main.gd");
  const response = await handleReviewFile(dir, ["--staged"], "main.gd", "zh-CN");
  const c = (await response.json()) as ReviewContext;
  expect(c.oldFile?.source).toBe(next);
  expect(c.newFile).toBeNull();
  expect((await getReviewDiff(dir, ["--staged"], "zh-CN")).diff).toBe(c.diff);
});

test("折叠行在上下文展开后只出现一次，保留展开所需的原文", () => {
  const file = parseDiff(
    "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -3,3 +3,3 @@\n // 三\n-type A = number;\n+type A = string;\n // 五\n",
  )[0]!;
  const source = "// 一\n// 二\n// 三\ntype A = number;\n// 五\n// 六\n";
  const fold: SRow = {
    kind: "fold",
    count: 2,
    oldLines: ["type A = number;"],
    newLines: ["type A = string;"],
    oldLns: [4],
    newLns: [4],
  };
  const base = {
    rows: [changeRow(file.hunks[0]!.changes[0]!), fold, changeRow(file.hunks[0]!.changes[3]!)],
    stats: { folded: 2, visible: 0 },
  };
  const full = expandContext(file, source, [
    [1, 3],
    [6, 7],
  ]);
  const result = expandedRows(base, file, full, { oldFile: null, newFile: null, diff: "" });
  expect(result.rows.filter((r) => r.kind === "fold")).toEqual([fold]);
  expect(result.rows.map((r) => r.kind)).toEqual(["ctx", "ctx", "ctx", "fold", "ctx", "ctx"]);
});

test("函数签名变化不拆散原始双列 diff 的新旧配对", () => {
  const viewer = (signature: string) => ({
    path: "a.ts",
    source: "",
    language: "typescript",
    simplified: null,
    view: null,
    outline: [
      {
        kind: "function" as const,
        name: "f",
        container: "",
        typeLevel: false,
        range: [1, 3] as [number, number],
        signature,
      },
    ],
  });
  const file = parseDiff(
    "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-function f(a) {}\n+function f(a, b) {}\n",
  )[0]!;
  const groups = scopeGroups(file.hunks[0]!.changes, {
    oldFile: viewer("function f(a)"),
    newFile: viewer("function f(a, b)"),
    diff: "",
  });
  expect(groups).toHaveLength(1);
  expect(groups[0]!.changes).toHaveLength(2);
});

test("暂存版本不混入工作区草稿，纯改名仍返回新旧路径的源码", async () => {
  git("reset", "--hard", "HEAD");
  try {
    const indexed = next.replace("print(150)", "print(222)");
    writeFileSync(join(dir, "main.gd"), indexed);
    git("add", ".");
    writeFileSync(join(dir, "main.gd"), "工作区草稿");
    const staged = (await (
      await handleReviewFile(dir, ["--staged"], "main.gd", "zh-CN")
    ).json()) as ReviewContext;
    expect(staged.newFile?.source).toBe(indexed);
    git("reset", "--hard", "HEAD");
    git("mv", "main.gd", "renamed.gd");
    const renamed = (await (
      await handleReviewFile(dir, ["--staged"], "renamed.gd", "zh-CN")
    ).json()) as ReviewContext;
    expect(renamed.oldFile?.path).toBe("main.gd");
    expect(renamed.newFile?.path).toBe("renamed.gd");
    expect(renamed.newFile?.source).toBe(next);
    const file = parseDiff(renamed.diff)[0]!;
    expect(contextGaps(file, next)).toEqual([
      { start: 1, end: next.split("\n").length, before: 0 },
    ]);
    const all = expandContext(file, next, [[1, next.split("\n").length]]);
    expect(all.hunks.flatMap((h) => h.changes).every((c) => c.type === "normal")).toBe(true);
  } finally {
    git("reset", "--hard", "HEAD");
  }
});
