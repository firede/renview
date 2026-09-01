import type { Node } from "web-tree-sitter";

/** parse-diff 0.12 的 File/Change 结构（库未导出类型时使用的最小声明） */
export interface ParsedChange {
  type: "normal" | "add" | "del";
  ln?: number;
  ln1?: number;
  ln2?: number;
  content: string;
}

export interface ParsedFile {
  chunks: Array<{ changes: ParsedChange[] }>;
  from: string;
  to: string;
  deletions: number;
  additions: number;
}

export interface ChangedLines {
  oldLines: Set<number>;
  newLines: Set<number>;
}

/** 从解析后的 diff 提取新旧两侧各自的真实变更行（不含上下文行） */
export function changedLinesOf(file: ParsedFile): ChangedLines {
  const oldLines = new Set<number>();
  const newLines = new Set<number>();
  for (const chunk of file.chunks) {
    for (const c of chunk.changes) {
      if (c.type === "del" && c.ln != null) oldLines.add(c.ln);
      else if (c.type === "add" && c.ln != null) newLines.add(c.ln);
    }
  }
  return { oldLines, newLines };
}

/** 节点（0-based 行）是否与变更行集（1-based）有交集 */
export function touchedBy(node: Node, lines: Set<number>): boolean {
  const start = node.startPosition.row + 1;
  const end = node.endPosition.row + 1;
  for (const ln of lines) if (ln >= start && ln <= end) return true;
  return false;
}

/** 计算 lines 中落在 [startRow, endRow]（0-based 闭区间）内的数量 */
export function countLinesIn(node: Node, lines: Set<number>): number {
  const start = node.startPosition.row + 1;
  const end = node.endPosition.row + 1;
  let n = 0;
  for (const ln of lines) if (ln >= start && ln <= end) n++;
  return n;
}
