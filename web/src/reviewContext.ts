import {
  textLinesToHunk,
  expandFromRawCode,
  type FileData,
  type ChangeData,
} from "react-diff-view";
import type { ReviewContext, SRow, SimplifiedViewData, ViewerFile } from "../../src/analysis/types";

export interface ContextGap {
  start: number;
  end: number;
  before: number;
}

/** 隐藏区间采用旧侧行号，end 不包含在内；只展开两侧共同的未变更行。 */
export function contextGaps(file: FileData, source: string): ContextGap[] {
  const count = source === "" ? 0 : source.split("\n").length - Number(source.endsWith("\n"));
  const gaps: ContextGap[] = [];
  let end = 1;
  file.hunks.forEach((h, i) => {
    if (h.oldStart > end) gaps.push({ start: end, end: h.oldStart, before: i });
    end = Math.max(end, h.oldStart + h.oldLines);
  });
  if (end <= count) gaps.push({ start: end, end: count + 1, before: file.hunks.length });
  return gaps;
}

export function expandContext(
  file: FileData,
  source: string,
  ranges: Array<[number, number]>,
): FileData {
  return {
    ...file,
    hunks: ranges.reduce((hunks, [start, end]) => {
      if (hunks.length) return expandFromRawCode(hunks, source, start, end);
      const hunk = textLinesToHunk(source.split("\n").slice(start - 1, end - 1), start, start);
      return hunk ? [hunk] : [];
    }, file.hunks),
  };
}

export function changeRow(c: ChangeData): Exclude<SRow, { kind: "fold" }> {
  return c.type === "insert"
    ? { kind: "add", text: c.content, newLn: c.lineNumber }
    : c.type === "delete"
      ? { kind: "del", text: c.content, oldLn: c.lineNumber }
      : { kind: "ctx", text: c.content, oldLn: c.oldLineNumber, newLn: c.newLineNumber };
}

export function rowLine(row: SRow, side: "old" | "new"): number | undefined {
  return row.kind === "fold"
    ? side === "old"
      ? row.oldLns?.[0]
      : row.newLns?.[0]
    : side === "old"
      ? row.oldLn
      : row.newLn;
}

/** 原有投影与折叠不重算，只补入原 diff 未包含的上下文。 */
export function expandedRows(
  base: SimplifiedViewData,
  original: FileData,
  expanded: FileData,
  context: ReviewContext,
): SimplifiedViewData {
  const byLine = new Map<string, SRow>();
  const keys = (r: SRow): string[] =>
    r.kind === "fold"
      ? [...(r.oldLns ?? []).map((n) => "o" + n), ...(r.newLns ?? []).map((n) => "n" + n)]
      : [...(r.oldLn == null ? [] : ["o" + r.oldLn]), ...(r.newLn == null ? [] : ["n" + r.newLn])];
  for (const r of base.rows) for (const key of keys(r)) byLine.set(key, r);
  const originalLines = new Set(
    original.hunks.flatMap((h) => h.changes.flatMap((c) => keys(changeRow(c)))),
  );
  const viewRows = new Map(
    context.newFile?.view?.flatMap((r) => (r.kind === "line" ? [[r.src, r] as const] : [])) ?? [],
  );
  const seen = new Set<SRow>();
  const rows: SRow[] = [];
  for (const h of expanded.hunks)
    for (const c of h.changes) {
      const raw = changeRow(c);
      const ks = keys(raw);
      const existing = ks.map((k) => byLine.get(k)).find(Boolean);
      if (existing) {
        if (!seen.has(existing)) rows.push(existing);
        seen.add(existing);
      } else if (c.type === "normal" && !ks.some((k) => originalLines.has(k))) {
        const file = context.newFile;
        const simplified = file?.simplified?.[c.newLineNumber - 1];
        const viewRow = viewRows.get(c.newLineNumber);
        rows.push({
          ...raw,
          text: simplified || c.content,
          erases: viewRow?.kind === "line" ? viewRow.erases : undefined,
        });
      }
    }
  return { ...base, rows };
}

/** 归属来自对应侧的语法大纲，优先最内层函数/类，不依赖点击的单元名称。 */
function declarationOf(file: ViewerFile | null | undefined, line: number | undefined) {
  if (line == null) return null;
  const scope = file?.outline
    .filter(
      (d) =>
        (d.kind === "function" || d.kind === "class") && d.range[0] <= line && d.range[1] >= line,
    )
    .sort((a, b) => a.range[1] - a.range[0] - (b.range[1] - b.range[0]))[0];
  return scope ?? null;
}

export function scopeOf(
  file: ViewerFile | null | undefined,
  line: number | undefined,
): string | null {
  const scope = declarationOf(file, line);
  return scope ? scope.signature || [scope.container, scope.name].filter(Boolean).join(".") : null;
}

export function rowScope(row: SRow, context: ReviewContext | null): string | null {
  const newLine = rowLine(row, "new");
  return newLine != null
    ? scopeOf(context?.newFile, newLine)
    : scopeOf(context?.oldFile, rowLine(row, "old"));
}

export function isScopeStart(row: SRow, context: ReviewContext | null): boolean {
  const newLn = rowLine(row, "new");
  const file = newLn != null ? context?.newFile : context?.oldFile;
  const ln = newLn ?? rowLine(row, "old");
  return (
    file?.outline.some((d) => (d.kind === "function" || d.kind === "class") && d.range[0] === ln) ??
    false
  );
}

/** 原始 diff 按实际归属分段，避免一个 hunk 跨多个函数时错贴标签。 */
export function scopeGroups(changes: ChangeData[], context: ReviewContext | null) {
  const groups: Array<{ scope: string | null; key: string; changes: ChangeData[] }> = [];
  let i = 0;
  while (i < changes.length) {
    const block = [changes[i++]!];
    // 连续增删是双列视图的配对单元，声明改名或增减也不能从中拆开。
    if (block[0]!.type !== "normal") {
      while (i < changes.length && changes[i]!.type !== "normal") block.push(changes[i++]!);
    }
    const row = changeRow(block.find((c) => c.type === "insert") ?? block[0]!);
    const scope = rowScope(row, context);
    const decl =
      row.newLn != null
        ? declarationOf(context?.newFile, row.newLn)
        : declarationOf(context?.oldFile, row.oldLn);
    const key = decl ? `${decl.container}/${decl.name}` : "";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.changes.push(...block);
    else groups.push({ scope, key, changes: block });
  }
  return groups;
}
