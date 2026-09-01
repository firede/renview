import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../../i18n";
import { del, delSwallowingLeadingSpace, stripColonType, type SimplifyOp } from "../simplify";
import { nameList, type DeclarationInfo, type FoldKind, type LanguageProfile } from "./types";

/** Python profile：声明收集 + 类型/机制擦除（标注、self、cast、TYPE_CHECKING）+ 顶层块折叠 */

function nameOf(node: Node, locale: Locale): string {
  return node.childForFieldName("name")?.text ?? messages(locale).analysis.anonymousName;
}

function joinContainer(container: string, name: string): string {
  return container ? `${container}.${name}` : name;
}

/** decorated_definition 透视（装饰器是契约的一部分，单元节点保留包装节点本身） */
function unwrapDecorated(node: Node): Node {
  return node.type === "decorated_definition"
    ? (node.childForFieldName("definition") ?? node)
    : node;
}

/** expression_statement 仅包装一条赋值时透视之（Python 的赋值语句都被它包了一层） */
function unwrapExprStmt(node: Node): Node {
  if (
    node.type === "expression_statement" &&
    node.namedChildren.length === 1 &&
    node.namedChildren[0]!.type === "assignment"
  ) {
    return node.namedChildren[0]!;
  }
  return node;
}

/** 类体是否不含任何函数/嵌套类定义（纯数据类可折叠为单行摘要） */
function isDataOnlyClass(node: Node): boolean {
  const body = node.childForFieldName("body");
  for (const c of body?.namedChildren ?? []) {
    const inner = unwrapDecorated(c);
    if (inner.type === "function_definition" || inner.type === "class_definition") return false;
  }
  return true;
}

function collectNode(node: Node, container: string, out: DeclarationInfo[], locale: Locale): void {
  const unit = unwrapExprStmt(node); // expression_statement 包装无信息，剥掉
  const inner = unwrapDecorated(unit);
  switch (inner.type) {
    case "function_definition": {
      out.push({
        kind: "function",
        name: nameOf(inner, locale),
        typeLevel: false,
        node: unit, // 保留 decorated 包装（装饰器是契约）
        bodyNode: inner.childForFieldName("body"),
        container,
      });
      return;
    }
    case "class_definition": {
      const name = nameOf(inner, locale);
      out.push({
        kind: "class",
        name,
        typeLevel: false,
        node: unit,
        bodyNode: inner.childForFieldName("body"),
        container,
      });
      const body = inner.childForFieldName("body");
      if (body) {
        for (const c of body.namedChildren) collectNode(c, joinContainer(container, name), out, locale);
      }
      return;
    }
    case "type_alias_statement": {
      out.push({
        kind: "type",
        name: inner.childForFieldName("left")?.text ?? messages(locale).analysis.anonymousName,
        typeLevel: true,
        node: unit,
        bodyNode: null,
        container,
      });
      return;
    }
    case "assignment": {
      const left = inner.childForFieldName("left");
      if (left && left.type === "identifier") {
        out.push({
          kind: "variable",
          name: left.text,
          typeLevel: false,
          node: inner,
          bodyNode: null,
          container,
        });
      }
      return;
    }
    default:
      return;
  }
}

/** 删除 "-> Type" 连同前导空白（Python 返回类型后还有冒号，不留残空格） */
function stripArrowType(node: Node, source: string, ops: SimplifyOp[]): void {
  const ret = node.childForFieldName("return_type");
  if (!ret) return;
  const prev = ret.previousSibling;
  const start = prev && !prev.isNamed && prev.type === "->" ? prev.startIndex : ret.startIndex;
  ops.push(delSwallowingLeadingSpace(start, ret.endIndex, source));
}

/** 是否类的直接成员（跳过 decorated_definition 包装） */
function isClassMember(node: Node): boolean {
  let p = node.parent;
  while (p && p.type === "decorated_definition") p = p.parent;
  return p?.type === "block" && p.parent?.type === "class_definition";
}

/** 类方法的 self/cls 首参数是语言机制，连同后面的逗号一起擦除 */
function eraseSelfParam(node: Node, ops: SimplifyOp[]): void {
  if (!isClassMember(node)) return;
  const params = node.childForFieldName("parameters");
  const first = params?.namedChildren[0];
  if (!first || (first.text !== "self" && first.text !== "cls")) return;
  const second = params!.namedChildren[1];
  ops.push({ start: first.startIndex, end: second ? second.startIndex : first.endIndex });
}

