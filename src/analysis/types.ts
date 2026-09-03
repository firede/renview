/** 投影数据模型：服务端构建，前端渲染。行号均为 1-based。 */
import type { SimplifiedViewData } from "./simplify";
import type { ViewRow } from "./view";

export type { EraseSpan, SimplifiedViewData, SRow } from "./simplify";
export type { ViewRow } from "./view";

export type ChangeKind = "signature" | "body" | "type-only" | "added" | "removed";
export type DeclKind = "function" | "class" | "type" | "variable" | "other";

export interface BodySummaryItem {
  /** tree-sitter 节点类型，如 if_statement */
  kind: string;
  /** 首行预览（截断） */
  preview: string;
  /** 该语句在新侧的起始行号（1-based），供取简化文本 */
  newLn: number;
  changedLines: number;
}

/** 领域模型（数据形状）变更的成员信息：只留业务词汇，不含类型细节 */
export interface DomainMembers {
  /** 新侧成员全量（业务词汇，供总览展示） */
  members: string[];
  /** 相对旧侧新增的成员 */
  added: string[];
  /** 相对旧侧删除的成员 */
  removed: string[];
}

export interface ChangeUnit {
  id: string;
  kind: DeclKind;
  name: string;
  /** 外层容器名（如所属类、命名空间），跨文件同名实体的展示消歧用 */
  container: string;
  change: ChangeKind;
  /** 新版签名（removed 时无） */
  signature?: string;
  /** 旧版签名（signature 变更时有） */
  oldSignature?: string;
  /** 类型级单元的新旧全文（已截断） */
  typeText?: string;
  oldTypeText?: string;
  /** body 变更的结构化摘要 */
  bodySummary?: BodySummaryItem[];
  /** 数据形状变更的成员信息（kind 为 type 且 profile 能提取成员时有值） */
  domain?: DomainMembers;
  oldRange?: [number, number];
  newRange?: [number, number];
}

export interface FileProjection {
  language: string;
  summary: Record<ChangeKind, number>;
  units: ChangeUnit[];
}

export type FileStatus = "add" | "delete" | "modify" | "rename";

/** 查看器文件大纲条目（来自声明收集，行号 1-based） */
export interface OutlineItem {
  kind: DeclKind;
  name: string;
  container: string;
  typeLevel: boolean;
  range: [number, number];
}

export interface FileEntry {
  oldPath: string | null;
  newPath: string | null;
  status: FileStatus;
  projection: FileProjection | null;
  /** 简化 diff 视图数据；无 profile / 失败时为 null（退回原始 diff） */
  simplified?: SimplifiedViewData | null;
  /** 无投影（退回原始 diff）的原因 */
  degradedReason?: "no-profile" | "parse-error" | "too-large" | "no-source";
}

/** 查看器单文件响应 */
export interface ViewerFile {
  path: string;
  language: string | null;
  /** 源码全文；二进制时为 null */
  source: string | null;
  /** 简化行（与 source 1:1 对齐）；无简化规则或失败为 null */
  simplified: string[] | null;
  /** 查看器显示行（含块折叠）；无简化规则或失败为 null */
  view: ViewRow[] | null;
  outline: OutlineItem[];
  degradedReason?: "no-profile" | "parse-error" | "too-large" | "binary";
}
