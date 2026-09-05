import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../../i18n";
import { del, delSwallowingLeadingSpace, replaceNode, type SimplifyOp } from "../simplify";
import {
  nameList,
  nodeRowRange,
  type DeclarationInfo,
  type FoldKind,
  type LanguageProfile,
  type TypeDeclMembers,
} from "./types";

/** Go profile：声明收集 + 简化器（类型与错误传播机制擦除）+ 顶层块折叠 */

function nameOf(node: Node, locale: Locale): string {
  return node.childForFieldName("name")?.text ?? messages(locale).analysis.anonymousName;
}

/** 方法接收者类型名（*T / *T[P] → T），作为配对容器 */
function receiverName(node: Node): string {
  const recv = node.childForFieldName("receiver");
  const param = recv?.namedChildren[0];
  const t = param?.childForFieldName("type")?.text ?? "";
  return t.replace(/^\*+/, "").replace(/\[.*\]$/, "");
}

function collectNode(node: Node, container: string, out: DeclarationInfo[], locale: Locale): void {
  switch (node.type) {
    case "function_declaration": {
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
    case "method_declaration": {
      out.push({
        kind: "function",
        name: nameOf(node, locale),
        typeLevel: false,
        node,
        bodyNode: node.childForFieldName("body"),
        container: receiverName(node),
      });
      return;
    }
    case "type_declaration": {
      // type 分组声明拆成每个 type_spec 一个单元
      for (const spec of node.namedChildren.filter((c) => c.type === "type_spec")) {
        const t = spec.childForFieldName("type");
        out.push({
          kind: "type",
          name: nameOf(spec, locale),
          typeLevel: true,
          node: spec,
          bodyNode: t && (t.type === "struct_type" || t.type === "interface_type") ? t : null,
          container,
        });
      }
      return;
    }
    case "const_declaration":
    case "var_declaration": {
      for (const spec of node.namedChildren.filter(
        (c) => c.type === "const_spec" || c.type === "var_spec",
      )) {
        out.push({
          kind: "variable",
          name: nameOf(spec, locale),
          typeLevel: false,
          node: spec,
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

/** 截断文本但不切断字符串字面量（未闭合引号会把后续行高亮成字符串色） */
function truncateSafe(text: string, limit: number): string {
  if (text.length <= limit) return text;
  let inStr: string | null = null;
  let strStart = -1;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\" && inStr !== "`") escaped = true; // 反引号是 Go 原始字符串，无转义
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      strStart = i;
      continue;
    }
    if (i >= limit) return `${text.slice(0, i)}…`;
  }
  // limit 落在字符串内：从字符串起点前截断
  if (inStr && strStart > 0) return `${text.slice(0, strStart)}…`;
  return `${text.slice(0, limit)}…`;
}

/**
 * `if err != nil { return … }`（无初始化语句、函数体仅一条 return）→ 单行标记；否则 null。
 * 返回值为 nil/err 之外的内容时保留其文本（fmt.Errorf 的包装信息是业务定位信息）。
 * 标记文本锚定 Go 源码关键字，属伪代码而非文案，不随语言切换翻译。
 */
function errCheckMarker(node: Node, _source: string): string | null {
  if (node.childForFieldName("initializer")) return null; // if err := f(); … 的初始化里有真实调用，保留
  const cond = node.childForFieldName("condition");
  if (!cond || cond.type !== "binary_expression") return null;
  const opOk = cond.children.some((c) => c.type === "!=");
  if (!opOk || cond.childForFieldName("left")?.text !== "err") return null;
  if (cond.childForFieldName("right")?.text !== "nil") return null;
  // consequence 结构为 block → statement_list → 语句
  const consequence = node.childForFieldName("consequence");
  const list = consequence?.namedChildren.find((c) => c.type === "statement_list") ?? consequence;
  const stmts = (list?.namedChildren ?? []).filter((c) => c.type !== "comment");
  if (stmts.length !== 1 || stmts[0]!.type !== "return_statement") return null;
  const returned = stmts[0]!.namedChildren[0]?.text.trim() ?? "";
  const trivial =
    returned === "" || returned.split(",").every((s) => ["nil", "err"].includes(s.trim()));
  if (trivial) return "if err: return";
  return `if err: return ${truncateSafe(returned, 60)}`;
}

/** Go 简化器：类型位置擦除 + `if err != nil { return }` 错误传播折叠为单行标记 */
export function goSimplify(node: Node, source: string, ops: SimplifyOp[]): boolean | void {
  switch (node.type) {
    case "if_statement": {
      const marker = errCheckMarker(node, source);
      if (marker) {
        ops.push(replaceNode(node, marker));
        return true;
      }
      return false;
    }
    case "function_declaration":
    case "method_declaration":
    case "method_elem": {
      const result = node.childForFieldName("result");
      if (result) ops.push(del(result));
      return false;
    }
    case "parameter_declaration": {
      const type = node.childForFieldName("type");
      // 有名字时连前导空格一起删（"addr string" → "addr"，不留残空格）
      if (type) {
        ops.push(
          node.childForFieldName("name")
            ? delSwallowingLeadingSpace(type.startIndex, type.endIndex, source)
            : del(type),
        );
      }
      return false;
    }
    case "variadic_parameter_declaration": {
      // 保留 ... 提示可变形参
      const type = node.childForFieldName("type");
      if (!type) return false;
      const prev = type.previousSibling;
      const start =
        prev && !prev.isNamed && prev.type === "..." ? prev.startIndex : type.startIndex;
      ops.push({ start, end: type.endIndex, replacement: "..." });
      return false;
    }
    case "field_declaration": {
      // 结构体字段擦除类型；tag 是序列化线协议（业务契约）保留；无名内嵌字段的类型即名字，保留
      const name = node.childForFieldName("name");
      const type = node.childForFieldName("type");
      if (name && type) {
        ops.push(delSwallowingLeadingSpace(type.startIndex, type.endIndex, source));
      }
      return false;
    }
    case "var_spec":
    case "const_spec": {
      const type = node.childForFieldName("type");
      if (type) ops.push(delSwallowingLeadingSpace(type.startIndex, type.endIndex, source));
      return false;
    }
    case "type_parameter_list":
      ops.push(del(node));
      return true;
    case "generic_type": {
      const args = node.childForFieldName("type_arguments");
      if (args) ops.push(del(args));
      return false;
    }
  }
  return false;
}

/* ---- 顶层块折叠（查看器） ---- */

function goFoldKind(node: Node): FoldKind | null {
  if (node.type === "import_declaration") return "import";
  if (node.type === "type_declaration") return "type-decl";
  return null;
}

function collectImportPaths(node: Node, out: string[]): void {
  if (node.type === "import_spec") {
    out.push(node.childForFieldName("path")?.text.replace(/^"|"$/g, "") ?? "?");
    return;
  }
  if (node.type === "interpreted_string_literal") {
    out.push(node.text.replace(/^"|"$/g, ""));
    return;
  }
  for (const c of node.namedChildren) collectImportPaths(c, out);
}

function typeSpecSummary(spec: Node, locale: Locale): string {
  const name = nameOf(spec, locale);
  const t = spec.childForFieldName("type");
  if (t?.type === "struct_type") {
    const list = t.namedChildren.find((c) => c.type === "field_declaration_list");
    const fields = (list?.namedChildren ?? [])
      .map((f) => f.childForFieldName("name")?.text ?? f.childForFieldName("type")?.text ?? null)
      .filter((x): x is string => x != null);
    return fields.length > 0
      ? `type ${name} struct { ${nameList(fields, locale)} }`
      : `type ${name} struct`;
  }
  if (t?.type === "interface_type") {
    const methods = t.namedChildren
      .filter((c) => c.type === "method_elem")
      .map((m) => nameOf(m, locale));
    return methods.length > 0
      ? `type ${name} interface { ${nameList(methods, locale)} }`
      : `type ${name} interface`;
  }
  return `type ${name}`;
}

function goFoldSummary(kind: FoldKind, nodes: Node[], _source: string, locale: Locale): string {
  if (kind === "import") {
    const paths: string[] = [];
    for (const n of nodes) collectImportPaths(n, paths);
    return messages(locale).analysis.importsFold(
      "import",
      paths.length,
      paths.slice(0, 4),
      paths.length > 4,
    );
  }
  const specs = nodes[0]!.namedChildren.filter((c) => c.type === "type_spec");
  return specs
    .map((s) => typeSpecSummary(s, locale))
    .join(messages(locale).analysis.typeSpecJoiner);
}

/** diff 折叠组的成员定位：挂在 type_spec 上（type (...) 多 spec 声明有逐 spec 精度） */
function goTypeDeclMembers(node: Node, locale: Locale): TypeDeclMembers | null {
  if (node.type !== "type_spec") return null;
  const name = nameOf(node, locale);
  const t = node.childForFieldName("type");
  const memberOf = (m: Node) => {
    const n = m.childForFieldName("name")?.text ?? null;
    return n ? { name: n, range: nodeRowRange(m) } : null;
  };
  if (t?.type === "struct_type") {
    const list = t.namedChildren.find((c) => c.type === "field_declaration_list");
    const members = (list?.namedChildren ?? [])
      .map((f) => {
        // 嵌入字段没有 name，取类型文本（与 typeSpecSummary 一致）
        const named = memberOf(f);
        if (named) return named;
        const embedded = f.childForFieldName("type")?.text ?? null;
        return embedded ? { name: embedded, range: nodeRowRange(f) } : null;
      })
      .filter((x): x is { name: string; range: [number, number] } => x != null);
    return { name, members };
  }
  if (t?.type === "interface_type") {
    const members = t.namedChildren
      .filter((c) => c.type === "method_elem")
      .map(memberOf)
      .filter((x): x is { name: string; range: [number, number] } => x != null);
    return { name, members };
  }
  return { name, members: [] };
}

export const goProfile: LanguageProfile = {
  id: "go",
  extensions: ["go"],
  grammarFile: "go",
  collect(root, locale) {
    const out: DeclarationInfo[] = [];
    for (const c of root.namedChildren) collectNode(c, "", out, locale);
    return out;
  },
  simplify: goSimplify,
  foldKind: goFoldKind,
  foldSummary: goFoldSummary,
  typeDeclMembers: goTypeDeclMembers,
};
