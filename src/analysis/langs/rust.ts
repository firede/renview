import type { Node } from "web-tree-sitter";
import {
  del,
  delSpan,
  replaceNode,
  stripColonType,
  stripReturnType,
  type SimplifyOp,
} from "../simplify";
import type { DeclarationInfo, LanguageProfile } from "./types";

/** Rust profile：声明收集（徽章分类用）+ 简化器（对齐 rust-beautifier 的擦除规则） */

function nameOf(node: Node): string {
  return node.childForFieldName("name")?.text ?? "(匿名)";
}

function joinContainer(container: string, name: string): string {
  return container ? `${container}.${name}` : name;
}

function implName(node: Node): string {
  const trait = node.childForFieldName("trait");
  const type = node.childForFieldName("type");
  const t = type?.text ?? "(未知)";
  return trait ? `${trait.text} for ${t}` : t;
}

function collectNode(
  node: Node,
  container: string,
  out: DeclarationInfo[],
): void {
  switch (node.type) {
    case "function_item": {
      out.push({
        kind: "function",
        name: nameOf(node),
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      return;
    }
    case "function_signature_item": {
      out.push({
        kind: "function",
        name: nameOf(node),
        typeLevel: true,
        node,
        bodyNode: null,
        container,
      });
      return;
    }
    case "struct_item": {
      out.push({
        kind: "type",
        name: nameOf(node),
        typeLevel: true,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      return;
    }
    case "enum_item": {
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
    case "trait_item": {
      const name = nameOf(node);
      out.push({
        kind: "type",
        name,
        typeLevel: true,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, name), out);
      return;
    }
    case "impl_item": {
      const name = implName(node);
      out.push({
        kind: "class",
        name,
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, name), out);
      return;
    }
    case "mod_item": {
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, nameOf(node)), out);
      return;
    }
    case "type_item": {
      out.push({
        kind: "type",
        name: nameOf(node),
        typeLevel: true,
        node,
        bodyNode: null,
        container,
      });
      return;
    }
    case "const_item":
    case "static_item": {
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
    default:
      return;
  }
}

function collectInto(node: Node, container: string, out: DeclarationInfo[]): void {
  for (const child of node.namedChildren) collectNode(child, container, out);
}

/** 类型性质 + 技巧性质擦除（工程性质如 ?/unwrap/clone 保留，留待后续） */
export function rustSimplify(node: Node, source: string, ops: SimplifyOp[]): boolean | void {
  switch (node.type) {
    case "type_parameters":
    case "where_clause":
      ops.push(del(node));
      return true;
    case "type_arguments": {
      // turbofish：连同前面的 :: 一起删（类型内部的 type_arguments 已被外层删除覆盖）
      const prev = node.previousSibling;
      const start = prev && !prev.isNamed && prev.type === "::" ? prev.startIndex : node.startIndex;
      ops.push(delSpan(start, node.endIndex));
      return true;
    }
    case "parameter":
    case "let_declaration":
    case "field_declaration":
      stripColonType(node, ops);
      return false;
    case "function_item":
    case "function_signature_item":
      stripReturnType(node, ops);
      return false;
    case "reference_expression":
    case "reference_pattern": {
      const inner = node.namedChildren.find((c) => c.type !== "mutable_specifier");
      if (inner) ops.push(replaceNode(node, source.slice(inner.startIndex, inner.endIndex)));
      return true;
    }
    case "integer_literal":
    case "float_literal": {
      const t = source.slice(node.startIndex, node.endIndex);
      const m = /^([\d_]+(?:\.\d+)?)(?:u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize|f32|f64)$/.exec(
        t,
      );
      if (m) ops.push(replaceNode(node, m[1]!));
      return true;
    }
  }
  return false;
}

export const rustProfile: LanguageProfile = {
  id: "rust",
  extensions: ["rs"],
  grammarFile: "rust",
  collect(root) {
    const out: DeclarationInfo[] = [];
    collectInto(root, "", out);
    return out;
  },
  simplify: rustSimplify,
};
