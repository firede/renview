import { describe, expect, test } from "bun:test";
import { foldDescriber } from "../src/analysis/foldescribe";
import { pythonProfile } from "../src/analysis/langs/python";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import type { LanguageProfile } from "../src/analysis/langs/types";
import type { ParsedFile } from "../src/analysis/map";
import { parseSide } from "../src/analysis/project";
import { buildSimplifiedRows, simplifyTree, type SRow } from "../src/analysis/simplify";
import type { Locale } from "../src/i18n";

/** 解析两侧 + 简化 + 构建行（带折叠描述器），返回行列表 */
async function rowsWithFoldSummary(
  profile: LanguageProfile,
  oldSrc: string,
  newSrc: string,
  changes: ParsedFile["chunks"][number]["changes"],
  locale: Locale = "zh-CN",
): Promise<SRow[]> {
  const oldSide = await parseSide(profile, oldSrc);
  const newSide = await parseSide(profile, newSrc);
  const oldS = simplifyTree(oldSide.tree, oldSrc, profile.simplify!);
  const newS = simplifyTree(newSide.tree, newSrc, profile.simplify!);
  const file: ParsedFile = {
    chunks: [{ changes }],
    from: "a",
    to: "a",
    deletions: 0,
    additions: 0,
  };
  return buildSimplifiedRows(file, oldS, newS, foldDescriber(profile, oldSide, newSide, locale))
    .rows;
}

function foldSummaryOf(rows: SRow[]): string | undefined {
  const fold = rows.find((r) => r.kind === "fold");
  return fold?.kind === "fold" ? fold.summary : undefined;
}

describe("折叠组成员级摘要", () => {
  test("ts interface 成员类型变化：摘要定位到声明与成员", async () => {
    const oldSrc = `interface Point {
  x: number;
  y: number;
}
`;
    const newSrc = `interface Point {
  x: number;
  y: string;
}
`;
    const rows = await rowsWithFoldSummary(typescriptProfile, oldSrc, newSrc, [
      { type: "normal", ln1: 1, ln2: 1, content: " interface Point {" },
      { type: "normal", ln1: 2, ln2: 2, content: "   x: number;" },
      { type: "del", ln: 3, content: "-  y: number;" },
      { type: "add", ln: 3, content: "+  y: string;" },
      { type: "normal", ln1: 4, ln2: 4, content: " }" },
    ]);
    expect(foldSummaryOf(rows)).toBe("Point：y（类型/格式变更）");
  });

  test("函数体内的折叠行不归属任何类型声明，回落无摘要", async () => {
    const oldSrc = `function f(a: number) {
  return a;
}
`;
    const newSrc = `function f(a: string) {
  return a;
}
`;
    const rows = await rowsWithFoldSummary(typescriptProfile, oldSrc, newSrc, [
      { type: "del", ln: 1, content: "-function f(a: number) {" },
      { type: "add", ln: 1, content: "+function f(a: string) {" },
      { type: "normal", ln1: 2, ln2: 2, content: "   return a;" },
    ]);
    // 签名行折叠但无成员可定位 → 无成员级摘要（前端回落行数文案）
    expect(rows[0]!.kind).toBe("fold");
    expect(foldSummaryOf(rows)).toBeUndefined();
  });

  test("python 纯数据类：字段类型变化定位到字段", async () => {
    const oldSrc = `@dataclass
class User:
    id: int
    name: str
`;
    const newSrc = `@dataclass
class User:
    id: int
    name: bytes
`;
    const rows = await rowsWithFoldSummary(pythonProfile, oldSrc, newSrc, [
      { type: "normal", ln1: 1, ln2: 1, content: " @dataclass" },
      { type: "normal", ln1: 2, ln2: 2, content: " class User:" },
      { type: "normal", ln1: 3, ln2: 3, content: "     id: int" },
      { type: "del", ln: 4, content: "-    name: str" },
      { type: "add", ln: 4, content: "+    name: bytes" },
    ]);
    expect(foldSummaryOf(rows)).toBe("User：name（类型/格式变更）");
  });

  test("python 普通类（含方法）：方法体内的折叠不归属类成员", async () => {
    const oldSrc = `class A:
    def f(self, x: int):
        return x
`;
    const newSrc = `class A:
    def f(self, x: str):
        return x
`;
    const rows = await rowsWithFoldSummary(pythonProfile, oldSrc, newSrc, [
      { type: "normal", ln1: 1, ln2: 1, content: " class A:" },
      { type: "del", ln: 2, content: "-    def f(self, x: int):" },
      { type: "add", ln: 2, content: "+    def f(self, x: str):" },
      { type: "normal", ln1: 3, ln2: 3, content: "         return x" },
    ]);
    expect(rows.some((r) => r.kind === "fold")).toBe(true);
    expect(foldSummaryOf(rows)).toBeUndefined();
  });

  test("英文摘要", async () => {
    const oldSrc = `interface Cfg {
  retries: number;
}
`;
    const newSrc = `interface Cfg {
  retries: bigint;
}
`;
    const rows = await rowsWithFoldSummary(
      typescriptProfile,
      oldSrc,
      newSrc,
      [
        { type: "normal", ln1: 1, ln2: 1, content: " interface Cfg {" },
        { type: "del", ln: 2, content: "-  retries: number;" },
        { type: "add", ln: 2, content: "+  retries: bigint;" },
        { type: "normal", ln1: 3, ln2: 3, content: " }" },
      ],
      "en",
    );
    expect(foldSummaryOf(rows)).toBe("Cfg: retries (type/format changes)");
  });
});
