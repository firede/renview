import { describe, expect, test } from "bun:test";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import { analyzeFile } from "../src/analysis/project";

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
