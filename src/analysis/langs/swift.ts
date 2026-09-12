import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../../i18n";
import { del, type SimplifyOp } from "../simplify";
import { nodeRowRange, type DeclarationInfo, type LanguageProfile } from "./types";

const CONTAINERS = new Set(["class_declaration", "protocol_declaration"]);
const FUNCTIONS = new Set([
  "function_declaration",
  "protocol_function_declaration",
  "init_declaration",
  "deinit_declaration",
  "subscript_declaration",
]);
const PROPERTIES = new Set(["property_declaration", "protocol_property_declaration"]);

function namesOf(node: Node): string[] {
  return node.childrenForFieldName("name").map((child) =>
    child.type === "pattern"
      ? child
          .descendantsOfType("simple_identifier")
          .map((n) => n.text)
          .join(", ")
      : child.text,
  );
}

function bodyOf(node: Node): Node | null {
  return (
    node.childForFieldName("body") ??
    node.childForFieldName("computed_value") ??
    node.namedChildren.find((n) =>
      ["computed_property", "willset_didset_block"].includes(n.type),
    ) ??
    null
  );
}

function nameOf(node: Node, locale: Locale): string {
  return (
    { deinit_declaration: "deinit", subscript_declaration: "subscript" }[node.type] ||
    (PROPERTIES.has(node.type) || node.type === "enum_entry"
      ? namesOf(node).join(", ")
      : node.childForFieldName("name")?.text) ||
    node.namedChildren.find((n) => n.type === "simple_identifier")?.text ||
    messages(locale).analysis.anonymousName
  );
}

function callableName(node: Node, locale: Locale): string {
  const labels = node.namedChildren
    .filter((n) => n.type === "parameter")
    .map(
      (p) =>
        (
          p.childForFieldName("external_name") ??
          (node.type === "subscript_declaration"
            ? null
            : p.namedChildren.find((n) => n.type === "simple_identifier"))
        )?.text ?? "_",
    );
  return `${nameOf(node, locale)}(${labels.map((label) => `${label}:`).join("")})`;
}

/** 只进入声明容器，不把闭包和方法内部声明重复提为审阅单元。 */
function collect(node: Node, container: string, out: DeclarationInfo[], locale: Locale): void {
  const body = bodyOf(node);
  let name = nameOf(node, locale);
  const extension = node.children.some((n) => n.type === "extension");
  if (extension) {
    const constraints = node.namedChildren
      .filter((n) => ["inheritance_specifier", "type_constraints"].includes(n.type))
      .map((n) => n.text)
      .join(" ");
    name = `extension ${name}${constraints ? ` ${constraints}` : ""}`;
  }
  if (CONTAINERS.has(node.type)) {
    out.push({ kind: "class", name, typeLevel: false, node, bodyNode: body, container });
    for (const member of body?.namedChildren ?? []) {
      collect(member, container ? `${container}.${name}` : name, out, locale);
    }
  } else if (FUNCTIONS.has(node.type)) {
    out.push({
      kind: "function",
      name: callableName(node, locale),
      typeLevel: false,
      node,
      bodyNode: body,
      container,
      // 先匹配完整签名，剩余同标签声明仍可识别为签名变更。
      pairingSignature: node.text
        .slice(0, (body?.startIndex ?? node.endIndex) - node.startIndex)
        .replace(/\s+/g, " ")
        .trim(),
    });
  } else if (PROPERTIES.has(node.type) || node.type === "enum_entry") {
    out.push({ kind: "variable", name, typeLevel: false, node, bodyNode: body, container });
  } else if (["typealias_declaration", "associatedtype_declaration"].includes(node.type)) {
    out.push({ kind: "type", name, typeLevel: false, node, bodyNode: null, container });
  } else if (
    [
      "macro_declaration",
      "macro_invocation",
      "operator_declaration",
      "precedence_group_declaration",
    ].includes(node.type)
  ) {
    out.push({ kind: "function", name, typeLevel: false, node, bodyNode: null, container });
  }
}

function eraseWithSpace(node: Node, source: string, ops: SimplifyOp[]): void {
  let end = node.endIndex;
  while (source[end] === " " || source[end] === "\t") end++;
  ops.push({ start: node.startIndex, end });
}

export function swiftSimplify(node: Node, source: string, ops: SimplifyOp[]): void {
  if (
    node.type === "visibility_modifier" &&
    /^(public|internal|package|private|fileprivate)$/.test(node.text)
  ) {
    eraseWithSpace(node, source, ops);
  } else if (node.type === "attribute") {
    const name = node.namedChildren.find((n) => n.type === "user_type")?.text;
    if (
      !node.descendantsOfType(["comment", "multiline_comment"]).length &&
      ["inline", "inlinable", "discardableResult"].includes(name ?? "")
    )
      eraseWithSpace(node, source, ops);
  } else if (node.type === "property_declaration" && node.parent?.type === "statements") {
    // 仅删除初始化调用已明确重复的简单类型；隐式成员、空集合和未知构造都保留。
    const annotation = node.namedChildren.find((n) => n.type === "type_annotation");
    const value = node.childForFieldName("value");
    const type = annotation?.namedChildren[0];
    const callee = value?.type === "call_expression" ? value.namedChildren[0] : null;
    if (
      node.childrenForFieldName("name").length === 1 &&
      annotation &&
      type &&
      callee &&
      type.type === "user_type" &&
      /^[A-Z][A-Za-z0-9_]*$/.test(type.text) &&
      callee.text === type.text &&
      !node.namedChildren.some((n) => n.type === "modifiers")
    )
      ops.push(del(annotation));
  }
}

export const swiftProfile: LanguageProfile = {
  id: "swift",
  extensions: ["swift"],
  grammarFile: "swift",
  collect(root, locale) {
    const out: DeclarationInfo[] = [];
    for (const node of root.namedChildren) collect(node, "", out, locale);
    return out;
  },
  simplify: swiftSimplify,
  foldKind(node) {
    // 属性修饰 import（如 @testable）和访问级别 import 保持可见。
    if (node.type !== "import_declaration" || !node.text.startsWith("import ")) return null;
    const sharesLine =
      node.previousNamedSibling?.endPosition.row === node.startPosition.row ||
      node.nextNamedSibling?.startPosition.row === node.endPosition.row;
    return sharesLine ? null : "import";
  },
  foldSummary(_kind, nodes, _source, locale) {
    const imports = nodes.map((n) => n.text.replace(/^import\s+/, ""));
    return messages(locale).analysis.importsFold(
      "import",
      imports.length,
      imports.slice(0, 4),
      imports.length > 4,
    );
  },
  typeDeclMembers(node, locale) {
    if (!CONTAINERS.has(node.type)) return null;
    const members = (bodyOf(node)?.namedChildren ?? []).flatMap((member) =>
      PROPERTIES.has(member.type) || member.type === "enum_entry"
        ? namesOf(member).map((name) => ({ name, range: nodeRowRange(member) }))
        : [],
    );
    return { name: nameOf(node, locale), members };
  },
};
