import type { Node, Tree } from "web-tree-sitter";
import type { Locale } from "../i18n";
import type { FoldKind, LanguageProfile } from "./langs/types";

/**
 * 查看器显示行：简化行 + 块折叠标记。
 * 每行携带源码行号/区间（1-based）作为锚定（大纲、diff 跳转、源码切换定位都靠它）；
 * 折叠行展开时展示源码原文（折叠而非删除）。
 */
export type ViewRow =
  | { kind: "line"; text: string; src: number }
  | { kind: "fold"; text: string; srcRange: [number, number]; original: string[] };

/**
 * 由 1:1 简化行构建查看器显示行：
 * - profile 声明的顶层可折叠块（imports 连续段 / 类型级声明）压缩为单行摘要；
 * - 被抹空的行（原文非空、简化后为空）丢弃；原文即空的行保留为视觉间隔（连续空行压成一行）。
 */
export function buildViewRows(
  profile: LanguageProfile,
  tree: Tree,
  source: string,
  simplified: string[],
  locale: Locale,
): ViewRow[] {
  const srcLines = source.split("\n");
  const folds: Array<{ range: [number, number]; text: string }> = [];

  if (profile.foldKind && profile.foldSummary) {
    const kindOf = profile.foldKind;
    const summaryOf = profile.foldSummary;
    const tops: Node[] = tree.rootNode.namedChildren;
    let i = 0;
    while (i < tops.length) {
      const kind: FoldKind | null = kindOf(tops[i]!);
      if (!kind) {
        i++;
        continue;
      }
      const group: Node[] = [tops[i]!];
      let j = i + 1;
      // import 合并连续段；type-decl 每个声明单独成行
      if (kind === "import") {
        while (j < tops.length && kindOf(tops[j]!) === "import") {
          group.push(tops[j]!);
          j++;
        }
      }
      const first = group[0]!;
      const last = group[group.length - 1]!;
      folds.push({
        range: [first.startPosition.row + 1, last.endPosition.row + 1],
        text: summaryOf(kind, group, source, locale),
      });
      i = j;
    }
  }

  const rows: ViewRow[] = [];
  let lastWasBlank = false;
  let fi = 0;
  let ln = 1;
  while (ln <= srcLines.length) {
    const f = folds[fi];
    if (f && ln === f.range[0]) {
      rows.push({
        kind: "fold",
        text: f.text,
        srcRange: f.range,
        original: srcLines.slice(f.range[0] - 1, f.range[1]),
      });
      lastWasBlank = false;
      ln = f.range[1] + 1;
      fi++;
      continue;
    }
    const text = simplified[ln - 1] ?? "";
    const srcBlank = srcLines[ln - 1]!.trim() === "";
    if (text !== "") {
      rows.push({ kind: "line", text, src: ln });
      lastWasBlank = false;
    } else if (srcBlank && !lastWasBlank) {
      // 原文空行保留一个视觉间隔
      rows.push({ kind: "line", text: "", src: ln });
      lastWasBlank = true;
    }
    // 被抹空的行（原文非空、简化后为空）与连续空行丢弃
    ln++;
  }
  // 文件末尾的空行不保留
  while (rows.length > 0) {
    const last = rows[rows.length - 1]!;
    if (last.kind === "line" && last.text === "") rows.pop();
    else break;
  }
  return rows;
}

/** 源码行号 → 显示行下标（命中折叠区间也算）；找不到时返回其后最近的一行 */
export function rowIndexOfLine(rows: ViewRow[], ln: number): number | null {
  let nearest: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.kind === "line") {
      if (r.src === ln) return i;
    } else if (ln >= r.srcRange[0] && ln <= r.srcRange[1]) {
      return i;
    }
    const start = r.kind === "line" ? r.src : r.srcRange[0];
    if (nearest === null && start > ln) nearest = i;
  }
  return nearest;
}
