import { useState } from "react";
import type { SRow, SimplifiedViewData } from "../../src/analysis/types";

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

export function SimplifiedView({ data }: { data: SimplifiedViewData }) {
  if (data.rows.length === 0) {
    return <div className="dim note pad">无可见变更（可能全部被折叠或为纯改名）。</div>;
  }
  return (
    <div className="sview">
      {data.rows.map((r, i) =>
        r.kind === "fold" ? (
          <FoldRow key={i} row={r} />
        ) : (
          <div key={i} className={`srow ${r.kind}`}>
            <span className="gutter">{r.oldLn ?? ""}</span>
            <span className="gutter">{r.newLn ?? ""}</span>
            <pre className="scode">{r.text === "" ? " " : r.text}</pre>
          </div>
        ),
      )}
    </div>
  );
}