/** Python 简化器：擦除类型标注/泛型/self/cast，if TYPE_CHECKING 块折叠为单行标记 */
export function pySimplify(node: Node, source: string, ops: SimplifyOp[]): boolean | void {
  switch (node.type) {
    case "typed_parameter":
    case "typed_default_parameter":
      stripColonType(node, ops);
      return false;
    case "assignment": {
      // 带类型标注的赋值：擦除 ": 类型"（左右值保留）
      if (node.childForFieldName("type")) stripColonType(node, ops);
      return false;
    }
    case "function_definition": {
      const tp = node.childForFieldName("type_parameters");
      if (tp) ops.push(del(tp));
      stripArrowType(node, source, ops);
      eraseSelfParam(node, ops);
      return false;
    }
    case "class_definition":
    case "type_alias_statement": {
      const tp = node.childForFieldName("type_parameters");
      if (tp) ops.push(del(tp));
      return false;
    }
    case "if_statement": {
      // if TYPE_CHECKING: 整块是类型导入机制 → 单行标记（锚定源码关键字的伪代码，不随语言翻译）
      const cond = node.childForFieldName("condition");
      if (cond && cond.text.endsWith("TYPE_CHECKING")) {
        ops.push({
          start: node.startIndex,
          end: node.endIndex,
          replacement: "if TYPE_CHECKING: …",
        });
        return true;
      }
      return false;
    }
    case "call": {
      // typing.cast(T, x) → x（类型断言机制）
      const fn = node.childForFieldName("function");
      if (fn?.type === "identifier" && fn.text === "cast") {
        const args = node.childForFieldName("arguments")?.namedChildren ?? [];
        if (args.length === 2) {
          const v = args[1]!;
          ops.push({
            start: node.startIndex,
            end: node.endIndex,
            replacement: source.slice(v.startIndex, v.endIndex),
          });
          return true;
        }
      }
      return false;
    }
  }
  return false;
}

/* ---- 顶层块折叠（查看器） ---- */

function pyFoldKind(node: Node): FoldKind | null {
  if (
    node.type === "import_statement" ||
    node.type === "import_from_statement" ||
    node.type === "future_import_statement"
  ) {
    return "import";
  }
  const inner = unwrapDecorated(node);
  if (inner.type === "type_alias_statement") return "type-decl";
  // 纯数据类（无方法/嵌套类）：dataclass、pydantic 模型、Enum 等，折叠为带成员名的单行摘要
  if (inner.type === "class_definition" && isDataOnlyClass(inner)) return "type-decl";
  return null;
}

function pyFoldSummary(kind: FoldKind, nodes: Node[], _source: string, locale: Locale): string {
  if (kind === "import") {
    const mods = nodes.map((n) => {
      if (n.type === "future_import_statement") return "__future__";
      if (n.type === "import_from_statement") {
        return n.childForFieldName("module_name")?.text ?? "?";
      }
      return n.childForFieldName("name")?.text ?? "?";
    });
    return messages(locale).analysis.importsFold("import", mods.length, mods.slice(0, 4), mods.length > 4);
  }
  const n = nodes[0]!;
  const inner = unwrapDecorated(n);
  if (inner.type === "type_alias_statement") {
    return `type ${inner.childForFieldName("left")?.text ?? "?"}`;
  }
  const name = nameOf(inner, locale);
  const decorators =
    n.type === "decorated_definition"
      ? n.namedChildren.filter((c) => c.type === "decorator").map((d) => d.text)
      : [];
  const members = (inner.childForFieldName("body")?.namedChildren ?? [])
    .map((c) => unwrapExprStmt(c))
    .filter((c) => c.type === "assignment")
    .map((c) => c.childForFieldName("left")?.text ?? null)
    .filter((x): x is string => x != null);
  const head = [...decorators, `class ${name}`].join(" ");
  return members.length > 0 ? `${head} { ${nameList(members, locale)} }` : head;
}

export const pythonProfile: LanguageProfile = {
  id: "python",
  extensions: ["py", "pyi"],
  grammarFile: "python",
  collect(root, locale) {
    const out: DeclarationInfo[] = [];
    for (const c of root.namedChildren) collectNode(c, "", out, locale);
    return out;
  },
  simplify: pySimplify,
  foldKind: pyFoldKind,
  foldSummary: pyFoldSummary,
};
