import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../../i18n";
import type { SimplifyWalker } from "../simplify";
import type { DeclKind } from "../types";

/** 一个声明级审阅单元（函数 / 类 / 类型 / 变量…） */
export interface DeclarationInfo {
  kind: DeclKind;
  name: string;
  /** 纯类型级声明（interface / type alias / 签名型成员等），默认折叠 */
  typeLevel: boolean;
  /** 审阅单元整体节点（含 export 包装），触碰判定与范围用它 */
  node: Node;
  /** 签名/正文切分点；null 表示节点整体即签名 */
  bodyNode: Node | null;
  /** 外层容器名（如所属类、命名空间），用于新旧配对消歧 */
  container: string;
}

/** 顶层块折叠类别：import 连续段合并为一行；type-decl 每个声明各成一行 */
export type FoldKind = "import" | "type-decl";

/** 类型级声明的成员清单（diff 折叠组的成员级摘要用；行号 1-based） */
export interface TypeDeclMembers {
  name: string;
  members: Array<{ name: string; range: [number, number] }>;
}

export interface LanguageProfile {
  id: string;
  extensions: string[];
  /** 对应 parser.ts 的 wasm 语法名 */
  grammarFile: string;
  /** locale 决定声明名兜底（匿名/未知）等用户可见文本的语言 */
  collect(root: Node, locale: Locale): DeclarationInfo[];
  /** 简化器规则；缺省时该语言不生成简化视图 */
  simplify?: SimplifyWalker;
  /** 顶层节点的折叠类别（由实现负责透视 export 等包装节点）；null = 不折叠 */
  foldKind?: (node: Node) => FoldKind | null;
  /** 折叠块的单行摘要（nodes 为同类别的连续段）；locale 决定摘要语言 */
  foldSummary?: (kind: FoldKind, nodes: Node[], source: string, locale: Locale) => string;
  /** node 为可提取成员的类型级声明时返回声明名与成员（含行范围），否则 null（diff 折叠摘要定位用） */
  typeDeclMembers?: (node: Node, locale: Locale) => TypeDeclMembers | null;
}

/** 折叠摘要的名字列表：超过 6 个截断并显示总数 */
export function nameList(names: string[], locale: Locale): string {
  const shown = names.slice(0, 6).join(", ");
  return names.length > 6 ? messages(locale).analysis.nameList(shown, names.length) : shown;
}

/** 节点的 1-based 行范围（typeDeclMembers 的成员区间用） */
export function nodeRowRange(node: Node): [number, number] {
  return [node.startPosition.row + 1, node.endPosition.row + 1];
}
