import { describe, expect, test } from "bun:test";
import { rustProfile } from "../src/analysis/langs/rust";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import type { LanguageProfile } from "../src/analysis/langs/types";
import type { ParsedFile } from "../src/analysis/map";
import { parseSource } from "../src/analysis/parser";
import {
  applySimplify,
  buildSimplifiedRows,
  collectSimplifyOps,
} from "../src/analysis/simplify";

async function simplify(profile: LanguageProfile, source: string): Promise<string[]> {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("测试源码解析出错");
  return applySimplify(source, collectSimplifyOps(tree.rootNode, source, profile.simplify!));
}

// rust-beautifier 参考站截图的输入/输出，作为 golden test
const RUST_IN = `use std::collections::HashMap;

fn tally<'a, I: Iterator<Item = &'a str>>(words: I) -> HashMap<&'a str, u32> {
    let mut counts: HashMap<&'a str, u32> = HashMap::new();
    for word in words {
        *counts.entry(word).or_insert(0u32) += 1;
    }
    counts
}

fn main() {
    let text: &'static str = "beautiful code is motivating code";
    let counts: HashMap<&str, u32> = tally(text.split_whitespace());
    let mut pairs: Vec<(&str, u32)> = counts.into_iter().collect::<Vec<(&str, u32)>>();
    pairs.sort_by(|a: &(&str, u32), b: &(&str, u32)| b.1.cmp(&a.1));
    println!("{:?}", pairs);
}
`;

const RUST_EXPECTED = `use std::collections::HashMap;

fn tally(words) {
    let mut counts = HashMap::new();
    for word in words {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}

fn main() {
    let text = "beautiful code is motivating code";
    let counts = tally(text.split_whitespace());
    let mut pairs = counts.into_iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(a.1));
    println!("{:?}", pairs);
}
`;

describe("rust 简化器", () => {
  test("golden：对齐 rust-beautifier 参考输出", async () => {
    const out = await simplify(rustProfile, RUST_IN);
    expect(out.join("\n")).toBe(RUST_EXPECTED);
  });
});

describe("ts 简化器", () => {
  test("类型标注/泛型/返回类型/可选标记擦除", async () => {
    const src = `export interface Point {
  x: number;
  y: number;
}

export function add(a: number, b: number): number {
  return a + b;
}
`;
    const out = await simplify(typescriptProfile, src);
    expect(out).toEqual([
      "export interface Point {",
      "  x;",
      "  y;",
      "}",
      "",
      "export function add(a, b) {",
      "  return a + b;",
      "}",
      "",
    ]);
  });

  test("as / 非空断言 / 类型别名桩", async () => {
    const src = `type F = A | B;
const x = foo() as Bar;
const y = baz!.qux satisfies Q;
`;
    const out = await simplify(typescriptProfile, src);
    expect(out).toEqual(["type F;", "const x = foo();", "const y = baz.qux;", ""]);
  });
});

