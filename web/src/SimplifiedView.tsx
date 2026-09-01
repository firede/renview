import { useMemo, useState } from "react";
import type { SRow, SimplifiedViewData } from "../../src/analysis/types";
import { TokenSpans, useHighlightedLines } from "./highlight";

function FoldRow({ row, lang }: { row: Extract<SRow, { kind: "fold" }>; lang: string | null }) {
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
          {open ? "▾" : "▸"} {row.count} 行类型/格式性变更已折叠
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
  // 高亮文本 = 可见行（fold 行不参与）按序拼接；token 按下标回填。跨 hunk 拼接仅影响颜色连续性。
  const visibleRows = useMemo(
    () => data.rows.filter((r): r is Exclude<SRow, { kind: "fold" }> => r.kind !== "fold"),
    [data],
  );
  const text = useMemo(() => visibleRows.map((r) => r.text).join("\n"), [visibleRows]);
  const tokens = useHighlightedLines(lang ? text : null, lang);

  if (data.rows.length === 0) {
    return <div className="dim note pad">无可见变更（可能全部被折叠或为纯改名）。</div>;
  }
  let vi = 0;
  return (
    <div className="sview">
      {data.rows.map((r, i) => {
        if (r.kind === "fold") return <FoldRow key={i} row={r} lang={lang} />;
        const lineTokens = tokens?.[vi++] ?? null;
        return (
          <div key={i} className={`srow ${r.kind}`}>
            <span className="gutter">{r.oldLn ?? ""}</span>
            <span className="gutter">{r.newLn ?? ""}</span>
            <pre className="scode">
              {lineTokens ? <TokenSpans tokens={lineTokens} /> : r.text === "" ? " " : r.text}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
