import { useCallback, useEffect, useMemo, useState } from "react";
import type { ViewerFile, ViewRow } from "../../src/analysis/types";
import { rowIndexOfLine } from "../../src/analysis/view";
import { FileTree } from "./FileTree";
import { TokenSpans, shikiLangForPath, useHighlightedLines } from "./highlight";
import { useStrings } from "./i18n";

interface FilesPayload {
  ok: boolean;
  files?: string[];
  error?: string;
}

interface FilePayload {
  ok: boolean;
  file?: ViewerFile;
  error?: string;
}

export interface JumpTarget {
  path: string;
  line: number;
}

function splitPath(p: string): { dir: string; base: string } {
  const i = p.lastIndexOf("/");
  return i >= 0 ? { dir: p.slice(0, i + 1), base: p.slice(i + 1) } : { dir: "", base: p };
}

/**
 * 只读查看器：浏览仓库文件，默认展示简化（伪代码）视图，可一键切回源码。
 * 简化行与源码 1:1 对齐，行号即锚点（大纲与 diff 跳转都靠它定位）。
 */
export function BrowseView({
  jump,
  onJumpDone,
}: {
  jump: JumpTarget | null;
  onJumpDone: () => void;
}) {
  const s = useStrings();
  const [files, setFiles] = useState<string[] | null>(null);
  const [filter, setFilter] = useState("");
  const [path, setPath] = useState<string | null>(jump?.path ?? null);
  const [data, setData] = useState<ViewerFile | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrollTo, setScrollTo] = useState<number | null>(jump?.line ?? null);
  /** 跳转目标的源码行范围（用于闪烁提示）；[start, end]，1-based */
  const [flash, setFlash] = useState<[number, number] | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const r = await fetch("/api/files");
      const p = (await r.json()) as FilesPayload;
      setFiles(p.ok ? (p.files ?? []) : []);
    } catch {
      setFiles([]);
    }
  }, []);

  const loadFile = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/file?path=${encodeURIComponent(p)}`);
      const d = (await r.json()) as FilePayload;
      setData(d.ok && d.file ? d.file : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 首次加载 + 窗口重新获得焦点时刷新（文件列表与当前文件）
  useEffect(() => {
    void loadFiles();
    const onFocus = () => {
      void loadFiles();
      if (path) void loadFile(path);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadFiles, loadFile, path]);

  // 来自 diff 视图的跳转：定位到文件与变更行
  useEffect(() => {
    if (!jump) return;
    setPath(jump.path);
    setScrollTo(jump.line);
    setShowSource(false);
    onJumpDone();
  }, [jump, onJumpDone]);

  useEffect(() => {
    if (path) void loadFile(path);
  }, [path, loadFile]);

  // 数据到达后滚动到目标行（视图模式按源码行号映射到显示行）
  useEffect(() => {
    if (data && scrollTo != null) {
      const anchor = viewAnchor(data, scrollTo, showSource);
      if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "center" });
      flashRange([scrollTo, scrollTo]);
      setScrollTo(null);
    }
  }, [data, scrollTo, showSource]);

  /** 大纲/跳转定位：源码行号 → 当前模式的元素 id */
  function viewAnchor(d: ViewerFile, ln: number, sourceMode: boolean): string | null {
    if (sourceMode || !d.view) return `L${ln}`;
    const idx = rowIndexOfLine(d.view, ln);
    return idx == null ? null : `R${idx}`;
  }

  /** 闪烁提示一段源码行范围（跳转目标的视觉反馈） */
  function flashRange(range: [number, number]) {
    setFlash(range);
    setTimeout(() => setFlash((cur) => (cur === range ? null : cur)), 1700);
  }

  /** 大纲点击：滚动到声明并闪烁其行范围 */
  const jumpToRange = (range: [number, number]) => {
    if (!data) return;
    const anchor = viewAnchor(data, range[0], showSource);
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
    flashRange(range);
  };

  const visible = useMemo(() => {
    if (!files) return [];
    const q = filter.trim().toLowerCase();
    return q ? files.filter((f) => f.toLowerCase().includes(q)) : files;
  }, [files, filter]);

  const lines = useMemo(() => {
    if (!data) return [];
    if (!showSource && data.simplified) return data.simplified;
    return data.source?.split("\n") ?? [];
  }, [data, showSource]);

  // 简化视图与源码视图都高亮（简化文本仍是合法语法的子集）
  const lang = shikiLangForPath(data?.path);
  const text = useMemo(() => lines.join("\n"), [lines]);
  const tokens = useHighlightedLines(data?.source != null ? text : null, lang);

  const hasSimplified = data?.simplified != null;

  // S 键在简化与源码间切换（输入框聚焦时不生效）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "s" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (hasSimplified) setShowSource((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSimplified]);

  return (
    <div className="body">
      <aside className="sidebar">
        <div className="sidebar-filter">
          <input
            className="filter-input"
            placeholder={s.filterFiles}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {filter.trim() ? (
          // 过滤时退回平铺列表（匹配结果本就稀疏）
          <>
            {visible.map((f) => {
              const { dir, base } = splitPath(f);
              return (
                <button
                  key={f}
                  className={`file-item ${f === path ? "selected" : ""}`}
                  onClick={() => setPath(f)}
                >
                  <span className="file-path" title={f}>
                    {dir && <span className="file-dir">{dir}</span>}
                    <span className="file-base">{base}</span>
                  </span>
                </button>
              );
            })}
            {files && visible.length === 0 && <div className="dim pad note">{s.noMatchingFiles}</div>}
          </>
        ) : (
          files && <FileTree paths={files} selected={path} onSelect={setPath} />
        )}
      </aside>
      <main className="content">
        {!path && <div className="center-note">{s.selectFileToBrowse}</div>}
        {path && (
          <>
            <div className={`file-toolbar${!showSource && hasSimplified ? " projected" : ""}`}>
              <span className="file-title">{path}</span>
              {loading && <span className="dim">{s.loading}</span>}
              {data?.degradedReason && (
                <span className="dim">{s.viewerDegradeLabel[data.degradedReason]}</span>
              )}
              <span className="spacer" />
              {hasSimplified && (
                <span className="seg">
                  <button
                    title={s.shortcutS}
                    className={!showSource ? "active" : ""}
                    onClick={() => setShowSource(false)}
                  >
                    {s.simplified}
                  </button>
                  <button
                    title={s.shortcutS}
                    className={showSource ? "active" : ""}
                    onClick={() => setShowSource(true)}
                  >
                    {s.source}
                  </button>
                </span>
              )}
            </div>
            {data && !showSource && data.outline.length > 0 && (
              <div className="outline">
                {data.outline.map((o, i) => (
                  <button
                    key={`${o.container}/${o.name}/${i}`}
                    className={`outline-item${o.typeLevel ? " type-level" : ""}`}
                    title={`${o.kind}${o.container ? ` · ${o.container}` : ""}`}
                    onClick={() => jumpToRange(o.range)}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            )}
            {data?.source == null && data && (
              <div className="dim pad note">{s.notTextViewable}</div>
            )}
            {data && data.source != null && !showSource && data.view ? (
              <div className="sview">
                {data.view.map((r, i) =>
                  r.kind === "fold" ? (
                    <ViewFoldRow
                      key={i}
                      row={r}
                      index={i}
                      lang={lang}
                      flash={flash != null && r.srcRange[1] >= flash[0] && r.srcRange[0] <= flash[1]}
                    />
                  ) : (
                    <div
                      key={i}
                      id={`R${i}`}
                      className={`srow ctx${flash && r.src >= flash[0] && r.src <= flash[1] ? " flash" : ""}`}
                    >
                      <span className="gutter">{r.src}</span>
                      <pre className="scode">
                        {tokens?.[r.src - 1] ? (
                          <TokenSpans tokens={tokens[r.src - 1]!} />
                        ) : r.text === "" ? (
                          " "
                        ) : (
                          r.text
                        )}
                      </pre>
                    </div>
                  ),
                )}
              </div>
            ) : data && data.source != null ? (
              <div className="sview">
                {lines.map((t, i) => (
                  <div
                    key={i}
                    id={`L${i + 1}`}
                    className={`srow ctx${flash && i + 1 >= flash[0] && i + 1 <= flash[1] ? " flash" : ""}`}
                  >
                    <span className="gutter">{i + 1}</span>
                    <pre className="scode">
                      {tokens?.[i] ? <TokenSpans tokens={tokens[i]!} /> : t === "" ? " " : t}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

/** 折叠块：单行摘要用注释色降权（成员名/模块名保持可见）；展开即审视，源码原文带完整高亮 */
function ViewFoldRow({
  row,
  index,
  lang,
  flash,
}: {
  row: Extract<ViewRow, { kind: "fold" }>;
  index: number;
  lang: string | null;
  flash: boolean;
}) {
  const [open, setOpen] = useState(false);
  // 展开时才高亮原文（惰性）；原文是连续源码切片，脱离上下文高亮可能有轻微断色
  const foldTokens = useHighlightedLines(open ? row.original.join("\n") : null, lang);
  return (
    <div className="vfold">
      <button
        className={`vfold-head${flash ? " flash" : ""}`}
        id={`R${index}`}
        onClick={() => setOpen(!open)}
      >
        {/* gutter 留空：折叠语义由箭头与摘要承担，行号区间可由上下文行号推断（大字号下区间文本必然拥挤） */}
        <span className="gutter" />
        <span className="vfold-summary">
          {open ? "▾" : "▸"} {row.text}
        </span>
      </button>
      {open && (
        <div className="vfold-body">
          {row.original.map((l, i) => (
            <div key={i} className="srow ctx">
              <span className="gutter">{row.srcRange[0] + i}</span>
              <pre className="scode">
                {foldTokens?.[i] ? <TokenSpans tokens={foldTokens[i]!} /> : l === "" ? " " : l}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
