import { describe, expect, test } from "bun:test";
import { importFolder } from "../src/analysis/importfold";
import { goProfile } from "../src/analysis/langs/go";
import { rustProfile } from "../src/analysis/langs/rust";
import { typescriptProfile } from "../src/analysis/langs/typescript";
import type { LanguageProfile } from "../src/analysis/langs/types";
import type { ParsedFile } from "../src/analysis/map";
import { parseSide, withParsedSides } from "../src/analysis/project";
import { analyzeFile } from "../src/analysis/service";
import { buildSimplifiedRows, simplifyTree } from "../src/analysis/simplify";

/** 两侧源码 → 简化 diff 行（与 service.analyzeFile 同一条装配线） */
async function rowsOf(profile: LanguageProfile, file: ParsedFile, oldSrc: string, newSrc: string) {
  return withParsedSides(profile, oldSrc, newSrc, (o, n) =>
    buildSimplifiedRows(
      file,
      o ? simplifyTree(o.tree, o.source, profile.simplify!) : null,
      n ? simplifyTree(n.tree, n.source, profile.simplify!) : null,
      null,
      importFolder(profile, o, n, "zh-CN"),
    ),
  );
}

function mkFile(changes: ParsedFile["chunks"][number]["changes"]): ParsedFile {
  return { chunks: [{ changes }], from: "a.ts", to: "a.ts", deletions: 0, additions: 0 };
}

describe("importFolder", () => {
  test("行号落在顶层 import 内才算 import；摘要列出新增与删除的模块", async () => {
    const oldSrc = `import { a } from "./a";\nimport { b } from "./b";\n\nexport const x = 1;\n`;
    const newSrc = `import { a } from "./a";\nimport { c } from "./c";\n\nexport const x = 1;\n`;
    const oldSide = await parseSide(typescriptProfile, oldSrc);
    const newSide = await parseSide(typescriptProfile, newSrc);
    try {
      const f = importFolder(typescriptProfile, oldSide, newSide, "zh-CN")!;
      expect(f.isImport("old", 2)).toBe(true);
      expect(f.isImport("old", 4)).toBe(false);
      expect(f.isImport("new", 2)).toBe(true);
      expect(f.describe([2], [2])).toBe("import +1 −1：+./c、−./b");
    } finally {
      oldSide.tree.delete();
      newSide.tree.delete();
    }
  });

  test("同一模块两侧都有（只是换了导入项）不算增删；全无增删报模块不变", async () => {
    const oldSrc = `import { a } from "./a";\nimport { b } from "./b";\n`;
    const newSrc = `import { b } from "./b";\nimport { a, a2 } from "./a";\n`;
    const oldSide = await parseSide(typescriptProfile, oldSrc);
    const newSide = await parseSide(typescriptProfile, newSrc);
    try {
      const f = importFolder(typescriptProfile, oldSide, newSide, "zh-CN")!;
      expect(f.describe([1, 2], [1, 2])).toBe("import +2 −2（模块不变）");
    } finally {
      oldSide.tree.delete();
      newSide.tree.delete();
    }
  });

  test("模块名超过上限时截断并标注", async () => {
    const mods = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const newSrc = mods.map((m) => `import "${m}";`).join("\n") + "\n";
    const newSide = await parseSide(typescriptProfile, newSrc);
    try {
      const f = importFolder(typescriptProfile, null, newSide, "en")!;
      expect(f.describe([], [1, 2, 3, 4, 5, 6, 7, 8])).toBe(
        "import +8 −0: +a, +b, +c, +d, +e, +f, …",
      );
    } finally {
      newSide.tree.delete();
    }
  });

  test("与其他语句共行的 import 不索引，业务改动不会被藏进摘要", async () => {
    const oldSrc = `import { x } from "m"; export const n = 1;\nimport { y } from "y";\n`;
    const newSrc = `import { x } from "m"; export const n = 2;\nimport { y } from "y";\n`;
    const oldSide = await parseSide(typescriptProfile, oldSrc);
    const newSide = await parseSide(typescriptProfile, newSrc);
    try {
      const f = importFolder(typescriptProfile, oldSide, newSide, "zh-CN")!;
      expect(f.isImport("old", 1)).toBe(false);
      expect(f.isImport("new", 1)).toBe(false);
      expect(f.isImport("new", 2)).toBe(true);
    } finally {
      oldSide.tree.delete();
      newSide.tree.delete();
    }
  });

  test("无 importNames 的 profile 不折叠", async () => {
    const profile: LanguageProfile = { ...typescriptProfile, importNames: undefined };
    const side = await parseSide(profile, `import "a";\n`);
    try {
      expect(importFolder(profile, null, side, "zh-CN")).toBeNull();
    } finally {
      side.tree.delete();
    }
  });
});

