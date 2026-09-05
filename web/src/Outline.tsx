import { useMemo } from "react";
import type { OutlineItem } from "../../src/analysis/types";
import { useStrings } from "./i18n";
import { KindGlyph } from "./icons";

export interface OutlineNode extends OutlineItem {
  children: OutlineNode[];
}

/**
 * 扁平大纲（声明收集按文档序）嵌套化：父级 = 名字等于 container 且行范围包含本项的最小条目。
 * 匹配不到时保持顶层（嵌套仅是展示层投影，失配自然退回平铺）。
 */
export function buildOutlineTree(items: OutlineItem[]): OutlineNode[] {
  const nodes: OutlineNode[] = items.map((i) => ({ ...i, children: [] }));
  const roots: OutlineNode[] = [];
  for (const n of nodes) {
    let parent: OutlineNode | null = null;
    if (n.container) {
      for (const c of nodes) {
        if (c === n || c.name !== n.container) continue;
        if (c.range[0] > n.range[0] || c.range[1] < n.range[1]) continue;
        if (!parent || c.range[1] - c.range[0] < parent.range[1] - parent.range[0]) parent = c;
      }
    }
    (parent ? parent.children : roots).push(n);
  }
  return roots;
}

/** 侧栏大纲面板：VSCode 式层级列表，点击滚动定位到声明（类型级声明降权，与投影语义一致） */
export function OutlinePanel({
  outline,
  onJump,
}: {
  outline: OutlineItem[];
  onJump: (range: [number, number]) => void;
}) {
  const s = useStrings();
  const tree = useMemo(() => buildOutlineTree(outline), [outline]);
  if (tree.length === 0) return <div className="dim pad note">{s.noOutline}</div>;
  return (
    <div className="outline-tree">
      <OutlineLevel nodes={tree} depth={0} onJump={onJump} />
    </div>
  );
}

function OutlineLevel({
  nodes,
  depth,
  onJump,
}: {
  nodes: OutlineNode[];
  depth: number;
  onJump: (range: [number, number]) => void;
}) {
  return (
    <>
      {nodes.map((n, i) => (
        <div key={`${n.container}/${n.kind}/${n.name}/${i}`}>
          <button
            className={`outline-row${n.typeLevel ? " type-level" : ""}`}
            style={{ paddingLeft: 12 + depth * 12 }}
            title={n.container ? `${n.container} · ${n.name}` : n.name}
            onClick={() => onJump(n.range)}
          >
            <KindGlyph kind={n.kind} />
            <span className="outline-name">{n.name}</span>
          </button>
          {n.children.length > 0 && (
            <OutlineLevel nodes={n.children} depth={depth + 1} onJump={onJump} />
          )}
        </div>
      ))}
    </>
  );
}
