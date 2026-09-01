import { useCallback, useEffect, useMemo, useState } from "react";
import type { ViewerFile } from "../../src/analysis/types";

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

const DEGRADE_LABEL: Record<string, string> = {
  "no-profile": "该语言暂无简化规则",
  "parse-error": "解析失败",
  "too-large": "文件过大",
  binary: "二进制文件",
};

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
  const [files, setFiles] = useState<string[] | null>(null);
  const [filter, setFilter] = useState("");
  const [path, setPath] = useState<string | null>(jump?.path ?? null);
  const [data, setData] = useState<ViewerFile | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrollTo, setScrollTo] = useState<number | null>(jump?.line ?? null);

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

  // 数据到达后滚动到目标行
  useEffect(() => {
    if (data && scrollTo != null) {
      document.getElementById(`L${scrollTo}`)?.scrollIntoView({ block: "center" });
      setScrollTo(null);
    }
  }, [data, scrollTo]);

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

  const hasSimplified = data?.simplified != null;

  return (
    <div className="body">
      <aside className="sidebar">
        <div className="sidebar-filter">
          <input
            className="filter-input"
            placeholder="过滤文件…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
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
        {files && visible.length === 0 && <div className="dim pad note">无匹配文件</div>}
      </aside>
      <main className="content">
        {!path && <div className="center-note">选择一个文件开始浏览</div>}
        {path && (
          <>
            <div className="file-toolbar">
              <span className="file-title">{path}</span>
              {loading && <span className="dim">加载中…</span>}
              {data?.degradedReason && (
                <span className="dim">已显示源码（{DEGRADE_LABEL[data.degradedReason]}）</span>
              )}
              <span className="spacer" />
              {hasSimplified && (
                <>
                  <button
                    className={!showSource ? "active" : ""}
                    onClick={() => setShowSource(false)}
                  >
                    简化
                  </button>
                  <button
                    className={showSource ? "active" : ""}
                    onClick={() => setShowSource(true)}
                  >
                    源码
                  </button>
                </>
              )}
            </div>
            {data && !showSource && data.outline.length > 0 && (
              <div className="outline">
                {data.outline.map((o, i) => (
                  <button
                    key={`${o.container}/${o.name}/${i}`}
                    className={`outline-item${o.typeLevel ? " type-level" : ""}`}
                    title={`${o.kind}${o.container ? ` · ${o.container}` : ""}`}
                    onClick={() => document.getElementById(`L${o.range[0]}`)?.scrollIntoView()}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            )}
            {data?.source == null && data && (
              <div className="dim pad note">该文件无法以文本查看。</div>
            )}
            {data && data.source != null && (
              <div className="sview">
                {lines.map((t, i) => (
                  <div key={i} id={`L${i + 1}`} className="srow ctx">
                    <span className="gutter">{i + 1}</span>
                    <pre className="scode">{t === "" ? " " : t}</pre>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
