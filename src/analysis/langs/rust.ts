import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../../i18n";
import {
  del,
  delSpan,
  replaceNode,
  stripColonType,
  stripReturnType,
  type SimplifyOp,
} from "../simplify";
import { nameList, type DeclarationInfo, type FoldKind, type LanguageProfile } from "./types";

/** Rust profile：声明收集（徽章分类用）+ 简化器（对齐 rust-beautifier 的擦除规则） */

function nameOf(node: Node, locale: Locale): string {
  return node.childForFieldName("name")?.text ?? messages(locale).analysis.anonymousName;
}

function joinContainer(container: string, name: string): string {
  return container ? `${container}.${name}` : name;
}

function implName(node: Node, locale: Locale): string {
  const trait = node.childForFieldName("trait");
  const type = node.childForFieldName("type");
  const t = type?.text ?? messages(locale).analysis.unknownName;
  return trait ? `${trait.text} for ${t}` : t;
}

function collectNode(
  node: Node,
  container: string,
  out: DeclarationInfo[],
  locale: Locale,
): void {
  switch (node.type) {
    case "function_item": {
      out.push({
        kind: "function",
        name: nameOf(node, locale),
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
        name: nameOf(node, locale),
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
        name: nameOf(node, locale),
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
        name: nameOf(node, locale),
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      return;
    }
    case "trait_item": {
      const name = nameOf(node, locale);
      out.push({
        kind: "type",
        name,
        typeLevel: true,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, name), out, locale);
      return;
    }
    case "impl_item": {
      const name = implName(node, locale);
      out.push({
        kind: "class",
        name,
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, name), out, locale);
      return;
    }
    case "mod_item": {
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, nameOf(node, locale)), out, locale);
      return;
    }
    case "type_item": {
      out.push({
        kind: "type",
        name: nameOf(node, locale),
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
        name: nameOf(node, locale),
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

function collectInto(
  node: Node,
  container: string,
  out: DeclarationInfo[],
  locale: Locale,
): void {
  for (const child of node.namedChildren) collectNode(child, container, out, locale);
}

/** 零参数机制调用：封解包/内存/转换（按语义安全线擦除，见 .agents/truth/product.md） */
const MECH_CALLS = new Set(["unwrap", "clone", "into", "to_string", "to_owned"]);

/** 类型性质 + 工程机制擦除（类型/泛型/生命周期/?/unwrap/clone 等；语言机制信任 agent 做对） */
export function rustSimplify(node: Node, source: string, ops: SimplifyOp[]): boolean | void {
  switch (node.type) {
    case "try_expression": {
      // expr? → expr（错误传播机制）
      const inner = node.namedChildren[0];
      if (inner) ops.push(replaceNode(node, source.slice(inner.startIndex, inner.endIndex)));
      return true;
    }
    case "call_expression": {
      const fnNode = node.childForFieldName("function");
      const args = node.childForFieldName("arguments");
      if (fnNode?.type === "field_expression" && args && args.namedChildren.length === 0) {
        const value = fnNode.childForFieldName("value");
        if (value && MECH_CALLS.has(fnNode.childForFieldName("field")?.text ?? "")) {
          ops.push(replaceNode(node, source.slice(value.startIndex, value.endIndex)));
          return true;
        }
      }
      return false;
    }
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

/* ---- 顶层块折叠（查看器）：use 与类型级声明压缩为单行摘要 ---- */

function rustFoldKind(node: Node): FoldKind | null {
  switch (node.type) {
    case "use_declaration":
      return "import";
    case "struct_item":
    case "enum_item":
    case "trait_item":
    case "type_item":
      return "type-decl";
    default:
      return null;
  }
}

/** 成员/变体名字（无 name 字段的节点跳过，如元组结构体字段） */
function memberNames(node: Node): string[] {
  return (node.childForFieldName("body")?.namedChildren ?? [])
    .map((c) => c.childForFieldName("name")?.text ?? null)
    .filter((x): x is string => x != null);
}

function rustFoldSummary(kind: FoldKind, nodes: Node[], _source: string, locale: Locale): string {
  if (kind === "import") {
    const paths = nodes.map((n) => n.childForFieldName("argument")?.text ?? "?");
    return messages(locale).analysis.importsFold("use", nodes.length, paths.slice(0, 4), paths.length > 4);
  }
  const n = nodes[0]!;
  const name = nameOf(n, locale);
  if (n.type === "type_item") return `type ${name}`;
  const keyword = n.type === "struct_item" ? "struct" : n.type === "enum_item" ? "enum" : "trait";
  const members = memberNames(n);
  return members.length > 0 ? `${keyword} ${name} { ${nameList(members, locale)} }` : `${keyword} ${name}`;
}

export const rustProfile: LanguageProfile = {
  id: "rust",
  extensions: ["rs"],
  grammarFile: "rust",
  collect(root, locale) {
    const out: DeclarationInfo[] = [];
    collectInto(root, "", out, locale);
    return out;
  },
  simplify: rustSimplify,
  foldKind: rustFoldKind,
  foldSummary: rustFoldSummary,
};
