import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../../i18n";
import { del, delSpan, replaceNode, type SimplifyOp } from "../simplify";
import { nameList, type DeclarationInfo, type FoldKind, type LanguageProfile } from "./types";

/**
 * TypeScript/TSX profile。
 * 审阅单元 = 模块级声明 + 命名空间/类成员；函数体内部的嵌套声明不单独成单元（归属外层 body 变更）。
 * export / declare 包装节点保留为单元范围（export 关键字本身是契约的一部分）。
 */

function nameOf(node: Node, locale: Locale): string {
  return node.childForFieldName("name")?.text ?? messages(locale).analysis.anonymousName;
}

function joinContainer(container: string, name: string): string {
  return container ? `${container}.${name}` : name;
}

/** lexical/variable declaration：按 declarator 拆分；箭头函数/函数表达式视为 function */
function declaratorInfos(
  node: Node,
  container: string,
  wrap: Node | undefined,
  locale: Locale,
): DeclarationInfo[] {
  const declarators = node.namedChildren.filter((c) => c.type === "variable_declarator");
  if (declarators.length === 0) {
    return [{ kind: "variable", name: messages(locale).analysis.unknownName, typeLevel: false, node: wrap ?? node, bodyNode: null, container }];
  }
  // export const a = 1, b = 2 这类多声明合并为一个单元，避免同一范围重复计
  if (wrap && declarators.length > 1) {
    const name = declarators.map((d) => d.childForFieldName("name")?.text ?? "?").join(", ");
    return [{ kind: "variable", name, typeLevel: false, node: wrap, bodyNode: null, container }];
  }
  return declarators.map((d) => {
    const name = d.childForFieldName("name")?.text ?? messages(locale).analysis.unknownName;
    const value = d.childForFieldName("value");
    const isFn =
      value != null && (value.type === "arrow_function" || value.type === "function_expression");
    return {
      kind: isFn ? "function" : "variable",
      name,
      typeLevel: false,
      node: wrap ?? d,
      bodyNode: isFn ? value.childForFieldName("body") : null,
      container,
    } satisfies DeclarationInfo;
  });
}

