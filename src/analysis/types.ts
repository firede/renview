/** 投影数据模型：服务端构建，前端渲染。行号均为 1-based。 */
import type { SimplifiedViewData } from "./simplify";

export type { SimplifiedViewData, SRow } from "./simplify";

export type ChangeKind = "signature" | "body" | "type-only" | "added" | "removed";
export type DeclKind = "function" | "class" | "type" | "variable" | "other";

export interface BodySummaryItem {
  /** tree-sitter 节点类型，如 if_statement */
  kind: string;
  /** 首行预览（截断） */
  preview: string;
  changedLines: number;
}

export interface ChangeUnit {
  id: string;
  kind: DeclKind;
  name: string;
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
