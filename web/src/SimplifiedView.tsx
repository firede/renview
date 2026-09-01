import { useMemo, useState } from "react";
import type { SRow, SimplifiedViewData } from "../../src/analysis/types";
import { TokenSpans, useHighlightedLines } from "./highlight";

function FoldRow({ row }: { row: Extract<SRow, { kind: "fold" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="srow-fold">
      <button className="fold-head" onClick={() => setOpen(!open)}>
        <span className="fold-arrow">{open ? "▾" : "▸"}</span>
        {row.count} 行类型/格式性变更已折叠
      </button>
      {open && (
        <div className="fold-body">
          {row.oldLines.map((l, i) => (
            <pre key={`o${i}`} className="scode del">− {l}</pre>
          ))}
          {row.newLines.map((l, i) => (
            <pre key={`n${i}`} className="scode add">+ {l}</pre>
          ))}
        </div>
      )}
    </div>
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
        if (r.kind === "fold") return <FoldRow key={i} row={r} />;
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
