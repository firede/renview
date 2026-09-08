import type { Node } from "web-tree-sitter";
import { messages, type Locale } from "../i18n";
import { nameList, type LanguageProfile, type TypeDeclMembers } from "./langs/types";
import type { ParsedSide } from "./project";
import type { FoldDescriber } from "./simplify";

/**
 * diff 折叠组的成员级摘要描述器：
 * 折叠行全部落在同一可提取成员的类型级声明内时，产出「声明：涉及成员（类型/格式变更）」摘要；
 * 定位不到、跨声明混合或无成员命中时返回 null（前端回落为行数摘要）。
 * 成员增减在简化视图中本就可见（简化文本不同不折叠），折叠的是同成员的类型/格式细节变化。
 */
export function foldDescriber(
  profile: LanguageProfile,
  oldSide: ParsedSide | null,
  newSide: ParsedSide | null,
  locale: Locale,
): FoldDescriber | null {
  const hook = profile.typeDeclMembers;
  if (!hook) return null;

  type Decl = { node: Node; info: TypeDeclMembers };
  const indices = new Map<ParsedSide, Array<Decl | undefined>>();

  /** 每侧按需建立一次行索引；前序写入，保留同一行上最内层声明的归属。 */
  function declarations(side: ParsedSide) {
    let rows = indices.get(side);
    if (rows) return rows;
    rows = [];
    const walk = (node: Node) => {
      const info = hook!(node, locale);
      if (info) {
        const decl = { node, info };
        for (let ln = node.startPosition.row + 1; ln <= node.endPosition.row + 1; ln++) {
          rows![ln] = decl;
        }
      }
      for (const child of node.namedChildren) walk(child);
    };
    walk(side.tree.rootNode);
    indices.set(side, rows);
    return rows;
  }

  return (oldLns, newLns) => {
    // 优先用新侧定位（折叠行对两側等价，单側折叠取有行的一侧）
    const useNew = newLns.length > 0 && newSide != null;
    const side = useNew ? newSide : oldSide;
    const lns = useNew ? newLns : oldLns;
    if (!side || lns.length === 0) return null;

    const rows = declarations(side);
    let decl: Decl | null = null;
    for (const ln of lns) {
      const hit = rows[ln];
      if (!hit) return null;
      if (!decl) decl = hit;
      else if (decl.node.id !== hit.node.id) return null; // 跨声明混合，回落行数摘要
    }
    if (!decl) return null;

    const sorted = [...lns].sort((a, b) => a - b);
    const involved = decl.info.members.filter((m) => {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (sorted[mid]! < m.range[0]) lo = mid + 1;
        else hi = mid;
      }
      return lo < sorted.length && sorted[lo]! <= m.range[1];
    });
    return messages(locale).analysis.foldedTypeMembers(
      decl.info.name,
      involved.length > 0
        ? nameList(
            involved.map((m) => m.name),
            locale,
          )
        : null,
    );
  };
}
