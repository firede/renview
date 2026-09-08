import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../../i18n";
import { del, replaceNode, type SimplifyOp } from "../simplify";
import { nodeRowRange, type DeclarationInfo, type LanguageProfile } from "./types";

const CLASS_NODES = new Set([
  "class_declaration",
  "interface_declaration",
  "record_declaration",
  "enum_declaration",
  "annotation_type_declaration",
]);

function nameOf(node: Node, locale: Locale): string {
  return node.childForFieldName("name")?.text ?? messages(locale).analysis.anonymousName;
}

/** 枚举方法在额外的声明容器内；不深入方法体或匿名类，避免重复审阅。 */
function membersOf(node: Node): Node[] {
  return (node.childForFieldName("body")?.namedChildren ?? []).flatMap((child) =>
    child.type === "enum_body_declarations" ? child.namedChildren : [child],
  );
}

function collect(node: Node, container: string, out: DeclarationInfo[], locale: Locale): void {
  if (CLASS_NODES.has(node.type)) {
    const name = nameOf(node, locale);
    out.push({
      kind: "class",
      name,
      typeLevel: false,
      node,
      bodyNode: node.childForFieldName("body"),
      container,
    });
    for (const member of membersOf(node)) {
      collect(member, container ? `${container}.${name}` : name, out, locale);
    }
    return;
  }
  if (
    [
      "method_declaration",
      "constructor_declaration",
      "compact_constructor_declaration",
      "annotation_type_element_declaration",
    ].includes(node.type)
  ) {
    // 接口签名也是业务能力边界，不作为纯类型声明折叠。
    out.push({
      kind: "function",
      name: nameOf(node, locale),
      typeLevel: false,
      node,
      bodyNode: node.childForFieldName("body"),
      container,
    });
  } else if (["field_declaration", "constant_declaration"].includes(node.type)) {
    const names = node.namedChildren
      .filter((c) => c.type === "variable_declarator")
      .map((c) => nameOf(c, locale));
    out.push({
      kind: "variable",
      name: names.join(", "),
      typeLevel: false,
      node,
      bodyNode: null,
      container,
    });
  } else if (node.type === "enum_constant") {
    out.push({
      kind: "variable",
      name: nameOf(node, locale),
      typeLevel: false,
      node,
      bodyNode: null,
      container,
    });
  } else if (node.type === "static_initializer" || node.type === "block") {
    out.push({
      kind: "function",
      name: node.type === "static_initializer" ? "static {}" : "{}",
      typeLevel: false,
      node,
      bodyNode: node,
      container,
    });
  }
}

/** 只压缩直接字段读写；保留字段映射，校验、转换、链式返回和注释均留在原位。 */
function compactAccessor(node: Node, ops: SimplifyOp[]): void {
  const body = node.childForFieldName("body");
  if (!body || body.startPosition.row === body.endPosition.row || body.namedChildren.length !== 1)
    return;
  const params = node.childForFieldName("parameters")?.namedChildren ?? [];
  const statement = body.namedChildren[0]!;
  const value = statement.namedChildren[0];
  if (!value || value.descendantsOfType(["line_comment", "block_comment"]).length) return;
  const owner = node.parent?.parent;
  const fields =
    owner && CLASS_NODES.has(owner.type)
      ? membersOf(owner)
          .filter((c) => c.type === "field_declaration")
          .flatMap((c) =>
            c.namedChildren
              .filter((d) => d.type === "variable_declarator")
              .map((d) => d.childForFieldName("name")?.text),
          )
      : [];
  const isField = (n: Node) =>
    (n.type === "field_access" && n.childForFieldName("object")?.type === "this") ||
    (n.type === "identifier" &&
      fields.includes(n.text) &&
      !params.some((p) => p.childForFieldName("name")?.text === n.text));
  const getter = params.length === 0 && statement.type === "return_statement" && isField(value);
  const setter =
    params.length === 1 &&
    statement.type === "expression_statement" &&
    value.type === "assignment_expression" &&
    value.childForFieldName("operator")?.text === "=" &&
    !!value.childForFieldName("left") &&
    isField(value.childForFieldName("left")!) &&
    value.childForFieldName("right")?.type === "identifier" &&
    value.childForFieldName("right")?.text === params[0]!.childForFieldName("name")?.text;
  // 读写必须留在原行：搬到签名行会让只改方法体的局部 diff 误折叠。
  if (getter || setter) {
    const open = body.children.find((c) => c.type === "{");
    const close = body.children.find((c) => c.type === "}");
    if (open && close) ops.push(replaceNode(open, "=>"), del(close));
  }
}

