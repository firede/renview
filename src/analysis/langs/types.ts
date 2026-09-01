import type { Node } from "web-tree-sitter";
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

export interface LanguageProfile {
  id: string;
  extensions: string[];
  /** 对应 parser.ts 的 wasm 语法名 */
  grammarFile: string;
  collect(root: Node): DeclarationInfo[];
}