describe("buildSimplifiedRows", () => {
  function mkFile(changes: ParsedFile["chunks"][number]["changes"]): ParsedFile {
    return { chunks: [{ changes }], from: "a.ts", to: "a.ts", deletions: 0, additions: 0 };
  }

  test("简化后相同的行对折叠，真实变更保留", async () => {
    const oldSrc = `export function f(a: string): string {
  return a;
}
`;
    const newSrc = `export function f(a: string): number {
  return a;
}
`;
    const oldS = await simplify(typescriptProfile, oldSrc);
    const newS = await simplify(typescriptProfile, newSrc);
    const file = mkFile([
      { type: "del", ln: 1, content: "-export function f(a: string): string {" },
      { type: "add", ln: 1, content: "+export function f(a: string): number {" },
      { type: "normal", ln1: 2, ln2: 2, content: "   return a;" },
    ]);
    const { rows, stats } = buildSimplifiedRows(file, oldS, newS);
    expect(rows[0]!.kind).toBe("fold");
    expect(rows[1]).toMatchObject({ kind: "ctx", text: "  return a;" });
    expect(stats.folded).toBe(1);
    expect(stats.visible).toBe(0);
  });

  test("参数增减（形状变化）在简化后依然可见", async () => {
    const oldSrc = `export function add(a: number, b: number): number {\n}\n`;
    const newSrc = `export function add(a: number, b: number, c?: number): number {\n}\n`;
    const oldS = await simplify(typescriptProfile, oldSrc);
    const newS = await simplify(typescriptProfile, newSrc);
    const file = mkFile([
      { type: "del", ln: 1, content: "-export function add(a: number, b: number): number {" },
      { type: "add", ln: 1, content: "+export function add(a: number, b: number, c?: number): number {" },
    ]);
    const { rows, stats } = buildSimplifiedRows(file, oldS, newS);
    expect(rows).toEqual([
      { kind: "del", text: "export function add(a, b) {", oldLn: 1, newLn: undefined },
      { kind: "add", text: "export function add(a, b, c) {", oldLn: undefined, newLn: 1 },
    ]);
    expect(stats.visible).toBe(2);
  });

  test("interface 成员类型变化折叠、成员增减可见", async () => {
    const oldSrc = `interface Point {
  x: number;
  y: number;
}
`;
    const newSrc = `interface Point {
  x: number;
  y: string;
  z?: number;
}
`;
    const oldS = await simplify(typescriptProfile, oldSrc);
    const newS = await simplify(typescriptProfile, newSrc);
    const file = mkFile([
      { type: "normal", ln1: 1, ln2: 1, content: " interface Point {" },
      { type: "normal", ln1: 2, ln2: 2, content: "   x: number;" },
      { type: "del", ln: 3, content: "-  y: number;" },
      { type: "add", ln: 3, content: "+  y: string;" },
      { type: "add", ln: 4, content: "+  z?: number;" },
      { type: "normal", ln1: 4, ln2: 5, content: " }" },
    ]);
    const { rows, stats } = buildSimplifiedRows(file, oldS, newS);
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toEqual(["ctx", "ctx", "fold", "add", "ctx"]);
    expect(rows[3]).toMatchObject({ kind: "add", text: "  z;" });
    expect(stats.folded).toBe(1);
    expect(stats.visible).toBe(1);
  });

  test("新增空行不进折叠，以普通空行呈现", () => {
    const file = mkFile([{ type: "add", ln: 1, content: "+" }]);
    const { rows, stats } = buildSimplifiedRows(file, [], [""]);
    expect(rows).toEqual([{ kind: "add", text: "", oldLn: undefined, newLn: 1 }]);
    expect(stats).toEqual({ folded: 0, visible: 1 });
  });

  test("删除空行不进折叠", () => {
    const file = mkFile([{ type: "del", ln: 1, content: "-" }]);
    const { rows, stats } = buildSimplifiedRows(file, [""], []);
    expect(rows).toEqual([{ kind: "del", text: "", oldLn: 1, newLn: undefined }]);
    expect(stats).toEqual({ folded: 0, visible: 1 });
  });

  test("被抹空的非空行仍然折叠", () => {
    const file = mkFile([{ type: "add", ln: 1, content: "+x: string;" }]);
    const { rows, stats } = buildSimplifiedRows(file, [], [""]);
    expect(rows[0]!.kind).toBe("fold");
    expect(stats.folded).toBe(1);
  });

  test("空行不消耗被抹空行的配对：空行直接呈现，被抹空行单独折叠", () => {
    const file = mkFile([
      { type: "del", ln: 1, content: "-" },
      { type: "add", ln: 1, content: "+x: string;" },
    ]);
    const { rows, stats } = buildSimplifiedRows(file, [""], [""]);
    expect(rows.map((r) => r.kind)).toEqual(["del", "fold"]);
    expect(stats).toEqual({ folded: 1, visible: 1 });
  });

  test("被抹空的非空 del 与空行 add 仍可配对折叠", () => {
    const file = mkFile([
      { type: "del", ln: 1, content: "-x: string;" },
      { type: "add", ln: 1, content: "+" },
    ]);
    const { rows, stats } = buildSimplifiedRows(file, [""], [""]);
    expect(rows[0]!.kind).toBe("fold");
    expect(stats.folded).toBe(1);
  });
});
