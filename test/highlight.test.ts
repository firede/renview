import { describe, expect, test } from "bun:test";
import { parseDiff } from "react-diff-view";
import { highlightDiff } from "../web/src/highlight-core";

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
    const far = await highlightDiff(diffAt(1_000_000).hunks, "typescript", "dark");
    const near = await highlightDiff(diffAt(1).hunks, "typescript", "dark");
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
    const tokens = await highlightDiff(f.hunks, "typescript", "light");
    const text = (nodes: typeof tokens.old[number]) => nodes?.map((n) => n.value).join("");
    expect(text(tokens.old[99])).toBe("const old = 2;");
    expect(text(tokens.new[100])).toBe("const next = 3;");
    expect(text(tokens.new[2])).toBe("const added = 1;");
    expect(tokens.old[2]).toBeUndefined();
  });
});
