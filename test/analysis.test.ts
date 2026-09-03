import { describe, expect, test } from "bun:test";
import { pythonProfile } from "../src/analysis/langs/python";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import { analyzeFile, insertBodyNotes } from "../src/analysis/project";
import type { SRow } from "../src/analysis/simplify";
import type { ChangeUnit } from "../src/analysis/types";

function lines(...ns: number[]): Set<number> {
  return new Set(ns);
}

const BASE = `export interface Point {
  x: number;
  y: number;
}

export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return \`hi \${name}\`;
}
`;

describe("analyzeFile", () => {
  test("body-only 变更：签名不变，body 有结构化摘要", async () => {
    const next = BASE.replace("return `hi ${name}`;", "return `hello ${name}!`;");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(11), lines(11), "zh-CN");
    expect(p.units).toHaveLength(1);
    const u = p.units[0]!;
    expect(u.change).toBe("body");
    expect(u.name).toBe("greet");
    expect(u.bodySummary?.[0]?.kind).toBe("return_statement");
    expect(u.bodySummary?.[0]?.newLn).toBe(11);
    expect(p.summary.body).toBe(1);
  });

  test("签名变更：加参数，带新旧签名", async () => {
    const next = BASE.replace(
      "add(a: number, b: number)",
      "add(a: number, b: number, c?: number)",
    );
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(6), lines(6), "zh-CN");
    expect(p.units).toHaveLength(1);
    const u = p.units[0]!;
    expect(u.change).toBe("signature");
    expect(u.name).toBe("add");
    expect(u.signature).toContain("c?: number");
    expect(u.oldSignature).not.toContain("c?: number");
  });

  test("类型级变更：interface 加成员，归为 type-only", async () => {
    const next = BASE.replace("  y: number;\n}", "  y: number;\n  z?: number;\n}");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(), lines(4), "zh-CN");
    expect(p.units).toHaveLength(1);
    const u = p.units[0]!;
    expect(u.change).toBe("type-only");
    expect(u.name).toBe("Point");
    expect(u.typeText).toContain("z?: number");
  });

  test("新增文件：所有声明归为 added", async () => {
    const src = `export function square(n: number): number {\n  return n * n;\n}\n`;
    const p = await analyzeFile(typescriptProfile, null, src, lines(), lines(1, 2, 3), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.change).toBe("added");
    expect(p.units[0]!.name).toBe("square");
  });

  test("删除文件：所有声明归为 removed", async () => {
    const src = `export function square(n: number): number {\n  return n * n;\n}\n`;
    const p = await analyzeFile(typescriptProfile, src, "", lines(1, 2, 3), lines(), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.change).toBe("removed");
    expect(p.units[0]!.oldSignature).toContain("square");
  });

  test("纯删除行不应误判为 removed（配对基于全量声明）", async () => {
    const old = `export function f(): number {
  const a = 1;
  const b = 2;
  return a + b;
}
`;
    const next = `export function f(): number {
  const a = 1;
  return a;
}
`;
    const p = await analyzeFile(typescriptProfile, old, next, lines(3, 4), lines(3), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.change).toBe("body");
    expect(p.units[0]!.name).toBe("f");
  });

  test("import 等声明之外的变更归入兜底单元", async () => {
    const old = `import { a } from "./a";\nexport const x = a;\n`;
    const next = `import { b } from "./b";\nexport const x = b;\n`;
    const p = await analyzeFile(typescriptProfile, old, next, lines(1, 2), lines(1, 2), "zh-CN");
    const kinds = p.units.map((u) => u.kind).sort();
    expect(kinds).toEqual(["other", "variable"]);
  });

  test("类成员变更不产生重复的类级单元", async () => {
    const old = `export class Foo {
  bar(): number {
    return 1;
  }
}
`;
    const next = old.replace("return 1;", "return 2;");
    const p = await analyzeFile(typescriptProfile, old, next, lines(3), lines(3), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.name).toBe("bar");
    expect(p.units[0]!.change).toBe("body");
  });

  test("类签名（继承关系）变更", async () => {
    const old = `export class A extends B {\n  x = 1;\n}\n`;
    const next = `export class A extends C {\n  x = 1;\n}\n`;
    const p = await analyzeFile(typescriptProfile, old, next, lines(1), lines(1), "zh-CN");
    const sig = p.units.find((u) => u.change === "signature");
    expect(sig?.name).toBe("A");
    expect(sig?.signature).toContain("extends C");
    expect(sig?.oldSignature).toContain("extends B");
  });

  test("注释变更归入兜底单元并标注为注释变更", async () => {
    const next = BASE.replace(
      "export function greet(name: string): string {",
      "// 打招呼\nexport function greet(name: string): string {",
    );
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(), lines(10), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.kind).toBe("other");
    expect(p.units[0]!.name).toBe("注释变更");
  });

  test("英文 locale：兜底单元名随之切换", async () => {
    const next = BASE.replace(
      "export function greet(name: string): string {",
      "// greeting\nexport function greet(name: string): string {",
    );
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(), lines(10), "en");
    expect(p.units[0]!.kind).toBe("other");
    expect(p.units[0]!.name).toBe("Comment changes");
  });
});

