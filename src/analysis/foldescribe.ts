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

  /** 覆盖该行的最内层可提取成员的声明（前序遍历，更深匹配后覆盖） */
  function findDecl(side: ParsedSide, ln: number): { node: Node; info: TypeDeclMembers } | null {
    let best: { node: Node; info: TypeDeclMembers } | null = null;
    const walk = (n: Node) => {
      if (ln < n.startPosition.row + 1 || ln > n.endPosition.row + 1) return;
      const info = hook!(n, locale);
      if (info) best = { node: n, info };
      for (const c of n.namedChildren) walk(c);
    };
    walk(side.tree.rootNode);
    return best;
  }

  return (oldLns, newLns) => {
    // 优先用新侧定位（折叠行对两側等价，单側折叠取有行的一侧）
    const useNew = newLns.length > 0 && newSide != null;
    const side = useNew ? newSide : oldSide;
    const lns = useNew ? newLns : oldLns;
    if (!side || lns.length === 0) return null;

    let decl: { node: Node; info: TypeDeclMembers } | null = null;
    for (const ln of lns) {
      const hit = findDecl(side, ln);
      if (!hit) return null;
      if (!decl) decl = hit;
      else if (decl.node.id !== hit.node.id) return null; // 跨声明混合，回落行数摘要
    }
    if (!decl) return null;

    const involved = decl.info.members.filter((m) =>
      lns.some((ln) => ln >= m.range[0] && ln <= m.range[1]),
    );
    return messages(locale).analysis.foldedTypeMembers(
      decl.info.name,
      involved.length > 0 ? nameList(involved.map((m) => m.name), locale) : null,
    );
  };
}
