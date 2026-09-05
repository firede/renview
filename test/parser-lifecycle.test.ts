import { describe, expect, spyOn, test } from "bun:test";
import { Tree } from "web-tree-sitter";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import { analyzeFile, withParsedSides } from "../src/analysis/project";
import { simplifySource } from "../src/analysis/simplify";

describe("解析树生命周期", () => {
  test("分析后释放两侧树，返回结果仍可使用", async () => {
    const deleted = spyOn(Tree.prototype, "delete");
    try {
      const result = await analyzeFile(
        typescriptProfile,
        "const n = 1;",
        "const n = 2;",
        new Set([1]),
        new Set([1]),
        "en",
      );
      expect(result.units[0]?.name).toBe("n");
      expect(deleted).toHaveBeenCalledTimes(2);
    } finally {
      deleted.mockRestore();
    }
  });

  test("分析回调失败也释放两侧树", async () => {
    const deleted = spyOn(Tree.prototype, "delete");
    try {
      await expect(
        withParsedSides(typescriptProfile, "", "", () => {
          throw new Error("分析失败");
        }),
      ).rejects.toThrow("分析失败");
      expect(deleted).toHaveBeenCalledTimes(2);
    } finally {
      deleted.mockRestore();
    }
  });

  test("第二侧解析初始化失败时释放第一侧", async () => {
    const deleted = spyOn(Tree.prototype, "delete");
    let reads = 0;
    const profile = {
      ...typescriptProfile,
      get grammarFile() {
        return ++reads === 1 ? "typescript" : "missing";
      },
    };
    try {
      await expect(withParsedSides(profile, "", "", () => null)).rejects.toThrow("未知语法");
      expect(deleted).toHaveBeenCalledTimes(1);
    } finally {
      deleted.mockRestore();
    }
  });

  test("简化成功与错误节点降级均释放树", async () => {
    const deleted = spyOn(Tree.prototype, "delete");
    const profile = { grammarFile: "typescript", simplify: typescriptProfile.simplify! };
    try {
      expect((await simplifySource(profile, "const n: number = 1;")).lines[0]).toContain("n");
      await expect(simplifySource(profile, "function {")).rejects.toThrow();
      expect(deleted).toHaveBeenCalledTimes(2);
    } finally {
      deleted.mockRestore();
    }
  });
});