describe("领域模型成员（domain）", () => {
  test("类型加成员：members 全量、added 定位新增", async () => {
    const next = BASE.replace("  y: number;\n}", "  y: number;\n  z?: number;\n}");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(), lines(4), "zh-CN");
    const u = p.units.find((x) => x.name === "Point")!;
    expect(u.change).toBe("type-only");
    expect(u.domain?.members).toEqual(["x", "y", "z"]);
    expect(u.domain?.added).toEqual(["z"]);
    expect(u.domain?.removed).toEqual([]);
  });

  test("类型删成员：removed 定位删除", async () => {
    const next = BASE.replace("  y: number;\n}", "}");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(3), lines(), "zh-CN");
    const u = p.units.find((x) => x.name === "Point")!;
    expect(u.domain?.members).toContain("x");
    expect(u.domain?.removed).toEqual(["y"]);
    expect(u.domain?.added).toEqual([]);
  });

  test("新增接口：members 即全量且全为 added", async () => {
    const src = `export interface Order {\n  id: string;\n  amount: number;\n}\n`;
    const p = await analyzeFile(typescriptProfile, null, src, lines(), lines(1, 2, 3, 4), "zh-CN");
    const u = p.units.find((x) => x.name === "Order")!;
    expect(u.change).toBe("added");
    expect(u.domain?.members).toEqual(["id", "amount"]);
    expect(u.domain?.added).toEqual(["id", "amount"]);
  });

  test("纯类型细节变更（成员无增减）：不挂 domain，不进形状信号", async () => {
    const next = BASE.replace("  x: number;\n", "  x: string;\n");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(), lines(2), "zh-CN");
    const u = p.units.find((x) => x.name === "Point")!;
    expect(u.change).toBe("type-only");
    expect(u.domain).toBeUndefined();
  });

  test("排序：成员增减的形状信号先于普通实现，纯类型细节仍在末尾", async () => {
    const next = BASE.replace("  y: number;\n}", "  y: number;\n  z?: number;\n}").replace(
      "return `hi ${name}`;",
      "return `hello ${name}!`;",
    );
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(11), lines(4, 11), "zh-CN");
    expect(p.units.map((u) => u.name)).toEqual(["Point", "greet"]);
    // 纯细节变更无 domain，排在实现之后
    const detail = BASE.replace("  x: number;\n", "  x: string;\n").replace(
      "return `hi ${name}`;",
      "return `hello ${name}!`;",
    );
    const p2 = await analyzeFile(typescriptProfile, BASE, detail, lines(11), lines(2, 11), "zh-CN");
    expect(p2.units.map((u) => u.name)).toEqual(["greet", "Point"]);
  });

  test("函数变更不带 domain（含方法的普通类也不带）", async () => {
    const next = BASE.replace("return `hi ${name}`;", "return `hello ${name}!`;");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(11), lines(11), "zh-CN");
    expect(p.units[0]!.domain).toBeUndefined();
    const cls = `export class Foo {\n  bar(): number {\n    return 1;\n  }\n}\n`;
    const p2 = await analyzeFile(
      typescriptProfile,
      cls,
      cls.replace("return 1;", "return 2;"),
      lines(3),
      lines(3),
      "zh-CN",
    );
    expect(p2.units[0]!.domain).toBeUndefined();
  });

  test("Python 纯数据类加字段：类级单元带 domain（成员增删）", async () => {
    const old = `@dataclass\nclass Item:\n  sku: str\n`;
    const next = `@dataclass\nclass Item:\n  sku: str\n  qty: int = 0\n`;
    const p = await analyzeFile(pythonProfile, old, next, lines(), lines(4), "zh-CN");
    const u = p.units.find((x) => x.name === "Item")!;
    expect(u.domain?.members).toEqual(["sku", "qty"]);
    expect(u.domain?.added).toEqual(["qty"]);
  });
});

