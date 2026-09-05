import { describe, expect, test } from "bun:test";
import { pythonProfile } from "../src/analysis/langs/python";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import { analyzeFile, outlineOf, withParsedSides } from "../src/analysis/project";

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
  test("函数实现变更归属到函数", async () => {
    const next = BASE.replace("return `hi ${name}`;", "return `hello ${name}!`;");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(11), lines(11), "zh-CN");
    expect(p.units).toHaveLength(1);
    const u = p.units[0]!;
    expect(u.change).toBe("body");
    expect(u.name).toBe("greet");
    expect(u.domain).toBeUndefined();
    expect(p.summary.body).toBe(1);
  });

  test("签名变更：加参数，带新旧签名", async () => {
    const next = BASE.replace("add(a: number, b: number)", "add(a: number, b: number, c?: number)");
    const p = await analyzeFile(typescriptProfile, BASE, next, lines(6), lines(6), "zh-CN");
    expect(p.units).toHaveLength(1);
    const u = p.units[0]!;
    expect(u.change).toBe("signature");
    expect(u.name).toBe("add");
    expect(u.signature).toContain("c?: number");
    expect(u.oldSignature).not.toContain("c?: number");
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
  return a;
}
`;
    const next = `export function f(): number {
  const a = 1;
  return a;
}
`;
    const p = await analyzeFile(typescriptProfile, old, next, lines(3), lines(), "zh-CN");
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
    expect(p.units[0]!.domain).toBeUndefined();
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
    expect(p.units).toHaveLength(1);
    expect(u.typeText).toContain("z?: number");
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

  test("Python 纯数据类加字段：类级单元带 domain（成员增删）", async () => {
    const old = `@dataclass\nclass Item:\n  sku: str\n`;
    const next = `@dataclass\nclass Item:\n  sku: str\n  qty: int = 0\n`;
    const p = await analyzeFile(pythonProfile, old, next, lines(), lines(4), "zh-CN");
    const u = p.units.find((x) => x.name === "Item")!;
    expect(u.domain?.members).toEqual(["sku", "qty"]);
    expect(u.domain?.added).toEqual(["qty"]);
  });
});

describe("声明收集覆盖：装饰器与签名型声明", () => {
  for (const removed of [false, true]) {
    test(`${removed ? "删除" : "新增"}重载并修改实现：正文保持独立配对`, async () => {
      const signature = "export function find(id: string): string;\n";
      const overload = "export function find(id: number): number;\n";
      const old =
        signature +
        (removed ? overload : "") +
        "export function find(id: any): any { return id; }\n";
      const next =
        signature +
        (removed ? "" : overload) +
        "export function find(id: any): any { return lookup(id); }\n";
      const p = await analyzeFile(
        typescriptProfile,
        old,
        next,
        removed ? lines(2, 3) : lines(2),
        removed ? lines(2) : lines(2, 3),
        "zh-CN",
      );
      expect(p.units).toHaveLength(2);
      const body = p.units.find((u) => u.change === "body")!;
      expect(body.oldRange).toEqual(removed ? [3, 3] : [2, 2]);
      expect(body.newRange).toEqual(removed ? [2, 2] : [3, 3]);
      const changed = p.units.find((u) => u.change === (removed ? "removed" : "added"))!;
      expect(removed ? changed.oldSignature : changed.signature).toBe(overload.trim());
      expect(p.summary["type-only"]).toBe(0);
    });
  }

  test("仅新增重载：不把未改动的实现报为变更", async () => {
    const old = "function find(id: string): string;\nfunction find(id: any): any { return id; }\n";
    const next = old.replace(
      "function find(id: any)",
      "function find(id: number): number;\nfunction find(id: any)",
    );
    const p = await analyzeFile(typescriptProfile, old, next, lines(), lines(2), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.change).toBe("added");
    expect(p.units[0]!.signature).toBe("function find(id: number): number;");
  });

  test("装饰器 + export class：方法签名正常成单元，类进大纲", async () => {
    const old = `@Injectable()
export class OrderService {
  getOrder(id: string): string {
    return id;
  }
}
`;
    const next = `@Injectable()
export class OrderService {
  getOrder(id: string, full = false): string {
    return id;
  }
}
`;
    const p = await analyzeFile(typescriptProfile, old, next, lines(3), lines(3), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.change).toBe("signature");
    expect(p.units[0]!.name).toBe("getOrder");
    const outline = await withParsedSides(typescriptProfile, null, next, (_, side) =>
      outlineOf(typescriptProfile, side!.tree, "zh-CN"),
    );
    expect(outline.map((o) => o.name)).toEqual(["OrderService", "getOrder"]);
  });

  test("非导出装饰器类：decorator 在 class_declaration 内，同样可收集", async () => {
    const src = `@Component()\nclass Card {}\n`;
    const p = await analyzeFile(typescriptProfile, null, src, lines(), lines(1, 2), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.name).toBe("Card");
  });

  test("顶层重载签名变更：type-only 单元而非'声明之外的变更'兜底", async () => {
    const old = `function find(id: string): Item;\nfunction find(ids: string[]): Item[];\n`;
    const next = `function find(id: string): Item | null;\nfunction find(ids: string[]): Item[];\n`;
    const p = await analyzeFile(typescriptProfile, old, next, lines(1), lines(1), "zh-CN");
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.change).toBe("type-only");
    expect(p.units[0]!.name).toBe("find");
    expect(p.units[0]!.typeText).toContain("Item | null");
  });

  test("declare function 可收集", async () => {
    const p = await analyzeFile(
      typescriptProfile,
      null,
      `declare function g(): void;\n`,
      lines(),
      lines(1),
      "zh-CN",
    );
    expect(p.units).toHaveLength(1);
    expect(p.units[0]!.name).toBe("g");
  });
});
