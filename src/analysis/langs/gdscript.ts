import type { Node } from "web-tree-sitter";
import { delSwallowingLeadingSpace, stripColonType, type SimplifyOp } from "../simplify";
import { nameList, type DeclarationInfo, type FoldKind, type LanguageProfile } from "./types";

/** GDScript profile：声明收集 + 类型擦除（标注/返回类型）+ enum 折叠 */

function nameOf(node: Node): string {
  return node.childForFieldName("name")?.text ?? "(匿名)";
}

function joinContainer(container: string, name: string): string {
  return container ? `${container}.${name}` : name;
}

const VAR_STATEMENTS = new Set([
  "variable_statement",
  "const_statement",
  "export_variable_statement",
  "onready_variable_statement",
]);

function collectNode(node: Node, container: string, out: DeclarationInfo[]): void {
  switch (node.type) {
    case "function_definition":
    case "constructor_definition": {
      out.push({
        kind: "function",
        name: node.type === "constructor_definition" ? "_init" : nameOf(node),
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      return;
    }
    case "class_definition": {
      const name = nameOf(node);
      out.push({
        kind: "class",
        name,
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      const body = node.childForFieldName("body");
      if (body) for (const c of body.namedChildren) collectNode(c, joinContainer(container, name), out);
      return;
    }
    case "enum_definition": {
      out.push({
        kind: "type",
        name: nameOf(node),
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      return;
    }
    case "signal_statement": {
      out.push({
        kind: "variable",
        name: nameOf(node),
        typeLevel: false,
        node,
        bodyNode: null,
        container,
      });
      return;
    }
    default: {
      if (VAR_STATEMENTS.has(node.type)) {
        out.push({
          kind: "variable",
          name: nameOf(node),
          typeLevel: false,
          node,
          bodyNode: null,
          container,
        });
      }
      return;
    }
  }
}

/** GDScript 简化器：擦除类型标注与返回类型（静态类型是引擎层复杂度，按语义安全线擦除） */
export function gdSimplify(node: Node, source: string, ops: SimplifyOp[]): boolean | void {
  switch (node.type) {
    case "typed_parameter":
    case "typed_default_parameter":
    case "variable_statement":
    case "const_statement":
    case "export_variable_statement":
    case "onready_variable_statement":
      stripColonType(node, ops);
      return false;
    case "function_definition":
    case "constructor_definition": {
      // 删除 "-> Type" 连同前导空白（GDScript 返回类型后还有冒号，不留 " ):" 残空格）
      const ret = node.childForFieldName("return_type");
      if (ret) {
        const prev = ret.previousSibling;
        const start = prev && !prev.isNamed && prev.type === "->" ? prev.startIndex : ret.startIndex;
        ops.push(delSwallowingLeadingSpace(start, ret.endIndex, source));
      }
      return false;
    }
  }
  return false;
}

/* ---- 顶层块折叠（查看器） ---- */

function gdFoldKind(node: Node): FoldKind | null {
  return node.type === "enum_definition" ? "type-decl" : null;
}

function gdFoldSummary(_kind: FoldKind, nodes: Node[]): string {
  const n = nodes[0]!;
  const name = n.childForFieldName("name")?.text;
  const members = (n.childForFieldName("body")?.namedChildren ?? [])
    .flatMap((c) => (c.type === "enumerator_list" ? c.namedChildren : [c]))
    .map((e) => e.childForFieldName("left")?.text ?? null)
    .filter((x): x is string => x != null);
  const label = name ? `enum ${name}` : "enum";
  return members.length > 0 ? `${label} { ${nameList(members)} }` : label;
}

export const gdscriptProfile: LanguageProfile = {
  id: "gdscript",
  extensions: ["gd"],
  grammarFile: "gdscript",
  collect(root) {
    const out: DeclarationInfo[] = [];
    for (const c of root.namedChildren) collectNode(c, "", out);
    return out;
  },
  simplify: gdSimplify,
  foldKind: gdFoldKind,
  foldSummary: gdFoldSummary,
};
