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
  type SRow,
} from "../src/analysis/simplify";

async function simplify(profile: LanguageProfile, source: string): Promise<string[]> {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("测试源码解析出错");
  return applySimplify(source, collectSimplifyOps(tree.rootNode, source, profile.simplify!)).lines;
}

/** 简化 + 擦除记录（P0 hover 披露的数据源） */
async function simplifyWithErasures(profile: LanguageProfile, source: string) {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("测试源码解析出错");
  return applySimplify(source, collectSimplifyOps(tree.rootNode, source, profile.simplify!));
}

// 完整函数样例：保留词频统计流程，擦除类型与借用语法。
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
  test("词频统计流程保留，类型与借用语法擦除", async () => {
    const out = await simplify(rustProfile, RUST_IN);
    expect(out.join("\n")).toBe(RUST_EXPECTED);
  });

  test("机制调用嵌套链全部擦除（a.clone().unwrap() → a）", async () => {
    const out = await simplify(rustProfile, `let w = a.clone().unwrap();\n`);
    expect(out).toEqual(["let w = a;", ""]);
  });

  test("引用擦除：&x → x、&mut x → x", async () => {
    const out = await simplify(rustProfile, `let p = &x;\nlet q = &mut y;\n`);
    expect(out).toEqual(["let p = x;", "let q = y;", ""]);
  });
});

