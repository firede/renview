import { Tooltip } from "./Tooltip";
import { Fragment, useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import {
  parseDiff,
  Diff,
  Decoration,
  Hunk,
  isDelete,
  isInsert,
  isNormal,
  type ChangeData,
  type FileData,
  type HunkTokens,
  type ViewType,
} from "react-diff-view";
import type { ChangeUnit, FileEntry, ReviewContext } from "../../src/analysis/types";
import { BrowseView } from "./BrowseView";
import { renderDiffToken, shikiLangForPath, useDiffTokens } from "./highlight";
import { useStrings } from "./i18n";
import {
  IconExpandAll,
  IconCollapseAll,
  IconPanelLeft,
  IconRefresh,
  IconSplit,
  IconUnified,
} from "./icons";
import { SideSections, SplitPane } from "./SplitPane";
import { SimplifiedView, type LineJump } from "./SimplifiedView";
import { findRowIndex } from "./navigation";
import { ContextGap } from "./ContextGap";
import {
  changeRow,
  contextGaps,
  expandContext,
  expandedRows,
  rowLine,
  rowScope,
  isScopeStart,
  scopeGroups,
} from "./reviewContext";
import { UnitList } from "./UnitList";
import { defaultLandingIndex, isLowValuePath } from "./fileRank";
import {
  FileList,
  LOW_VALUE_GROUP,
  displayPath,
  fileKey,
  fileStats,
  splitPath,
  type FileGroup,
} from "./FileList";
import { useResource } from "./useResource";
import { useViewerSource } from "./viewerSource";

interface DiffPayload {
  snapshot?: string;
  ok: boolean;
  repoRoot?: string;
  diffArgs?: string[];
  diff?: string;
  files?: FileEntry[];
  generatedAt?: number;
  error?: string;
  /** 网络层失败（进程退出/端口不可达），与服务端返回的业务错误区分 */
  unreachable?: boolean;
}

/** 原始 diff 的行锚 id：新增/上下文行挂新侧行号，删除行挂旧侧行号（双列模式下 id 落在对应侧单元格，统一可用 getElementById 定位） */
function rawAnchorId(c: ChangeData): string | undefined {
  if (isInsert(c)) return `rvn-${c.lineNumber}`;
  if (isDelete(c)) return `rvo-${c.lineNumber}`;
  if (isNormal(c)) return `rvn-${c.newLineNumber}`;
  return undefined;
}

/** 跳转目标行 → 原始 diff 行锚：该侧首个不早于目标的渲染行；目标晚于所有行时落最后一行 */
function findRawAnchor(file: FileData, jump: LineJump): string | null {
  const changes = file.hunks.flatMap((h) => h.changes);
  const rows = changes.map((c) =>
    isInsert(c)
      ? { kind: "add" as const, text: c.content, newLn: c.lineNumber }
      : isDelete(c)
        ? { kind: "del" as const, text: c.content, oldLn: c.lineNumber }
        : { kind: "ctx" as const, text: c.content, oldLn: c.oldLineNumber, newLn: c.newLineNumber },
  );
  const idx = findRowIndex(rows, jump);
  return idx == null ? null : (rawAnchorId(changes[idx]!) ?? null);
}

/** 原始 diff 视图：带行锚定与单元跳转（滚动 + 行号加粗常驻；不加闪烁动画——tr 上的背景动画与 td 底色冲突） */
function RawDiff({
  file,
  viewType,
  tokens,
  jump,
  context,
  gaps,
  onExpand,
}: {
  file: FileData;
  viewType: ViewType;
  tokens: HunkTokens | null;
  jump: LineJump | null;
  context: ReviewContext | null;
  gaps: ReturnType<typeof contextGaps>;
  onExpand: (start: number, end: number) => void;
}) {
  /** 持久定位的行锚 id（点击代码区或切换文件取消） */
  const lastJump = useRef<LineJump | null>(null);
  const [locatedId, setLocatedId] = useState<string | null>(null);

  // 切换文件时清除持久定位
  useEffect(() => setLocatedId(null), [file.oldPath, file.newPath]);

  useEffect(() => {
    if (!jump) return;
    const id = findRawAnchor(file, jump);
    if (!id) return;
    if (lastJump.current === jump) return;
    lastJump.current = jump;
    document.getElementById(id)?.scrollIntoView({ block: "center" });
    setLocatedId(id);
  }, [jump, file, viewType]);

  return (
    // 点击代码区任意处取消持久定位提示
    <div onClick={() => setLocatedId(null)}>
      <Diff
        key={`${file.oldPath}→${file.newPath}`}
        diffType={file.type}
        hunks={file.hunks}
        viewType={viewType}
        tokens={tokens ?? undefined}
        renderToken={renderDiffToken}
        generateAnchorID={rawAnchorId}
        generateLineClassName={({ changes, defaultGenerate }) => {
          const base = defaultGenerate();
          const hit = changes.some((c) => c && rawAnchorId(c) === locatedId);
          return hit ? `${base} located`.trim() : base;
        }}
      >
        {(hunks) => (
          <>
            {hunks.map((h, i) => {
              const gap = gaps.find((g) => g.before === i);
              const groups = scopeGroups(h.changes, context);
              return (
                <Fragment key={h.oldStart + ":" + h.newStart}>
                  {gap && (
                    <Decoration>
                      <ContextGap gap={gap} onExpand={onExpand} scope={groups[0]?.scope} />
                    </Decoration>
                  )}
                  {groups.map((group, j) => (
                    <Fragment key={j}>
                      {group.scope &&
                        !(gap && j === 0) &&
                        !isScopeStart(changeRow(group.changes[0]!), context) && (
                          <Decoration>
                            <div className="scope-label">{group.scope}</div>
                          </Decoration>
                        )}
                      <Hunk hunk={{ ...h, changes: group.changes }} />
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
            {gaps
              .filter((g) => g.before === hunks.length)
              .map((g) => (
                <Decoration key={g.start}>
                  <ContextGap gap={g} onExpand={onExpand} trailing />
                </Decoration>
              ))}
          </>
        )}
      </Diff>
    </div>
  );
}

export function App() {
  const s = useStrings();
  const source = useViewerSource();
  const resource = useResource<DiffPayload>(source.url("diff"), source.refreshOnFocus);
  const payload = resource.data;
  const refreshing = resource.loading;
  const load = () => {
    if (source.onRefresh) return source.onRefresh();
    resource.refresh();
    contextResource.refresh();
  };
  const [selected, setSelected] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>("unified");
  const [rawOverride, setRawOverride] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"review" | "browse">("review");
  // 进入过浏览模式后保持挂载：往返审阅不丢失已选文件、过滤词与滚动位置
  const [browseMounted, setBrowseMounted] = useState(false);
  useEffect(() => {
    if (mode === "browse") setBrowseMounted(true);
  }, [mode]);
  // 窄屏先留出阅读空间，侧栏仍可通过顶栏按钮展开。
  const [sidebarHidden, setSidebarHidden] = useState(() => window.innerWidth < 640);
  /** 变更单元点击的行跳转请求（nonce 去重；切换文件时清空） */
  const [unitJump, setUnitJump] = useState<LineJump | null>(null);

  const reviewPane = useRef<HTMLDivElement>(null);
  const reviewScroll = useRef(0);
  const [expansions, setExpansions] = useState<Array<[number, number]>>([]);

  useLayoutEffect(() => {
    if (mode === "review") {
      const content = reviewPane.current?.querySelector<HTMLElement>(".content");
      if (content) content.scrollTop = reviewScroll.current;
      const frame = requestAnimationFrame(() => {
        if (content) content.scrollTop = reviewScroll.current;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [mode]);

  const leaveReview = () => {
    reviewScroll.current =
      reviewPane.current?.querySelector<HTMLElement>(".content")?.scrollTop ?? 0;
    setMode("browse");
  };

  // 变更单元导航：定位到单元内的实际变更；nonce 保证重复点击同一单元也触发
  const jumpToUnit = (u: ChangeUnit) => {
    setUnitJump({
      nonce: Date.now(),
      newLn: u.newRange?.[0],
      oldLn: u.oldRange?.[0],
      newRange: u.newRange,
      oldRange: u.oldRange,
      unitId: u.id,
    });
  };

  const files = useMemo<FileData[]>(
    () => (payload?.ok && payload.diff ? parseDiff(payload.diff) : []),
    [payload?.ok, payload?.diff],
  );
  // 首次加载时若无任何变更，默认进入浏览模式（diff 审阅无内容可看）
  const firstLoaded = useRef(false);
  useEffect(() => {
    if (!payload?.ok || firstLoaded.current) return;
    firstLoaded.current = true;
    if (files.length === 0 && source.allowBrowse !== false) setMode("browse");
  }, [payload, files.length, source.allowBrowse]);

  // 服务端 files 与前端 parseDiff 解析同一文本，顺序一致，按下标对应
  const entries = useMemo(() => payload?.files ?? [], [payload]);

  // 根目录文件优先，其余按目录、文件名排序，让列表位置可预测；锁文件与生成产物沉底。
  const items = useMemo(
    () =>
      files
        .map((file, i) => ({
          file,
          entry: entries[i] ?? null,
          lowValue: isLowValuePath(displayPath(file)),
        }))
        .sort((a, b) => {
          if (a.lowValue !== b.lowValue) return a.lowValue ? 1 : -1;
          const left = splitPath(displayPath(a.file));
          const right = splitPath(displayPath(b.file));
          if (!left.dir && right.dir) return -1;
          if (left.dir && !right.dir) return 1;
          return left.dir.localeCompare(right.dir) || left.base.localeCompare(right.base);
        }),
    [files, entries],
  );

  // 按已排序的目录分组，保留文件的选择索引；低价值文件独立成尾组。
  const fileGroups = useMemo<FileGroup[]>(() => {
    const groups = new Map<string, { item: (typeof items)[number]; index: number }[]>();
    items.forEach((item, index) => {
      const key = item.lowValue ? LOW_VALUE_GROUP : splitPath(displayPath(item.file)).dir;
      const group = groups.get(key) ?? [];
      group.push({ item, index });
      groups.set(key, group);
    });
    return [...groups];
  }, [items]);

  // 未选择时先看契约：落到首个含签名变更的文件（其次有声明级变更、非低价值文件）。
  const landing = useMemo(
    () =>
      defaultLandingIndex(
        items.map(({ file, entry }) => ({
          path: displayPath(file),
          signatureChanges: entry?.projection?.summary.signature ?? 0,
          unitCount: entry?.projection?.units.length ?? 0,
        })),
      ),
    [items],
  );
  // 按路径身份保留选中项，刷新引起的排序变化不应把用户带到另一文件。
  const found = items.findIndex(({ file }) => fileKey(file) === selected);
  const safeSelected = found >= 0 ? found : landing;
  const selectFile = (index: number) => {
    const f = items[index]?.file;
    if (!f) return;
    setSelected(fileKey(f));
    setRawOverride(null);
    setUnitJump(null);
  };
  /** 本次会话看过的文件：离开某文件时记入（会话内存，不持久化） */
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const selectedFile = items[safeSelected]?.file ?? null;
  const listedEntry = items[safeSelected]?.entry ?? null;
  const contextResource = useResource<
    Omit<ReviewContext, "diff"> & {
      diff?: string;
      snapshot?: string;
      entry?: FileEntry;
      ok: boolean;
      error?: string;
    }
  >(
    selectedFile
      ? source.url("review-file", {
          path: displayPath(selectedFile),
          ...(payload?.snapshot ? { snapshot: payload.snapshot } : {}),
        })
      : null,
    source.refreshOnFocus,
  );
  // 稳定上下文引用，避免高亮完成后的渲染重建文件并再次触发高亮。
  const context = useMemo(
    () =>
      contextResource.data?.ok &&
      (payload?.snapshot
        ? contextResource.data.snapshot === payload.snapshot
        : contextResource.data.diff === payload?.diff)
        ? { ...contextResource.data, diff: payload?.diff ?? "" }
        : null,
    [contextResource.data, payload?.snapshot, payload?.diff],
  );
  const selectedEntry = context?.entry ?? listedEntry;
  useEffect(() => setExpansions([]), [selectedFile]);
  // 切换文件时回到顶部；按路径身份判定，聚焦刷新重建的同一文件不重置
  const selectedKey = selectedFile ? fileKey(selectedFile) : null;
  const lastKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = lastKey.current;
    lastKey.current = selectedKey;
    if (prev != null && prev !== selectedKey) {
      setVisited((v) => (v.has(prev) ? v : new Set(v).add(prev)));
    }
    const content = reviewPane.current?.querySelector<HTMLElement>(".content");
    if (content) content.scrollTop = 0;
    // 默认落地或键盘切换的文件可能不在侧栏可视区，就近滚入（点击选中时不移动）
    reviewPane.current
      ?.querySelector<HTMLElement>(".file-item.selected")
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);
  const expandedFile = useMemo(
    () =>
      selectedFile && context?.oldFile?.source != null
        ? expandContext(selectedFile, context.oldFile.source, expansions)
        : selectedFile,
    [selectedFile, context, expansions],
  );
  const gaps = useMemo(
    () =>
      expandedFile && context?.oldFile?.source != null
        ? contextGaps(expandedFile, context.oldFile.source)
        : [],
    [expandedFile, context],
  );
  const simplified = useMemo(
    () =>
      selectedEntry?.simplified && selectedFile && expandedFile && context
        ? expandedRows(selectedEntry.simplified, selectedFile, expandedFile, context)
        : selectedEntry?.simplified,
    [selectedEntry, selectedFile, expandedFile, context],
  );
  const updateExpansions = (ranges: Array<[number, number]>) => {
    const content = reviewPane.current?.querySelector<HTMLElement>(".content");
    const top = content?.getBoundingClientRect().top ?? 0;
    const anchor = [
      ...(content?.querySelectorAll<HTMLElement>(
        "[data-new-line], [data-old-line], [id^='rvn-'], [id^='rvo-']",
      ) ?? []),
    ]
      .filter((el) => {
        if (el.getBoundingClientRect().height <= 0) return false;
        if (ranges.length) return true;
        // 收起时选择仍在默认 diff 中的行，避免定位到即将消失的上下文。
        const newLn = Number(el.dataset.newLine || (el.id.startsWith("rvn-") ? el.id.slice(4) : 0));
        const oldLn = Number(el.dataset.oldLine || (el.id.startsWith("rvo-") ? el.id.slice(4) : 0));
        return selectedFile?.hunks.some(
          (h) =>
            (newLn > 0 && newLn >= h.newStart && newLn < h.newStart + h.newLines) ||
            (oldLn > 0 && oldLn >= h.oldStart && oldLn < h.oldStart + h.oldLines),
        );
      })
      .sort(
        (a, b) =>
          Math.abs(a.getBoundingClientRect().top - top - 48) -
          Math.abs(b.getBoundingClientRect().top - top - 48),
      )[0];
    const offset = anchor
      ? Math.max(
          top,
          Math.min(
            anchor.getBoundingClientRect().top,
            (content?.getBoundingClientRect().bottom ?? top + 48) - 24,
          ),
        )
      : undefined;
    const id = anchor?.id;
    const anchorNew = anchor?.dataset.newLine;
    const anchorOld = anchor?.dataset.oldLine;
    setExpansions(ranges);
    requestAnimationFrame(() => {
      const next = anchorNew
        ? content?.querySelector<HTMLElement>(`[data-new-line="${anchorNew}"]`)
        : anchorOld
          ? content?.querySelector<HTMLElement>(`[data-old-line="${anchorOld}"]`)
          : id
            ? document.getElementById(id)
            : null;
      if (content && next && offset != null)
        content.scrollTop += next.getBoundingClientRect().top - offset;
    });
  };
  const expand = (start: number, end: number) => updateExpansions([...expansions, [start, end]]);
  const expandAllContext = () =>
    updateExpansions([...expansions, ...gaps.map((g): [number, number] => [g.start, g.end])]);
  const beforeRow = (row: import("../../src/analysis/types").SRow, i: number) => {
    const oldLn = rowLine(row, "old");
    const newLn = rowLine(row, "new");
    const gap = gaps.find((g) => {
      const next = expandedFile?.hunks[g.before];
      if (!next) return false;
      const matches =
        (oldLn != null && oldLn >= next.oldStart) || (newLn != null && newLn >= next.newStart);
      const prev = simplified?.rows[i - 1];
      return (
        matches &&
        (!prev ||
          ((rowLine(prev, "old") ?? 0) < next.oldStart &&
            (rowLine(prev, "new") ?? 0) < next.newStart))
      );
    });
    const scope = rowScope(row, context);
    const prev = simplified?.rows[i - 1];
    const changedScope = !prev || rowScope(prev, context) !== scope;
    return (
      <>
        {gap && <ContextGap gap={gap} onExpand={expand} scope={scope} />}
        {scope && !gap && changedScope && !isScopeStart(row, context) && (
          <div className="scope-label">{scope}</div>
        )}
      </>
    );
  };

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
  /** 当前文件简化视图里的擦除点数（工具条提示：告诉人这里藏了东西、hover 可取回） */
  const erasedCount = useMemo(
    () =>
      selectedEntry?.simplified?.rows.reduce(
        (n, r) => n + (r.kind === "fold" ? 0 : (r.erases?.length ?? 0)),
        0,
      ) ?? 0,
    [selectedEntry],
  );
  const showRaw = rawOverride ?? !hasSimplified;
  // 仅在展示原始 diff 时计算高亮 tokens（懒加载 shiki，完成前纯文本渲染）
  const diffTokens = useDiffTokens(expandedFile && showRaw ? expandedFile : null);

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

  // J/K 上下切换文件，N/P 上下切换变更单元（仅审阅模式；输入框聚焦时不生效）
  const units = selectedEntry?.projection?.units ?? null;
  useEffect(() => {
    if (mode !== "review") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "j" || e.key === "k") {
        const next = safeSelected + (e.key === "j" ? 1 : -1);
        if (next >= 0 && next < items.length) selectFile(next);
      } else if ((e.key === "n" || e.key === "p") && units && units.length > 0) {
        const cur = units.findIndex((u) => u.id === unitJump?.unitId);
        const next = e.key === "n" ? Math.min(cur + 1, units.length - 1) : Math.max(cur - 1, 0);
        if (next !== cur || cur < 0) jumpToUnit(units[next]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // B 键切换侧栏显隐（变更/浏览两模式共用；输入框聚焦时不生效）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "b" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      setSidebarHidden((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const error = resource.error ?? (payload && !payload.ok ? payload.error : null);
  const unreachable = resource.unreachable || (payload && !payload.ok && payload.unreachable);
  if (error || unreachable)
    return (
      <div className="load-error" role="alert">
        <h1>{unreachable ? s.serverGoneTitle : s.loadFailedTitle}</h1>
        {!unreachable && <pre>{error}</pre>}
        {source.errorActions}
      </div>
    );
  if (!payload) return <div className="center-note">{s.loading}</div>;

  return (
    <div className="layout">
      <header className="topbar">
        {source.headerStart}
        <span className="brand">renview</span>
        <Tooltip content={`${s.toggleSidebar} · ${s.shortcutB}`}>
          <button
            className={`icon-btn${sidebarHidden ? "" : " active"}`}
            aria-label={s.toggleSidebar}
            onClick={() => setSidebarHidden((v) => !v)}
          >
            <IconPanelLeft />
          </button>
        </Tooltip>
        {source.allowBrowse !== false && (
          <span className="seg">
            <button
              className={mode === "review" ? "active" : ""}
              onClick={() => {
                setMode("review");
              }}
            >
              {s.modeChanges}
            </button>
            <button className={mode === "browse" ? "active" : ""} onClick={leaveReview}>
              {s.modeBrowse}
            </button>
          </span>
        )}
        {source.header ?? (
          <span className="topbar-detail">
            <Tooltip content={payload.repoRoot}>
              <span className="repo">{payload.repoRoot}</span>
            </Tooltip>
            <code className="args">git diff {payload.diffArgs?.join(" ")}</code>
          </span>
        )}
        <span className="spacer" />
        {mode === "review" && (
          <>
            <span className="totals">
              {s.fileCount(files.length)} <em className="add">+{totals.adds}</em>{" "}
              <em className="del">−{totals.dels}</em>
            </span>
            {source.allowRefresh !== false && (
              <Tooltip content={s.refresh}>
                <button
                  className={`icon-btn${refreshing ? " spinning" : ""}`}
                  aria-label={s.refresh}
                  onClick={() => void load()}
                  disabled={refreshing}
                >
                  <IconRefresh />
                </button>
              </Tooltip>
            )}
          </>
        )}
        {source.headerActions}
      </header>
      {browseMounted && (
        <div className="browse-pane" hidden={mode !== "browse"}>
          <BrowseView
            active={mode === "browse"}
            sidebarHidden={sidebarHidden}
            snapshot={payload.snapshot}
            emptyNote={files.length === 0 ? s.noChanges : undefined}
          />
        </div>
      )}
      <div ref={reviewPane} className="review-pane" hidden={mode !== "review"}>
        {files.length === 0 ? (
          <div className="center-note">{s.noChanges}</div>
        ) : (
          <SplitPane
            hidden={sidebarHidden}
            side={
              <SideSections
                top={{
                  title: s.sectionFiles,
                  hint: s.shortcutFiles,
                  body: (
                    <FileList
                      groups={fileGroups}
                      selectedIndex={safeSelected}
                      visited={visited}
                      onSelect={selectFile}
                    />
                  ),
                }}
                bottom={{
                  title: s.sectionUnits,
                  hint: s.shortcutUnits,
                  body: (
                    <UnitList
                      selectedId={unitJump?.unitId}
                      units={selectedEntry?.projection?.units ?? null}
                      onJump={jumpToUnit}
                    />
                  ),
                }}
              />
            }
          >
            {selectedFile && (
              <>
                <div
                  aria-busy={contextResource.loading}
                  className={`file-toolbar${!showRaw ? " projected" : ""}${contextResource.loading ? " loading" : ""}`}
                >
                  <span className="file-title">{displayPath(selectedFile)}</span>
                  {(gaps.length > 0 || expansions.length > 0) && (
                    <span className="context-actions">
                      <Tooltip content={s.expandAll}>
                        <button
                          className="icon-btn"
                          aria-label={s.expandAll}
                          disabled={gaps.length === 0}
                          onClick={expandAllContext}
                        >
                          <IconExpandAll />
                        </button>
                      </Tooltip>
                      <Tooltip content={s.collapseAll}>
                        <button
                          className="icon-btn"
                          aria-label={s.collapseAll}
                          disabled={expansions.length === 0}
                          onClick={() => updateExpansions([])}
                        >
                          <IconCollapseAll />
                        </button>
                      </Tooltip>
                    </span>
                  )}
                  {selectedEntry?.degradedReason &&
                    selectedEntry.degradedReason !== "no-profile" && (
                      <span className="dim">
                        {s.fellBack(s.degradeLabel[selectedEntry.degradedReason])}
                      </span>
                    )}
                  {!showRaw &&
                    selectedEntry?.simplified &&
                    selectedEntry.simplified.stats.folded > 0 && (
                      <span className="dim">
                        {s.foldedLines(selectedEntry.simplified.stats.folded)}
                      </span>
                    )}
                  {!showRaw && erasedCount > 0 && (
                    <Tooltip content={s.erasedHint}>
                      <span className="dim">{s.erasedCount(erasedCount)}</span>
                    </Tooltip>
                  )}
                  <span className="spacer" />
                  {showRaw && (
                    <span className="seg">
                      <Tooltip content={s.unified}>
                        <button
                          className={`icon-btn${viewType === "unified" ? " active" : ""}`}
                          aria-label={s.unified}
                          onClick={() => setViewType("unified")}
                        >
                          <IconUnified />
                        </button>
                      </Tooltip>
                      <Tooltip content={s.split}>
                        <button
                          className={`icon-btn${viewType === "split" ? " active" : ""}`}
                          aria-label={s.split}
                          onClick={() => setViewType("split")}
                        >
                          <IconSplit />
                        </button>
                      </Tooltip>
                    </span>
                  )}
                  {hasSimplified && (
                    <span className="seg">
                      <Tooltip content={s.shortcutS}>
                        <button
                          className={!showRaw ? "active" : ""}
                          onClick={() => setRawOverride(false)}
                        >
                          {s.simplified}
                        </button>
                      </Tooltip>
                      <Tooltip content={s.shortcutS}>
                        <button
                          className={showRaw ? "active" : ""}
                          onClick={() => setRawOverride(true)}
                        >
                          {s.rawDiff}
                        </button>
                      </Tooltip>
                    </span>
                  )}
                </div>
                {contextResource.error && (
                  <div className="error pad">
                    {s.loadError(contextResource.error)}{" "}
                    <button onClick={source.onRefresh ?? contextResource.refresh}>
                      {s.refresh}
                    </button>
                  </div>
                )}
                {contextResource.data?.ok && !context && (
                  <div className="dim pad">{s.contextChanged}</div>
                )}
                {!showRaw && simplified ? (
                  <SimplifiedView
                    key={fileKey(selectedFile)}
                    data={simplified}
                    beforeRow={beforeRow}
                    afterRows={gaps
                      .filter((g) => g.before === expandedFile?.hunks.length)
                      .map((g) => (
                        <ContextGap key={g.start} gap={g} onExpand={expand} trailing />
                      ))}
                    lang={shikiLangForPath(displayPath(selectedFile))}
                    jump={unitJump}
                  />
                ) : (
                  <RawDiff
                    key={fileKey(selectedFile)}
                    file={expandedFile!}
                    context={context}
                    gaps={gaps}
                    onExpand={expand}
                    viewType={viewType}
                    tokens={diffTokens}
                    jump={unitJump}
                  />
                )}
              </>
            )}
          </SplitPane>
        )}
      </div>
    </div>
  );
}
