import { describe, expect, test } from "bun:test";
import { allDirPaths, buildTree, type TreeDir, type TreeNode } from "../web/src/FileTree";

function dirNames(nodes: TreeNode[]): string[] {
  return nodes.filter((n) => n.kind === "dir").map((n) => n.name);
}

describe("buildTree", () => {
  test("目录在前、文件在后，各自按名称排序", () => {
    const tree = buildTree(["z.ts", "src/a.ts", "README.md", "assets/x.png"]);
    expect(tree.map((n) => n.name)).toEqual(["assets", "src", "README.md", "z.ts"]);
  });

  test("单子目录链压缩", () => {
    const tree = buildTree(["src/main/java/com/App.java", "README.md"]);
    const src = tree[0] as TreeDir;
    expect(src.kind).toBe("dir");
    expect(src.name).toBe("src/main/java/com");
    expect(src.path).toBe("src/main/java/com");
    expect(src.children.map((c) => c.name)).toEqual(["App.java"]);
  });

  test("含文件的目录不参与链压缩", () => {
    const tree = buildTree(["src/index.ts", "src/lib/util.ts"]);
    const src = tree[0] as TreeDir;
    expect(src.name).toBe("src");
    expect(dirNames(src.children)).toEqual(["lib"]);
  });

  test("allDirPaths 返回压缩后的完整目录路径", () => {
    const tree = buildTree(["src/lib/a.ts", "assets/img/x.png"]);
    expect(allDirPaths(tree).sort()).toEqual(["assets/img", "src/lib"]);
  });
});
