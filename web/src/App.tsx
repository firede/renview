import { useCallback, useEffect, useMemo, useState } from "react";
import { parseDiff, Diff, Hunk, type FileData, type ViewType } from "react-diff-view";
import type { ChangeKind, FileEntry } from "../../src/analysis/types";
import { SimplifiedView } from "./SimplifiedView";

interface DiffPayload {
  ok: boolean;
  repoRoot?: string;
  diffArgs?: string[];
  diff?: string;
  files?: FileEntry[];
  generatedAt?: number;
  error?: string;
}

const STATUS_LABEL: Record<string, string> = {
  add: "新增",
  delete: "删除",
  modify: "修改",
  rename: "改名",
};

const DEGRADE_LABEL: Record<string, string> = {
  "no-profile": "该语言暂无简化规则",
  "parse-error": "解析失败",
  "too-large": "文件过大",
  "no-source": "无法读取文件内容",
};

const SUMMARY_CHIPS: Array<[ChangeKind, string, string]> = [
  ["signature", "签名", "chip-signature"],
  ["body", "实现", "chip-body"],
  ["type-only", "类型", "chip-type"],
  ["added", "新增", "chip-added"],
  ["removed", "删除", "chip-removed"],
];

function splitPath(p: string): { dir: string; base: string } {
  const i = p.lastIndexOf("/");
  return i >= 0 ? { dir: p.slice(0, i + 1), base: p.slice(i + 1) } : { dir: "", base: p };
}

function fileStats(f: FileData): { adds: number; dels: number } {
  let adds = 0;
  let dels = 0;
  for (const h of f.hunks) {
    for (const c of h.changes) {
      if (c.type === "insert") adds++;
      else if (c.type === "delete") dels++;
    }
  }
  return { adds, dels };
}

export function App() {
  const [payload, setPayload] = useState<DiffPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number>(0);
  const [viewType, setViewType] = useState<ViewType>("unified");
  const [rawOverride, setRawOverride] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/diff");
      setPayload((await r.json()) as DiffPayload);
    } catch (e) {
      setPayload({ ok: false, error: String(e) });
    } finally {
      setRefreshing(false);
    }
  }, []);

  // 首次加载 + 窗口重新获得焦点时刷新
  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const files = useMemo<FileData[]>(
    () => (payload?.ok && payload.diff ? parseDiff(payload.diff) : []),
    [payload],
  );
  // 服务端 files 与前端 parseDiff 解析同一文本，顺序一致，按下标对应
  const entries = payload?.files ?? [];

  const safeSelected = Math.min(selected, Math.max(files.length - 1, 0));
  const selectedFile = files[safeSelected] ?? null;
  const selectedEntry = entries[safeSelected] ?? null;

  const totals = useMemo(() => {
    let adds = 0;
    let dels = 0;
    for (const f of files) {
      const s = fileStats(f);
      adds += s.adds;
      dels += s.dels;
    }
    return { adds, dels };
  }, [files]);

  if (!payload) return <div className="center-note">加载中…</div>;
  if (!payload.ok) return <div className="center-note error">出错了：{payload.error}</div>;

  const hasSimplified = selectedEntry?.simplified != null;
  const showRaw = rawOverride ?? !hasSimplified;

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">renview</span>
        <span className="repo" title={payload.repoRoot}>
          {payload.repoRoot}
        </span>
        <code className="args">git diff {payload.diffArgs?.join(" ")}</code>
        <span className="spacer" />
        <span className="totals">
          {files.length} 个文件 <em className="add">+{totals.adds}</em>{" "}
          <em className="del">−{totals.dels}</em>
        </span>
        <button
          className={viewType === "unified" ? "active" : ""}
          onClick={() => setViewType("unified")}
        >
          单列
        </button>
        <button
          className={viewType === "split" ? "active" : ""}
          onClick={() => setViewType("split")}
        >
          双列
        </button>
        <button onClick={() => void load()} disabled={refreshing}>
          {refreshing ? "刷新中…" : "刷新"}
        </button>
      </header>
      {files.length === 0 ? (
        <div className="center-note">没有检测到变更</div>
      ) : (
        <div className="body">
          <aside className="sidebar">
            {files.map((f, i) => {
              const s = fileStats(f);
              const entry = entries[i];
              const sum = entry?.projection?.summary;
              return (
                <button
                  key={`${f.oldPath}→${f.newPath}`}
                  className={`file-item ${i === safeSelected ? "selected" : ""}`}
                  onClick={() => {
                    setSelected(i);
                    setRawOverride(null);
                  }}
                >
                  <span className="file-path" title={f.newPath}>
                    {splitPath(f.newPath).dir && (
                      <span className="file-dir">{splitPath(f.newPath).dir}</span>
                    )}
                    <span className="file-base">{splitPath(f.newPath).base}</span>
                  </span>
                  <span className="file-meta">
                    <span className={`status status-${f.type}`}>
                      {STATUS_LABEL[f.type] ?? f.type}
                    </span>
                    <em className="add">+{s.adds}</em>
                    <em className="del">−{s.dels}</em>
                    {sum && (
                      <span className="chips">
                        {SUMMARY_CHIPS.filter(([k]) => sum[k] > 0).map(([k, label, cls]) => (
                          <span key={k} className={`chip ${cls}`}>
                            {label}
                            {sum[k]}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </aside>
          <main className="content">
            {selectedFile && (
              <>
                <div className="file-toolbar">
                  <span className="file-title">{selectedFile.newPath}</span>
                  {selectedEntry?.degradedReason && (
                    <span className="dim">
                      已退回原始 diff（{DEGRADE_LABEL[selectedEntry.degradedReason]}）
                    </span>
                  )}
                  {!showRaw && selectedEntry?.simplified && selectedEntry.simplified.stats.folded > 0 && (
                    <span className="dim">已折叠 {selectedEntry.simplified.stats.folded} 行</span>
                  )}
                  <span className="spacer" />
                  {hasSimplified && (
                    <>
                      <button
                        className={!showRaw ? "active" : ""}
                        onClick={() => setRawOverride(false)}
                      >
                        简化
                      </button>
                      <button
                        className={showRaw ? "active" : ""}
                        onClick={() => setRawOverride(true)}
                      >
                        原始 diff
                      </button>
                    </>
                  )}
                </div>
                {!showRaw && selectedEntry?.simplified ? (
                  <SimplifiedView data={selectedEntry.simplified} />
                ) : (
                  <Diff
                    key={`${selectedFile.oldPath}→${selectedFile.newPath}`}
                    diffType={selectedFile.type}
                    hunks={selectedFile.hunks}
                    viewType={viewType}
                  >
                    {(hunks) => hunks.map((h) => <Hunk key={h.content} hunk={h} />)}
                  </Diff>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