describe("ts 简化器", () => {
  test("接口字段与函数参数保留，类型标注擦除", async () => {
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

  test("跨行链式调用只删 ! 本身：每行内容保留、行对齐不破坏", async () => {
    const src = `const root = tag
  .trim()
  .split(/x/, 1)[0]!
  .replace(/y/g, "-")
  .split("-", 1)[0]!
  .toLowerCase();
`;
    const out = await simplify(typescriptProfile, src);
    expect(out).toEqual([
      "const root = tag",
      "  .trim()",
      "  .split(/x/, 1)[0]",
      '  .replace(/y/g, "-")',
      '  .split("-", 1)[0]',
      "  .toLowerCase();",
      "",
    ]);
  });
});

describe("buildSimplifiedRows", () => {
  function mkFile(changes: ParsedFile["chunks"][number]["changes"]): ParsedFile {
    return { chunks: [{ changes }], from: "a.ts", to: "a.ts", deletions: 0, additions: 0 };
  }

  test("对象类型别名：字段增删直接可见，类型细节折叠且可取回", async () => {
    const oldSrc = "export type Order = {\n  id: number;\n  legacy: string;\n};";
    const newSrc = "export type Order = {\n  id: string;\n  total: number;\n};";
    const file = mkFile([
      { type: "normal", ln1: 1, ln2: 1, content: " export type Order = {" },
      { type: "del", ln: 2, content: "-  id: number;" },
      { type: "del", ln: 3, content: "-  legacy: string;" },
      { type: "add", ln: 2, content: "+  id: string;" },
      { type: "add", ln: 3, content: "+  total: number;" },
      { type: "normal", ln1: 4, ln2: 4, content: " };" },
    ]);
    const result = buildSimplifiedRows(
      file,
      await simplifyWithErasures(typescriptProfile, oldSrc),
      await simplifyWithErasures(typescriptProfile, newSrc),
    );
    expect(result.rows).toContainEqual(
      expect.objectContaining({ kind: "del", text: "  legacy;", oldLn: 3 }),
    );
    expect(result.rows).toContainEqual(
      expect.objectContaining({ kind: "add", text: "  total;", newLn: 3 }),
    );
    expect(result.rows).toContainEqual(
      expect.objectContaining({
        kind: "fold",
        oldLines: ["  id: number;"],
        newLines: ["  id: string;"],
      }),
    );
    expect(result.stats).toEqual({ folded: 1, visible: 2 });
  });

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

  test("参数增减（形状变化）在简化后依然可见，且行对被打上 pair id", async () => {
    const oldSrc = `export function add(a: number, b: number): number {\n}\n`;
    const newSrc = `export function add(a: number, b: number, c?: number): number {\n}\n`;
    const oldS = await simplifyWithErasures(typescriptProfile, oldSrc);
    const newS = await simplifyWithErasures(typescriptProfile, newSrc);
    const file = mkFile([
      { type: "del", ln: 1, content: "-export function add(a: number, b: number): number {" },
      {
        type: "add",
        ln: 1,
        content: "+export function add(a: number, b: number, c?: number): number {",
      },
    ]);
    const { rows, stats } = buildSimplifiedRows(file, oldS, newS);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "del", text: "export function add(a, b) {", oldLn: 1 });
    expect(rows[1]).toMatchObject({
      kind: "add",
      text: "export function add(a, b, c) {",
      newLn: 1,
    });
    expect(stats.visible).toBe(2);
    // 配对：del/add 携带相同 pair id；擦除记录随行透传
    expect(rows[0]!.kind === "del" && rows[0]!.pair).toBeTruthy();
    expect(
      rows[0]!.kind === "del" && rows[1]!.kind === "add" && rows[0]!.pair === rows[1]!.pair,
    ).toBe(true);
    expect(rows[0]!.kind === "del" && rows[0]!.erases!.some((e) => e.original === ": number")).toBe(
      true,
    );
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
});

describe("擦除记录（hover 披露数据源）", () => {
  test("ts：类型标注为零宽删除点，?. 替换记录覆盖替换文本", async () => {
    const { lines, erasures } = await simplifyWithErasures(
      typescriptProfile,
      `const x: number = a?.b;\n`,
    );
    expect(lines[0]).toBe("const x = a.b;");
    // `: number` 删除点落在 "const x" 之后（列 7），零宽；`?.` → `.` 区间覆盖替换后的 "."
    expect(erasures[0]).toEqual([
      { start: 7, end: 7, original: ": number" },
      { start: 11, end: 12, original: "?." },
    ]);
  });

  test("rust：数字后缀替换记录原文；无擦除的行为空数组", async () => {
    const { lines, erasures } = await simplifyWithErasures(
      rustProfile,
      `let n = 0u32;\nlet m = n;\n`,
    );
    expect(lines[0]).toBe("let n = 0;");
    expect(erasures[0]).toEqual([{ start: 8, end: 9, original: "0u32" }]);
    expect(erasures[1]).toEqual([]);
  });

  test("源中相邻的连续擦除合并为一个标记（`?` + `: T`）", async () => {
    const { lines, erasures } = await simplifyWithErasures(
      typescriptProfile,
      `function f(c?: number) {}\n`,
    );
    expect(lines[0]).toBe("function f(c) {}");
    expect(erasures[0]).toEqual([{ start: 12, end: 12, original: "?: number" }]);
  });

  test("跨行擦除逐行记录：每行的删除点落在本行内", async () => {
    const src = `let v = foo
    .bar()
    .baz()?;
`;
    const { lines, erasures } = await simplifyWithErasures(rustProfile, src);
    expect(lines).toEqual(["let v = foo", "    .bar()", "    .baz();", ""]);
    // `?` 在第三行（下标 2），其余行无擦除
    expect(erasures[0]).toEqual([]);
    expect(erasures[1]).toEqual([]);
    expect(erasures[2]).toHaveLength(1);
    expect(erasures[2]![0]!.original).toBe("?");
  });
});

describe("del/add 相似度配对", () => {
  function mkFile(changes: ParsedFile["chunks"][number]["changes"]): ParsedFile {
    return { chunks: [{ changes }], from: "a.ts", to: "a.ts", deletions: 0, additions: 0 };
  }

  test("相似行对配对，无关行不配对", async () => {
    const oldSrc = `const x = compute();
return a + b;
`;
    const newSrc = `console.log('done');
return a + c;
`;
    const oldS = await simplify(typescriptProfile, oldSrc);
    const newS = await simplify(typescriptProfile, newSrc);
    const file = mkFile([
      { type: "del", ln: 1, content: "-const x = compute();" },
      { type: "del", ln: 2, content: "-return a + b;" },
      { type: "add", ln: 1, content: "+console.log('done');" },
      { type: "add", ln: 2, content: "+return a + c;" },
    ]);
    const { rows } = buildSimplifiedRows(file, oldS, newS);
    expect(rows.map((r) => r.kind)).toEqual(["del", "del", "add", "add"]);
    const at = (i: number) => rows[i] as Extract<SRow, { kind: "ctx" | "del" | "add" }>;
    const [d1, d2, a1, a2] = [at(0), at(1), at(2), at(3)];
    // return 行配对；compute 与 console.log 行不配对
    expect(d2.pair).toBeTruthy();
    expect(d2.pair).toBe(a2.pair);
    expect(d1.pair).toBeUndefined();
    expect(a1.pair).toBeUndefined();
  });

  test("配对不跨 del/add 块", async () => {
    const oldSrc = `alpha = 1;
beta = 2;
`;
    const newSrc = `beta = 2;
alpha = 2;
`;
    const file = mkFile([
      { type: "del", ln: 1, content: "-alpha = 1;" },
      { type: "normal", ln1: 2, ln2: 1, content: " beta = 2;" },
      { type: "add", ln: 2, content: "+alpha = 2;" },
    ]);
    const { rows } = buildSimplifiedRows(
      file,
      await simplify(typescriptProfile, oldSrc),
      await simplify(typescriptProfile, newSrc),
    );
    const del = rows[0]!;
    const add = rows[2]!;
    expect(del.kind === "del" && del.pair).toBeUndefined();
    expect(add.kind === "add" && add.pair).toBeUndefined();
  });
});

// 行扫描游标必须保留跨行擦除、空行与相邻操作的边界行为。
test("跨行替换只落首行，后续擦除与新操作不丢失", () => {
  const source = "abc\n\ndef\nxyz";
  const result = applySimplify(source, [
    { start: 1, end: 7, replacement: "…" },
    { start: 9, end: 10 },
  ]);
  expect(result.lines).toEqual(["a…", "", "f", "yz"]);
  expect(result.erasures).toEqual([
    [{ start: 1, end: 2, original: "bc" }],
    [],
    [{ start: 0, end: 0, original: "de" }],
    [{ start: 0, end: 0, original: "x" }],
  ]);
});