describe("buildSimplifiedRows 的 import 折叠", () => {
  test("import 变更行折叠为块首一行摘要，import 上下文行不显示，其余变更照常", async () => {
    const oldSrc = `import { a } from "./a";
import { b } from "./b";
import { c } from "./c";

export function f(x: number): number {
  return a(x);
}
`;
    const newSrc = `import { a } from "./a";
import { d } from "./d";
import { c } from "./c";

export function f(x: number): number {
  return d(x);
}
`;
    const file = mkFile([
      { type: "normal", ln1: 1, ln2: 1, content: ' import { a } from "./a";' },
      { type: "del", ln: 2, content: '-import { b } from "./b";' },
      { type: "add", ln: 2, content: '+import { d } from "./d";' },
      { type: "normal", ln1: 3, ln2: 3, content: ' import { c } from "./c";' },
      { type: "normal", ln1: 4, ln2: 4, content: " " },
      { type: "normal", ln1: 5, ln2: 5, content: " export function f(x: number): number {" },
      { type: "del", ln: 6, content: "-  return a(x);" },
      { type: "add", ln: 6, content: "+  return d(x);" },
      { type: "normal", ln1: 7, ln2: 7, content: " }" },
    ]);
    const { rows, stats } = await rowsOf(typescriptProfile, file, oldSrc, newSrc);
    expect(rows[0]).toMatchObject({
      kind: "fold",
      count: 1,
      oldLines: ['import { b } from "./b";'],
      newLines: ['import { d } from "./d";'],
      oldLns: [2],
      newLns: [2],
      summary: "import +1 −1：+./d、−./b",
    });
    // 第 1、3 行的 import 上下文不显示，空行间隔保留
    expect(rows[1]).toMatchObject({ kind: "ctx", text: "", oldLn: 4 });
    expect(rows.map((r) => r.kind)).toEqual(["fold", "ctx", "ctx", "del", "add", "ctx"]);
    expect(stats.folded).toBe(1);
    expect(stats.visible).toBe(2);
  });

  test("import 折叠不与后续类型折叠合并", async () => {
    const oldSrc = `import { a } from "./a";\nexport const n: number = 1;\n`;
    const newSrc = `import { b } from "./b";\nexport const n: string = 1;\n`;
    const file = mkFile([
      { type: "del", ln: 1, content: '-import { a } from "./a";' },
      { type: "del", ln: 2, content: "-export const n: number = 1;" },
      { type: "add", ln: 1, content: '+import { b } from "./b";' },
      { type: "add", ln: 2, content: "+export const n: string = 1;" },
    ]);
    const { rows } = await rowsOf(typescriptProfile, file, oldSrc, newSrc);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "fold", summary: "import +1 −1：+./b、−./a" });
    expect(rows[1]).toMatchObject({ kind: "fold", oldLines: ["export const n: number = 1;"] });
    expect((rows[1] as { summary?: string }).summary).toBeUndefined();
  });

  test("被隐藏的 import 上下文行隔开的多段 import 变更合并为一条折叠", async () => {
    const oldSrc = `import { a } from "./a";
import { b } from "./b";
import { c } from "./c";
`;
    const newSrc = `import { a2 } from "./a2";
import { b } from "./b";
import { c2 } from "./c2";
`;
    const file = mkFile([
      { type: "del", ln: 1, content: '-import { a } from "./a";' },
      { type: "add", ln: 1, content: '+import { a2 } from "./a2";' },
      { type: "normal", ln1: 2, ln2: 2, content: ' import { b } from "./b";' },
      { type: "del", ln: 3, content: '-import { c } from "./c";' },
      { type: "add", ln: 3, content: '+import { c2 } from "./c2";' },
    ]);
    const { rows, stats } = await rowsOf(typescriptProfile, file, oldSrc, newSrc);
    expect(rows).toEqual([
      expect.objectContaining({
        kind: "fold",
        count: 2,
        oldLns: [1, 3],
        newLns: [1, 3],
        summary: "import +2 −2：+./a2、+./c2、−./a、−./c",
      }),
    ]);
    expect(stats.folded).toBe(2);
  });

  test("go 分组 import 的多行增删合并为一条摘要", async () => {
    const oldSrc = `package main\n\nimport (\n\t"fmt"\n\t"os"\n)\n`;
    const newSrc = `package main\n\nimport (\n\t"fmt"\n\t"strings"\n\t"os"\n)\n`;
    const file: ParsedFile = {
      chunks: [
        {
          changes: [
            { type: "normal", ln1: 4, ln2: 4, content: ' \t"fmt"' },
            { type: "add", ln: 5, content: '+\t"strings"' },
            { type: "normal", ln1: 5, ln2: 6, content: ' \t"os"' },
          ],
        },
      ],
      from: "a.go",
      to: "a.go",
      deletions: 0,
      additions: 1,
    };
    const { rows } = await rowsOf(goProfile, file, oldSrc, newSrc);
    // 分组 import 的行号索引到同一节点：新侧整组 fmt/strings/os 减旧侧 fmt/os，只余 strings
    expect(rows).toEqual([
      expect.objectContaining({ kind: "fold", summary: "import +1 −0：+strings" }),
    ]);
  });

  test("rust 的 use 用 use 关键字", async () => {
    const newSrc = `use std::fmt;\n`;
    const file = mkFile([{ type: "add", ln: 1, content: "+use std::fmt;" }]);
    const { rows } = await rowsOf(rustProfile, file, "", newSrc);
    expect(rows[0]).toMatchObject({ kind: "fold", summary: "use +1 −0：+std::fmt" });
  });

  test("service.analyzeFile 端到端产出 import 折叠", async () => {
    const oldSrc = `import { a } from "./a";\nexport const x = a;\n`;
    const newSrc = `import { a } from "./a";\nimport { b } from "./b";\nexport const x = a + b;\n`;
    const file = mkFile([
      { type: "normal", ln1: 1, ln2: 1, content: ' import { a } from "./a";' },
      { type: "add", ln: 2, content: '+import { b } from "./b";' },
      { type: "del", ln: 2, content: "-export const x = a;" },
      { type: "add", ln: 3, content: "+export const x = a + b;" },
    ]);
    const entry = await analyzeFile(file, oldSrc, newSrc, "zh-CN");
    expect(entry.simplified?.rows[0]).toMatchObject({
      kind: "fold",
      summary: "import +1 −0：+./b",
    });
  });
});
