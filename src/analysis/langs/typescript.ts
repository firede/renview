import type { Node } from "web-tree-sitter";
import type { DeclarationInfo, LanguageProfile } from "./types";

/**
 * TypeScript/TSX profile。
 * 审阅单元 = 模块级声明 + 命名空间/类成员；函数体内部的嵌套声明不单独成单元（归属外层 body 变更）。
 * export / declare 包装节点保留为单元范围（export 关键字本身是契约的一部分）。
 */

function nameOf(node: Node): string {
  return node.childForFieldName("name")?.text ?? "(匿名)";
}

function joinContainer(container: string, name: string): string {
  return container ? `${container}.${name}` : name;
}

/** lexical/variable declaration：按 declarator 拆分；箭头函数/函数表达式视为 function */
function declaratorInfos(node: Node, container: string, wrap: Node | undefined): DeclarationInfo[] {
  const declarators = node.namedChildren.filter((c) => c.type === "variable_declarator");
  if (declarators.length === 0) {
    return [{ kind: "variable", name: "(未知)", typeLevel: false, node: wrap ?? node, bodyNode: null, container }];
  }
  // export const a = 1, b = 2 这类多声明合并为一个单元，避免同一范围重复计
  if (wrap && declarators.length > 1) {
    const name = declarators.map((d) => d.childForFieldName("name")?.text ?? "?").join(", ");
    return [{ kind: "variable", name, typeLevel: false, node: wrap, bodyNode: null, container }];
  }
  return declarators.map((d) => {
    const name = d.childForFieldName("name")?.text ?? "(未知)";
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
): void {
  switch (node.type) {
    case "export_statement":
    case "ambient_declaration": {
      const inner = node.namedChildren.find((c) => c.type !== "comment");
      if (inner) collectNode(inner, container, out, wrap ?? node);
      return;
    }
    case "internal_module": {
      // namespace / module 块：不作为单元，递归收内部声明
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, nameOf(node)), out);
      return;
    }
    case "function_declaration":
    case "generator_function_declaration":
    case "method_definition": {
      out.push({
        kind: "function",
        name: nameOf(node),
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
        name: nameOf(node),
        typeLevel: true,
        node: wrap ?? node,
        bodyNode: null,
        container,
      });
      return;
    }
    case "class_declaration":
    case "abstract_class_declaration": {
      const name = nameOf(node);
      out.push({
        kind: "class",
        name,
        typeLevel: false,
        node: wrap ?? node,
        bodyNode: node.childForFieldName("body"),
        container,
      });
      const body = node.childForFieldName("body");
      if (body) collectInto(body, joinContainer(container, name), out);
      return;
    }
    case "interface_declaration":
    case "type_alias_declaration": {
      out.push({
        kind: "type",
        name: nameOf(node),
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
        name: nameOf(node),
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
        name: nameOf(node),
        typeLevel: false,
        node: wrap ?? node,
        bodyNode: null,
        container,
      });
      return;
    }
    case "lexical_declaration":
    case "variable_declaration": {
      out.push(...declaratorInfos(node, container, wrap));
      return;
    }
    default:
      // import、顶层表达式语句等不成为审阅单元（其变更归入"声明之外的变更"）
      return;
  }
}

function collectInto(node: Node, container: string, out: DeclarationInfo[]): void {
  for (const child of node.namedChildren) collectNode(child, container, out, undefined);
}

export const typescriptProfile: LanguageProfile = {
  id: "typescript",
  extensions: ["ts", "mts", "cts"],
  grammarFile: "typescript",
  collect(root) {
    const out: DeclarationInfo[] = [];
    collectInto(root, "", out);
    return out;
  },
};

// tsx 语法是超集，可解析 .tsx/.jsx 及纯 JS
export const tsxProfile: LanguageProfile = {
  ...typescriptProfile,
  id: "tsx",
  extensions: ["tsx", "jsx", "js", "mjs", "cjs"],
  grammarFile: "tsx",
};
