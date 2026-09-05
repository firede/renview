import { useEffect, useMemo, useState } from "react";
import type { SRow, SimplifiedViewData } from "../../src/analysis/types";
import { DecoratedLine } from "./decor";
import { TokenSpans, useHighlightedLines } from "./highlight";
import { useStrings } from "./i18n";
import { wordDiffRanges, type WordDiff } from "./worddiff";

/** 行跳转请求（变更单元点击导航）：nonce 保证连续点同一单元也触发；newLn 优先，removed 单元只有 oldLn */
export interface LineJump {
  nonce: number;
  newLn?: number;
  oldLn?: number;
}

/** 行的定位行号：可见行取对应侧行号，折叠行取折叠段首行 */
function lineOf(r: SRow, side: "new" | "old"): number | null {
  if (r.kind === "ctx" || r.kind === "del" || r.kind === "add") {
    return (side === "new" ? r.newLn : r.oldLn) ?? null;
  }
  if (r.kind === "fold") {
    const lns = side === "new" ? r.newLns : r.oldLns;
    return lns && lns.length > 0 ? Math.min(...lns) : null;
  }
  return null;
}

/** 跳转目标行 → 行下标：首个不早于目标的行；目标晚于所有行时落最后一行 */
function findRowIndex(rows: SRow[], jump: LineJump): number | null {
  const side = jump.newLn != null ? "new" : "old";
  const target = jump.newLn ?? jump.oldLn;
  if (target == null) return null;
  let fallback: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const ln = lineOf(rows[i]!, side);
    if (ln == null) continue;
    if (ln >= target) return i;
    fallback = i;
  }
  return fallback;
}

function FoldRow({
  row,
  lang,
  id,
  flash,
  located,
}: {
  row: Extract<SRow, { kind: "fold" }>;
  lang: string | null;
  id: string;
  flash: boolean;
  located: boolean;
}) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  // 展开即审视：折叠的原始行带完整语法高亮（新旧两侧分别高亮）
  const oldTokens = useHighlightedLines(open ? row.oldLines.join("\n") : null, lang);
  const newTokens = useHighlightedLines(open ? row.newLines.join("\n") : null, lang);
  return (
    <>
      {/* 与查看器块折叠同一形态：整行可点、gutter 留空、箭头 + 注释色摘要 */}
      <button
        id={id}
        className={`vfold-head${flash ? " flash" : ""}${located ? " located" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span className="gutter" />
        <span className="gutter" />
        <span className="vfold-summary">
          {open ? "▾" : "▸"} {row.summary ?? s.foldedTypeFormat(row.count)}
        </span>
      </button>
      {open && (
        <div className="fold-body">
          {row.oldLines.map((l, i) => (
            <div key={`o${i}`} className="srow">
              <span className="gutter" />
              <span className="gutter" />
              <pre className="scode del">
                − {oldTokens?.[i] ? <TokenSpans tokens={oldTokens[i]!} /> : l}
              </pre>
            </div>
          ))}
          {row.newLines.map((l, i) => (
            <div key={`n${i}`} className="srow">
              <span className="gutter" />
              <span className="gutter" />
              <pre className="scode add">
                + {newTokens?.[i] ? <TokenSpans tokens={newTokens[i]!} /> : l}
              </pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function SimplifiedView({
  data,
  lang,
  jump,
}: {
  data: SimplifiedViewData;
  lang: string | null;
  jump?: LineJump | null;
}) {
  const s = useStrings();
  /** 一次性闪烁（视觉引导，1.7s 后消退） */
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  /** 持久定位提示：行号加粗常驻，点击代码区或切换文件取消 */
  const [locatedIdx, setLocatedIdx] = useState<number | null>(null);

  // 切换文件（数据更换）时清除持久定位
  useEffect(() => setLocatedIdx(null), [data]);

  // 变更单元导航：滚动到目标行，闪烁一次 + 行号加粗常驻
  useEffect(() => {
    if (!jump) return;
    const idx = findRowIndex(data.rows, jump);
    if (idx == null) return;
    document.getElementById(`srow-${idx}`)?.scrollIntoView({ block: "center" });
    setLocatedIdx(idx);
    setFlashIdx(idx);
    const t = setTimeout(() => setFlashIdx((cur) => (cur === idx ? null : cur)), 1700);
    return () => clearTimeout(t);
  }, [jump, data]);
  // 高亮文本 = 代码行（fold/note 行不参与）按序拼接；token 按下标回填。跨 hunk 拼接仅影响颜色连续性。
  const visibleRows = useMemo(
    () =>
      data.rows.filter(
        (r): r is Extract<SRow, { kind: "ctx" | "del" | "add" }> =>
          r.kind === "ctx" || r.kind === "del" || r.kind === "add",
      ),
    [data],
  );
  const text = useMemo(() => visibleRows.map((r) => r.text).join("\n"), [visibleRows]);
  const tokens = useHighlightedLines(lang ? text : null, lang);

  // 词级高亮：按 pair id 求配对行的差异区间（零交互呈现签名/规则的 delta）
  const pairDiffs = useMemo(() => {
    const byId = new Map<number, { del?: string; add?: string }>();
    for (const r of data.rows) {
      if (r.kind === "fold" || r.pair == null) continue;
      const e = byId.get(r.pair) ?? {};
      e[r.kind === "del" ? "del" : "add"] = r.text;
      byId.set(r.pair, e);
    }
    const out = new Map<number, WordDiff>();
    for (const [id, p] of byId) {
      if (p.del != null && p.add != null) {
        const d = wordDiffRanges(p.del, p.add);
        if (d) out.set(id, d);
      }
    }
    return out;
  }, [data]);

  if (data.rows.length === 0) {
    return <div className="dim note pad">{s.noVisibleChanges}</div>;
  }
  let vi = 0;
  return (
    // 点击代码区任意处取消持久定位提示
    <div className="sview" onClick={() => setLocatedIdx(null)}>
      {data.rows.map((r, i) => {
        if (r.kind === "fold")
          return (
            <FoldRow
              key={i}
              row={r}
              lang={lang}
              id={`srow-${i}`}
              flash={flashIdx === i}
              located={locatedIdx === i}
            />
          );
        const lineTokens = tokens?.[vi++] ?? null;
        const wd = r.pair != null ? pairDiffs.get(r.pair) : undefined;
        return (
          <div
            key={i}
            id={`srow-${i}`}
            className={`srow ${r.kind}${flashIdx === i ? " flash" : ""}${locatedIdx === i ? " located" : ""}`}
          >
            <span className="gutter">{r.oldLn ?? ""}</span>
            <span className="gutter">{r.newLn ?? ""}</span>
            <pre className="scode">
              <DecoratedLine
                text={r.text}
                tokens={lineTokens}
                decor={{
                  hl: wd ? (r.kind === "del" ? wd.a : wd.b) : undefined,
                  hlClass: r.kind === "del" ? "wdel" : r.kind === "add" ? "wadd" : undefined,
                  erases: r.erases,
                }}
              />
            </pre>
          </div>
        );
      })}
    </div>
  );
}