/** 类型保留在模型与调用边界；仅将有初始化值的局部声明投影为 var。 */
export function javaSimplify(node: Node, source: string, ops: SimplifyOp[]): void {
  const removeModifier = (child: Node) => {
    let end = child.endIndex;
    while (source[end] === " " || source[end] === "\t") end++;
    ops.push({ start: child.startIndex, end });
  };
  if (node.type === "modifiers") {
    for (const child of node.children) {
      if (["public", "protected", "private"].includes(child.type)) removeModifier(child);
      if (
        child.type === "final" &&
        ["local_variable_declaration", "formal_parameter", "spread_parameter"].includes(
          node.parent?.type ?? "",
        ) &&
        node.parent?.parent?.parent?.type !== "record_declaration"
      )
        removeModifier(child);
    }
  } else if (node.type === "throws") {
    ops.push(del(node));
  } else if (node.type === "annotation" || node.type === "marker_annotation") {
    // 仅收起标准编译器提示；框架、校验、序列化及未知注解原样保留。
    const name = node.childForFieldName("name")?.text;
    if (
      ["Override", "SuppressWarnings", "java.lang.Override", "java.lang.SuppressWarnings"].includes(
        name ?? "",
      )
    ) {
      removeModifier(node);
    }
  } else if (node.type === "local_variable_declaration") {
    const declarations = node.namedChildren.filter((c) => c.type === "variable_declarator");
    const type = node.childForFieldName("type");
    // 类型上的注解可能承载约束；未初始化变量的类型是唯一模型线索。
    if (
      type &&
      type.text !== "var" &&
      !type.descendantsOfType(["annotation", "marker_annotation"]).length &&
      declarations.every((d) => d.childForFieldName("value"))
    ) {
      ops.push(replaceNode(type, "var"));
    }
  } else if (node.type === "method_declaration") {
    compactAccessor(node, ops);
  } else if (node.type === "type_arguments" && node.parent?.type === "method_invocation") {
    ops.push(del(node));
  }
}

export const javaProfile: LanguageProfile = {
  id: "java",
  extensions: ["java"],
  grammarFile: "java",
  collect(root, locale) {
    const out: DeclarationInfo[] = [];
    for (const node of root.namedChildren) collect(node, "", out, locale);
    return out;
  },
  simplify: javaSimplify,
  foldKind(node) {
    return node.type === "import_declaration" ? "import" : null;
  },
  foldSummary(_kind, nodes, _source, locale) {
    const imports = nodes.map((n) => n.text.replace(/^import\s+|;$/g, ""));
    return messages(locale).analysis.importsFold(
      "import",
      imports.length,
      imports.slice(0, 4),
      imports.length > 4,
    );
  },
  typeDeclMembers(node, locale) {
    if (!CLASS_NODES.has(node.type)) return null;
    const members = membersOf(node).flatMap((member) => {
      if (member.type === "enum_constant")
        return [{ name: nameOf(member, locale), range: nodeRowRange(member) }];
      if (!["field_declaration", "constant_declaration"].includes(member.type)) return [];
      return member.namedChildren
        .filter((c) => c.type === "variable_declarator")
        .map((c) => ({ name: nameOf(c, locale), range: nodeRowRange(member) }));
    });
    if (node.type === "record_declaration") {
      for (const parameter of node.childForFieldName("parameters")?.namedChildren ?? []) {
        const declarator =
          parameter.type === "spread_parameter"
            ? parameter.namedChildren.find((c) => c.type === "variable_declarator")
            : parameter;
        if (declarator)
          members.push({ name: nameOf(declarator, locale), range: nodeRowRange(parameter) });
      }
    }
    return { name: nameOf(node, locale), members };
  },
};