describe("insertBodyNotes：实现摘要注释行", () => {
  const unit = (items: Array<[number, string]>, range: [number, number] = [1, 8]): ChangeUnit => ({
    id: "f:0",
    kind: "function",
    name: "price",
    container: "",
    change: "body",
    newRange: range,
    bodySummary: items.map(([newLn, preview]) => ({
      kind: "x",
      preview,
      newLn,
      changedLines: 1,
    })),
  });

  test("插入到单元范围内首行之前，预览取简化文本", () => {
    const rows: SRow[] = [
      { kind: "ctx", text: "function price(user) {", oldLn: 1, newLn: 1 },
      { kind: "del", text: "  let total = 0;", oldLn: 2 },
      { kind: "add", text: "  let total = 1;", newLn: 2 },
    ];
    // 新侧简化行：第 3 行类型注解已被擦除（preview 原始含类型）
    const newLines = [
      "function price(user) {",
      "  let total = 1;",
      "  if (user.vip) {",
      "  return total * 2;",
    ];
    const u = unit([
      [2, "let total = 1;"],
      [3, "if (user.vip: boolean) {"], // 原始预览带类型，应被简化行替换
      [4, "return total * 2;"],
    ]);
    const out = insertBodyNotes(rows, [u], newLines, "zh-CN");
    expect(out.map((r) => r.kind)).toEqual(["note", "ctx", "del", "add"]);
    expect(out[0]).toMatchObject({
      kind: "note",
      text: "实现变化：let total = 1;；if (user.vip) {；return total * 2;",
    });
  });

  test("单条摘要不产注释行（行流中自明）", () => {
    const rows: SRow[] = [{ kind: "add", text: "x();", newLn: 2 }];
    const out = insertBodyNotes(rows, [unit([[2, "x();"]])], null, "zh-CN");
    expect(out).toHaveLength(1);
  });

  test("超过 3 条截断并显示总数；英文措辞", () => {
    const rows: SRow[] = [{ kind: "add", text: "x();", newLn: 2 }];
    const u = unit([
      [2, "a();"],
      [3, "b();"],
      [4, "c();"],
      [5, "d();"],
      [6, "e();"],
    ]);
    const out = insertBodyNotes(rows, [u], null, "en");
    expect(out[0]).toMatchObject({
      kind: "note",
      text: "Body changes: a();; b();; c(); (5 total)",
    });
  });

  test("单元范围内无可挂行时摘要被放弃，不影响后续单元", () => {
    const rows: SRow[] = [{ kind: "add", text: "x();", newLn: 20 }];
    const lost = unit(
      [
        [3, "a();"],
        [4, "b();"],
      ],
      [1, 5],
    );
    const hit = unit(
      [
        [20, "c();"],
        [21, "d();"],
      ],
      [18, 22],
    );
    const out = insertBodyNotes(rows, [lost, hit], null, "zh-CN");
    expect(out.map((r) => r.kind)).toEqual(["note", "add"]);
    expect(out[0]).toMatchObject({ text: "实现变化：c();；d();" });
  });

  test("signature/added/removed 单元不产注释行", () => {
    const rows: SRow[] = [{ kind: "add", text: "x();", newLn: 2 }];
    const sig: ChangeUnit = {
      id: "s:0",
      kind: "function",
      name: "s",
      container: "",
      change: "signature",
      newRange: [1, 3],
      signature: "function s()",
      oldSignature: "function s(a)",
    };
    const out = insertBodyNotes(rows, [sig], null, "zh-CN");
    expect(out).toHaveLength(1);
  });
});
