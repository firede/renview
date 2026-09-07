import { describe, expect, test } from "bun:test";
import { parseDiff } from "react-diff-view";
import { highlightDiff, highlightSparseLines, highlightText } from "../web/src/highlight-core";

function diffAt(line: number) {
  return parseDiff(`diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -${line},2 +${line},2 @@
 const shared = true;
-const value = 1;
+const value = 2;
`)[0]!;
}

describe("稀疏 diff 高亮", () => {
  test("百万行文件末尾的少量变更只高亮实际内容并保留行号", async () => {
    const far = await highlightDiff(diffAt(1_000_000).hunks, "typescript", "dark", "deterministic");
    const near = await highlightDiff(diffAt(1).hunks, "typescript", "dark", "deterministic");
    expect(Object.keys(far.old)).toHaveLength(2);
    expect(Object.keys(far.new)).toHaveLength(2);
    expect(far.old[999_999]).toEqual(near.old[0]);
    expect(far.old[1_000_000]).toEqual(near.old[1]);
    expect(far.new[1_000_000]).toEqual(near.new[1]);
    expect(far.old[0]).toBeUndefined();
  });

  test("多 hunk 的两侧行号偏移与增删内容各自正确", async () => {
    const f = parseDiff(`diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -2,1 +2,2 @@
 const shared = true;
+const added = 1;
@@ -100,1 +101,1 @@
-const old = 2;
+const next = 3;
`)[0]!;
    const tokens = await highlightDiff(f.hunks, "typescript", "light", "deterministic");
    const text = (nodes: (typeof tokens.old)[number]) => nodes?.map((n) => n.value).join("");
    expect(text(tokens.old[99])).toBe("const old = 2;");
    expect(text(tokens.new[100])).toBe("const next = 3;");
    expect(text(tokens.new[2])).toBe("const added = 1;");
    expect(tokens.old[2]).toBeUndefined();
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`折叠缺口后的代码不继承前段注释色（${theme}）`, async () => {
    const code = "  upgradeManualHint: `Manual upgrade: ${INSTALL_CMD}`,";
    const tokens = await highlightSparseLines(
      new Map([
        [1, "/**"],
        [2, " * English copy"],
        [52, code],
      ]),
      "typescript",
      theme,
      "deterministic",
    );
    const expected = await highlightText(code, "typescript", theme, "deterministic");
    expect(tokens[51]).toEqual(expected![0]!);
    expect(new Set(tokens[51]!.map((t) => t.color)).size).toBeGreaterThan(1);
    expect(tokens[2]).toBeUndefined();
  });

  test(`连续行保留跨行注释状态（${theme}）`, async () => {
    const source = ["/**", " * English copy", " */", "const value = 1;"];
    const tokens = await highlightSparseLines(
      new Map(source.map((line, i) => [i + 10, line])),
      "typescript",
      theme,
      "deterministic",
    );
    const expected = await highlightText(source.join("\n"), "typescript", theme, "deterministic");
    expect(tokens.slice(9)).toEqual(expected!);
  });
}
