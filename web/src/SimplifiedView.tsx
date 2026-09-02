import { useMemo, useState } from "react";
import type { SRow, SimplifiedViewData } from "../../src/analysis/types";
import { DecoratedLine } from "./decor";
import { TokenSpans, useHighlightedLines } from "./highlight";
import { useStrings } from "./i18n";
import { wordDiffRanges, type WordDiff } from "./worddiff";

function FoldRow({ row, lang }: { row: Extract<SRow, { kind: "fold" }>; lang: string | null }) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  // 展开即审视：折叠的原始行带完整语法高亮（新旧两侧分别高亮）
  const oldTokens = useHighlightedLines(open ? row.oldLines.join("\n") : null, lang);
  const newTokens = useHighlightedLines(open ? row.newLines.join("\n") : null, lang);
  return (
    <>
      {/* 与查看器块折叠同一形态：整行可点、gutter 留空、箭头 + 注释色摘要 */}
      <button className="vfold-head" onClick={() => setOpen(!open)}>
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

export function SimplifiedView({ data, lang }: { data: SimplifiedViewData; lang: string | null }) {
  const s = useStrings();
  // 高亮文本 = 可见行（fold 行不参与）按序拼接；token 按下标回填。跨 hunk 拼接仅影响颜色连续性。
  const visibleRows = useMemo(
    () => data.rows.filter((r): r is Exclude<SRow, { kind: "fold" }> => r.kind !== "fold"),
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
    <div className="sview">
      {data.rows.map((r, i) => {
        if (r.kind === "fold") return <FoldRow key={i} row={r} lang={lang} />;
        const lineTokens = tokens?.[vi++] ?? null;
        const wd = r.pair != null ? pairDiffs.get(r.pair) : undefined;
        return (
          <div key={i} className={`srow ${r.kind}`}>
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
