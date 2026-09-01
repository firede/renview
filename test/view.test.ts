import { describe, expect, test } from "bun:test";
import { rustProfile } from "../src/analysis/langs/rust";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import type { LanguageProfile } from "../src/analysis/langs/types";
import { parseSource } from "../src/analysis/parser";
import { applySimplify, collectSimplifyOps } from "../src/analysis/simplify";
import { simplifyTree } from "../src/analysis/simplify";
import { buildViewRows, rowIndexOfLine } from "../src/analysis/view";

async function viewRows(profile: LanguageProfile, source: string) {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("测试源码解析出错");
  const simplified = simplifyTree(tree, source, profile.simplify!);
  return buildViewRows(profile, tree, source, simplified);
}

async function simplify(profile: LanguageProfile, source: string): Promise<string[]> {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("测试源码解析出错");
  return applySimplify(source, collectSimplifyOps(tree.rootNode, source, profile.simplify!));
}

describe("buildViewRows：ts 块折叠", () => {
  test("imports 连续段折叠为单行摘要，展开保留原文", async () => {
    const src = `import { a } from "./a";
import { b } from "./b";
import type { C } from "./c";

export const x = a;
`;
    const rows = await viewRows(typescriptProfile, src);
    expect(rows[0]).toMatchObject({
      kind: "fold",
      text: "import × 3（./a、./b、./c）",
      srcRange: [1, 3],
    });
    expect(rows[0]!.kind === "fold" && rows[0]!.original).toHaveLength(3);
    expect(rows[1]).toMatchObject({ kind: "line", text: "", src: 4 });
    expect(rows[2]).toMatchObject({ kind: "line", text: "export const x = a;", src: 5 });
  });

  test("interface 折叠为带成员名的单行摘要", async () => {
    const src = `export interface Point {
  x: number;
  y: number;
  z?: number;
}
`;
    const rows = await viewRows(typescriptProfile, src);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "fold",
      text: "interface Point { x, y, z }",
      srcRange: [1, 5],
    });
  });

  test("成员超过 6 个截断并显示总数", async () => {
    const members = Array.from({ length: 8 }, (_, i) => `  m${i}: number;`).join("\n");
    const src = `interface Big {\n${members}\n}\n`;
    const rows = await viewRows(typescriptProfile, src);
    expect(rows[0]).toMatchObject({
      kind: "fold",
      text: "interface Big { m0, m1, m2, m3, m4, m5, …（共 8 个） }",
    });
  });

  test("enum 折叠保留变体名（领域词汇）", async () => {
    const src = `enum Color {\n  Red,\n  Green = 2,\n}\n`;
    const rows = await viewRows(typescriptProfile, src);
    expect(rows[0]).toMatchObject({ kind: "fold", text: "enum Color { Red, Green }" });
  });

  test("连续空行压缩为一行，文件末尾空行不保留", async () => {
    const src = `const a = 1;


const b = 2;
`;
    const rows = await viewRows(typescriptProfile, src);
    expect(rows.map((r) => r.kind === "line" && r.text)).toEqual([
      "const a = 1;",
      "",
      "const b = 2;",
    ]);
  });
});

describe("buildViewRows：rust 块折叠", () => {
  test("use / struct / enum / trait 折叠", async () => {
    const src = `use std::collections::HashMap;
use std::io;

pub struct Point {
    x: f64,
    pub y: f64,
}

enum Status {
    Active,
    Banned(String),
}

trait Shape {
    fn area(&self) -> f64;
}
`;
    const rows = await viewRows(rustProfile, src);
    const folds = rows.filter((r) => r.kind === "fold");
    expect(folds.map((f) => f.kind === "fold" && f.text)).toEqual([
      "use × 2（std::collections::HashMap、std::io）",
      "struct Point { x, y }",
      "enum Status { Active, Banned }",
      "trait Shape { area }",
    ]);
  });

  test("被抹空的行（如 where 子句残留）不占行", async () => {
    const src = `fn f<T>(x: T) -> T
where
    T: Clone + Default,
{
    x
}
`;
    const rows = await viewRows(rustProfile, src);
    expect(rows.map((r) => (r.kind === "line" ? `${r.src}:${r.text}` : r.text))).toEqual([
      "1:fn f(x)",
      "4:{",
      "5:    x",
      "6:}",
    ]);
  });
});

describe("rowIndexOfLine", () => {
  test("行号命中行与折叠区间，缺失时找其后最近行", async () => {
    const src = `import { a } from "./a";

interface P {
  x: number;
}

export const x = a;
`;
    const rows = await viewRows(typescriptProfile, src);
    expect(rowIndexOfLine(rows, 1)).toBe(0); // import 折叠
    expect(rowIndexOfLine(rows, 3)).toBe(2); // interface 折叠（srcRange 3-5）
    expect(rowIndexOfLine(rows, 7)).toBe(4); // export 行
  });
});

describe("工程机制擦除", () => {
  test("rust：? / unwrap / clone / into / to_string 擦除", async () => {
    const src = `fn load(path: &str) -> Result<String, std::io::Error> {
    let text = std::fs::read_to_string(path)?;
    let owned = text.clone();
    let s: String = owned.into();
    let t = s.to_string();
    Ok(t)
}
`;
    const out = await simplify(rustProfile, src);
    expect(out).toEqual([
      "fn load(path) {",
      "    let text = std::fs::read_to_string(path);",
      "    let owned = text;",
      "    let s = owned;",
      "    let t = s;",
      "    Ok(t)",
      "}",
      "",
    ]);
  });

  test("rust：带参数的机制同名调用不擦除", async () => {
    const src = `fn f(x: Option<i32>) -> i32 {
    x.unwrap_or(0)
}
`;
    const out = await simplify(rustProfile, src);
    expect(out[1]).toBe("    x.unwrap_or(0)");
  });

  test("ts：可选链擦除为普通成员访问", async () => {
    const src = `const x = a?.b?.c;
const y = d?.e();
const z = w ?? 0;
`;
    const out = await simplify(typescriptProfile, src);
    expect(out[0]).toBe("const x = a.b.c;");
    expect(out[1]).toBe("const y = d.e();");
    expect(out[2]).toBe("const z = w ?? 0;");
  });
});
