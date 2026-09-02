import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseDiff, Diff, Hunk, type FileData, type ViewType } from "react-diff-view";
import type { ChangeKind, FileEntry, FileStatus } from "../../src/analysis/types";
import { BrowseView, type JumpTarget } from "./BrowseView";
import { renderDiffToken, shikiLangForPath, useDiffTokens } from "./highlight";
import { useStrings } from "./i18n";
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

/** 变更分类徽章的样式类（顺序即展示顺序；文案在 i18n 目录的 summaryChips） */
const SUMMARY_CHIP_CLASS: Array<[ChangeKind, string]> = [
  ["signature", "chip-signature"],
  ["body", "chip-body"],
  ["type-only", "chip-type"],
  ["added", "chip-added"],
  ["removed", "chip-removed"],
];

function splitPath(p: string): { dir: string; base: string } {
  const i = p.lastIndexOf("/");
  return i >= 0 ? { dir: p.slice(0, i + 1), base: p.slice(i + 1) } : { dir: "", base: p };
}

/** 跳转到查看器时的定位行：优先简化视图首个变更行，其次首个有新侧区间的单元 */
function viewerLineOf(entry: FileEntry | null): number {
  const row = entry?.simplified?.rows.find((r) => r.kind !== "fold" && r.newLn != null);
  if (row && row.kind !== "fold" && row.newLn != null) return row.newLn;
  return entry?.projection?.units.find((u) => u.newRange)?.newRange?.[0] ?? 1;
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
  const s = useStrings();
  const [payload, setPayload] = useState<DiffPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number>(0);
  const [viewType, setViewType] = useState<ViewType>("unified");
  const [rawOverride, setRawOverride] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"review" | "browse">("review");
  const [jump, setJump] = useState<JumpTarget | null>(null);

  // 从 diff 跳转查看器：打开该文件完整简化视图并定位到首个变更行（hunk 外上下文由查看器承接）
  const openInViewer = (path: string) => {
    setJump({ path, line: viewerLineOf(selectedEntry) });
    setMode("browse");
  };

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
  // 首次加载时若无任何变更，默认进入浏览模式（diff 审阅无内容可看）
  const firstLoaded = useRef(false);
  useEffect(() => {
    if (!payload?.ok || firstLoaded.current) return;
    firstLoaded.current = true;
    if (files.length === 0) setMode("browse");
  }, [payload, files.length]);

  // 服务端 files 与前端 parseDiff 解析同一文本，顺序一致，按下标对应
  const entries = payload?.files ?? [];

  const safeSelected = Math.min(selected, Math.max(files.length - 1, 0));
  const selectedFile = files[safeSelected] ?? null;
  const selectedEntry = entries[safeSelected] ?? null;

  const totals = useMemo(() => {
    let adds = 0;
    let dels = 0;
    for (const f of files) {
      const stat = fileStats(f);
      adds += stat.adds;
      dels += stat.dels;
    }
    return { adds, dels };
  }, [files]);

  const hasSimplified = selectedEntry?.simplified != null;
  const showRaw = rawOverride ?? !hasSimplified;
  // 仅在展示原始 diff 时计算高亮 tokens（懒加载 shiki，完成前纯文本渲染）
  const diffTokens = useDiffTokens(selectedFile && showRaw ? selectedFile : null);

  // S 键在简化与原始 diff 间切换（输入框聚焦时不生效）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "s" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (mode === "review" && hasSimplified) setRawOverride(!showRaw);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, hasSimplified, showRaw]);

  if (!payload) return <div className="center-note">{s.loading}</div>;
  if (!payload.ok) return <div className="center-note error">{s.loadError(payload.error ?? "")}</div>;

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">renview</span>
        <span className="seg">
          <button className={mode === "review" ? "active" : ""} onClick={() => setMode("review")}>
            {s.modeChanges}
          </button>
          <button className={mode === "browse" ? "active" : ""} onClick={() => setMode("browse")}>
            {s.modeBrowse}
          </button>
        </span>
        <span className="topbar-detail">
          <span className="repo" title={payload.repoRoot}>
            {payload.repoRoot}
          </span>
          <code className="args">git diff {payload.diffArgs?.join(" ")}</code>
        </span>
        <span className="spacer" />
        {mode === "review" && (
          <>
            <span className="totals">
              {s.fileCount(files.length)} <em className="add">+{totals.adds}</em>{" "}
              <em className="del">−{totals.dels}</em>
            </span>
            <button onClick={() => void load()} disabled={refreshing}>
              {refreshing ? s.refreshing : s.refresh}
            </button>
          </>
        )}
      </header>
      {mode === "browse" ? (
        <BrowseView jump={jump} onJumpDone={() => setJump(null)} />
      ) : files.length === 0 ? (
        <div className="center-note">{s.noChanges}</div>
      ) : (
        <div className="body">
          <aside className="sidebar">
            {files.map((f, i) => {
              const stat = fileStats(f);
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
                      {s.statusLabel[f.type as FileStatus] ?? f.type}
                    </span>
                    <em className="add">+{stat.adds}</em>
                    <em className="del">−{stat.dels}</em>
                    {sum && (
                      <span className="chips">
                        {SUMMARY_CHIP_CLASS.filter(([k]) => sum[k] > 0).map(([k, cls]) => (
                          <span key={k} className={`chip ${cls}`}>
                            {s.summaryChips[k]}
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
                <div className={`file-toolbar${!showRaw ? " projected" : ""}`}>
                  <span className="file-title">{selectedFile.newPath}</span>
                  {selectedFile.newPath !== "/dev/null" && (
                    <button onClick={() => openInViewer(selectedFile.newPath)}>
                      {s.openInViewer}
                    </button>
                  )}
                  {selectedEntry?.degradedReason &&
                    selectedEntry.degradedReason !== "no-profile" && (
                      <span className="dim">
                        {s.fellBack(s.degradeLabel[selectedEntry.degradedReason])}
                      </span>
                    )}
                  {!showRaw && selectedEntry?.simplified && selectedEntry.simplified.stats.folded > 0 && (
                    <span className="dim">{s.foldedLines(selectedEntry.simplified.stats.folded)}</span>
                  )}
                  <span className="spacer" />
                  {hasSimplified && (
                    <span className="seg">
                      <button
                        title={s.shortcutS}
                        className={!showRaw ? "active" : ""}
                        onClick={() => setRawOverride(false)}
                      >
                        {s.simplified}
                      </button>
                      <button
                        title={s.shortcutS}
                        className={showRaw ? "active" : ""}
                        onClick={() => setRawOverride(true)}
                      >
                        {s.rawDiff}
                      </button>
                    </span>
                  )}
                  {showRaw && (
                    <span className="seg">
                      <button
                        className={viewType === "unified" ? "active" : ""}
                        onClick={() => setViewType("unified")}
                      >
                        {s.unified}
                      </button>
                      <button
                        className={viewType === "split" ? "active" : ""}
                        onClick={() => setViewType("split")}
                      >
                        {s.split}
                      </button>
                    </span>
                  )}
                </div>
                {!showRaw && selectedEntry?.simplified ? (
                  <SimplifiedView
                    data={selectedEntry.simplified}
                    lang={shikiLangForPath(
                      selectedFile.newPath !== "/dev/null"
                        ? selectedFile.newPath
                        : selectedFile.oldPath,
                    )}
                  />
                ) : (
                  <Diff
                    key={`${selectedFile.oldPath}→${selectedFile.newPath}`}
                    diffType={selectedFile.type}
                    hunks={selectedFile.hunks}
                    viewType={viewType}
                    tokens={diffTokens}
                    renderToken={renderDiffToken}
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