function collectNode(
  node: Node,
  container: string,
  out: DeclarationInfo[],
  wrap: Node | undefined,
  locale: Locale,
): void {
  switch (node.type) {
    case "export_statement":
    case "ambient_declaration": {
      const inner = node.namedChildren.find((c) => c.type !== "comment");
      if (inner) collectNode(inner, container, out, wrap ?? node, locale);
      return;
    }
    case "internal_module": {
      // namespace / module 块：不作为单元，递归收内部声明
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, nameOf(node, locale)), out, locale);
      return;
    }
    case "function_declaration":
    case "generator_function_declaration":
    case "method_definition": {
      out.push({
        kind: "function",
        name: nameOf(node, locale),
        typeLevel: false,
        node: wrap ?? node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      return;
    }
    case "method_signature":
    case "abstract_method_signature": {
      // 无实现的签名型成员：整体即签名，归为类型级
      out.push({
        kind: "function",
        name: nameOf(node, locale),
        typeLevel: true,
        node: wrap ?? node,
        bodyNode: null,
        container,
      });
      return;
    }
    case "class_declaration":
    case "abstract_class_declaration": {
      const name = nameOf(node, locale);
      out.push({
        kind: "class",
        name,
        typeLevel: false,
        node: wrap ?? node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, name), out, locale);
      return;
    }
    case "interface_declaration":
    case "type_alias_declaration": {
      out.push({
        kind: "type",
        name: nameOf(node, locale),
        typeLevel: true,
        node: wrap ?? node,
        bodyNode: null,
        container,
      });
      return;
    }
    case "enum_declaration": {
      // enum 有运行时代码，不算纯类型级；成员变化归为 body 变更
      out.push({
        kind: "type",
        name: nameOf(node, locale),
        typeLevel: false,
        node: wrap ?? node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      return;
    }
    case "property_declaration":
    case "public_field_definition": {
      out.push({
        kind: "variable",
        name: nameOf(node, locale),
        typeLevel: false,
        node: wrap ?? node,
        bodyNode: null,
        container,
      });
      return;
    }
    case "lexical_declaration":
    case "variable_declaration": {
      out.push(...declaratorInfos(node, container, wrap, locale));
      return;
    }
    default:
      // import、顶层表达式语句等不成为审阅单元（其变更归入"声明之外的变更"）
      return;
  }
}

function collectInto(
  node: Node,
  container: string,
  out: DeclarationInfo[],
  locale: Locale,
): void {
  for (const child of node.namedChildren) collectNode(child, container, out, undefined, locale);
}

/** TS/TSX 简化器：删除类型位置的语法（标注/泛型/断言/implements）与空值安全机制（?.），类型别名保留名字桩 */
export function tsSimplify(node: Node, source: string, ops: SimplifyOp[]): boolean | void {
  // a?.b → a.b；a?.() / a?.[i] → a() / a[i]（可选链是空值安全机制，按语义安全线擦除）
  const optionalChain = node.childForFieldName("optional_chain");
  if (optionalChain) {
    ops.push(node.type === "member_expression" ? replaceNode(optionalChain, ".") : del(optionalChain));
  }
  switch (node.type) {
    case "type_annotation":
    case "type_parameters":
    case "type_arguments":
    case "implements_clause":
      ops.push(del(node));
      return true;
    case "as_expression":
    case "satisfies_expression": {
      // expr as T → expr（不 return true，让嵌套的 as 也被处理）
      const expr = node.namedChildren[0];
      if (expr) ops.push(delSpan(expr.endIndex, node.endIndex));
      return false;
    }
    case "non_null_expression": {
      // 只删 `!` 本身：链式调用可能跨行，整条 replaceNode 会把多行文本压进首行（破坏 1:1 行对齐）；
      // return false 让 a!.b! 里嵌套的内层 non_null 也被擦除
      const bang = node.children.find((c) => c.type === "!" && !c.isNamed);
      if (bang) ops.push(del(bang));
      return false;
    }
    case "optional_parameter":
    case "property_signature":
    case "method_signature": {
      for (const c of node.children) {
        if (c.type === "?" && !c.isNamed) ops.push(del(c));
      }
      return false;
    }
    case "type_alias_declaration": {
      // type F = ...; → type F;
      const name = node.childForFieldName("name");
      if (name) ops.push({ start: name.endIndex, end: node.endIndex, replacement: ";" });
      return true;
    }
    case "interface_declaration": {
      // extends 是类型级关系，删除；成员由 property_signature 等规则处理
      const heritage = node.children.find((c) => c.type === "extends_clause");
      if (heritage) ops.push(del(heritage));
      return false;
    }
  }
  return false;
}

/* ---- 顶层块折叠（查看器）：imports 与类型级声明压缩为单行摘要 ---- */

/** 透视 export / declare 包装节点 */
function unwrapDecl(node: Node): Node {
  if (node.type === "export_statement" || node.type === "ambient_declaration") {
    const inner = node.namedChildren.find((c) => c.type !== "comment");
    if (inner) return inner;
  }
  return node;
}

function tsFoldKind(node: Node): FoldKind | null {
  const n = unwrapDecl(node);
  if (n.type === "import_statement") return "import";
  if (
    n.type === "interface_declaration" ||
    n.type === "type_alias_declaration" ||
    n.type === "enum_declaration"
  ) {
    return "type-decl";
  }
  return null;
}

function tsFoldSummary(kind: FoldKind, nodes: Node[], _source: string, locale: Locale): string {
  if (kind === "import") {
    const mods = nodes.map((n) => {
      const s = unwrapDecl(n).childForFieldName("source");
      return s?.namedChildren[0]?.text ?? s?.text.replace(/^['"]|['"]$/g, "") ?? "?";
    });
    return messages(locale).analysis.importsFold("import", nodes.length, mods.slice(0, 4), mods.length > 4);
  }
  const n = unwrapDecl(nodes[0]!);
  const name = nameOf(n, locale);
  if (n.type === "type_alias_declaration") return `type ${name}`;
  const keyword = n.type === "enum_declaration" ? "enum" : "interface";
  const members = (n.childForFieldName("body")?.namedChildren ?? [])
    .map(
      (c) =>
        c.childForFieldName("name")?.text ?? (c.type === "property_identifier" ? c.text : null),
    )
    .filter((x): x is string => x != null);
  return members.length > 0 ? `${keyword} ${name} { ${nameList(members, locale)} }` : `${keyword} ${name}`;
}

export const typescriptProfile: LanguageProfile = {
  id: "typescript",
  extensions: ["ts", "mts", "cts"],
  grammarFile: "typescript",
  collect(root, locale) {
    const out: DeclarationInfo[] = [];
    collectInto(root, "", out, locale);
    return out;
  },
  simplify: tsSimplify,
  foldKind: tsFoldKind,
  foldSummary: tsFoldSummary,
};

// tsx 语法是超集，可解析 .tsx/.jsx 及纯 JS
export const tsxProfile: LanguageProfile = {
  ...typescriptProfile,
  id: "tsx",
  extensions: ["tsx", "jsx", "js", "mjs", "cjs"],
  grammarFile: "tsx",
};
