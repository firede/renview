import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../i18n";
import type { LanguageProfile } from "./langs/types";
import type { ParsedSide } from "./project";

/**
 * diff 中 import 段的折叠：
 * 顶层 import 节点所在行不承载业务变化（查看器已把它们压成一行），审阅视图同样只留一行摘要。
 * 摘要给出新增/删除的模块名，让人知道依赖面怎么变；重排或格式变更只报行数。
 */
export interface ImportFolder {
  /** 该侧行号是否落在顶层 import 节点内 */
  isImport(side: "old" | "new", ln: number): boolean;
  /** 折叠的新旧行 → 摘要 */
  describe(oldLns: number[], newLns: number[]): string;
}

const MAX_NAMES = 6;

export function importFolder(
  profile: LanguageProfile,
  oldSide: ParsedSide | null,
  newSide: ParsedSide | null,
  locale: Locale,
): ImportFolder | null {
  const kindOf = profile.foldKind;
  const namesOf = profile.importNames;
  if (!kindOf || !namesOf) return null;

  /** 行号 → 所属 import 节点（只看顶层节点，与查看器折叠范围一致） */
  const index = (side: ParsedSide | null): Map<number, Node> => {
    const m = new Map<number, Node>();
    if (!side) return m;
    for (const node of side.tree.rootNode.namedChildren) {
      if (kindOf(node) !== "import") continue;
      for (let ln = node.startPosition.row + 1; ln <= node.endPosition.row + 1; ln++)
        m.set(ln, node);
    }
    return m;
  };
  const oldIndex = index(oldSide);
  const newIndex = index(newSide);

  /** 一组行号涉及的模块名：只取模块名所在行也在变更行内的（分组 import 只改一项时不牵连整组） */
  const namesFor = (idx: Map<number, Node>, lns: number[]): string[] => {
    const lineSet = new Set(lns);
    const seen = new Set<number>();
    const out: string[] = [];
    for (const ln of lns) {
      const n = idx.get(ln);
      if (!n || seen.has(n.id)) continue;
      seen.add(n.id);
      for (const m of namesOf(n)) if (lineSet.has(m.line)) out.push(m.name);
    }
    return out;
  };

  return {
    isImport: (side, ln) => (side === "old" ? oldIndex : newIndex).has(ln),
    describe(oldLns, newLns) {
      const oldNames = namesFor(oldIndex, oldLns);
      const newNames = namesFor(newIndex, newLns);
      // 多重集差：同名模块两侧各出现一次视为未变（只是行内容或位置变了）
      const pool = new Map<string, number>();
      for (const n of oldNames) pool.set(n, (pool.get(n) ?? 0) + 1);
      const added: string[] = [];
      for (const n of newNames) {
        const c = pool.get(n) ?? 0;
        if (c > 0) pool.set(n, c - 1);
        else added.push(n);
      }
      const removed = [...pool].flatMap(([n, c]) => Array.from({ length: c }, () => n));
      const total = added.length + removed.length;
      const shownAdded = added.slice(0, MAX_NAMES);
      const shownRemoved = removed.slice(0, Math.max(0, MAX_NAMES - shownAdded.length));
      return messages(locale).analysis.importFold(
        profile.importKeyword ?? "import",
        newLns.length,
        oldLns.length,
        shownAdded,
        shownRemoved,
        total > shownAdded.length + shownRemoved.length,
      );
    },
  };
}
