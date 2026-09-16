import { Fragment, useEffect, useMemo, useState } from "react";
import type { FileData } from "react-diff-view";
import type { ChangeKind, FileEntry, FileStatus } from "../../src/analysis/types";
import { useStrings } from "./i18n";
import { IconChevron, StatusIcon } from "./icons";
import { Tooltip } from "./Tooltip";

/** 文件列表仅汇总代码分类；注释在变更单元区呈现，避免重复强调。 */
const SUMMARY_CHIP_CLASS: Array<[ChangeKind, string]> = [
  ["signature", "chip-signature"],
  ["type-only", "chip-type"],
  ["added", "chip-added"],
  ["removed", "chip-removed"],
  ["body", "chip-body"],
];

export function fileKey(file: FileData): string {
  return JSON.stringify([file.oldPath, file.newPath]);
}

/** 删除文件的新侧是 /dev/null，界面名称仍使用原路径。 */
export function displayPath(file: FileData): string {
  return file.newPath === "/dev/null" ? file.oldPath : file.newPath;
}

export function splitPath(p: string): { dir: string; base: string } {
  const i = p.lastIndexOf("/");
  return i >= 0 ? { dir: p.slice(0, i + 1), base: p.slice(i + 1) } : { dir: "", base: p };
}

export function fileStats(f: FileData): { adds: number; dels: number } {
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

export interface FileListItem {
  file: FileData;
  entry: FileEntry | null;
  /** 锁文件或生成产物：列表尾组降权 */
  lowValue: boolean;
}

/** 低价值文件的分组键（不与任何真实目录冲突） */
export const LOW_VALUE_GROUP = "\0low-value";

export type FileGroup = [key: string, members: Array<{ item: FileListItem; index: number }>];

/**
 * 变更文件列表：按目录分组（可折叠）、可过滤；过滤时退回平铺匹配列表。
 * 选中项所在的折叠组自动展开（默认落地、键盘切换都可能落到折叠组里）。
 */
export function FileList({
  groups,
  selectedIndex,
  visited,
  onSelect,
}: {
  groups: FileGroup[];
  selectedIndex: number;
  /** 本次会话已看过的文件（fileKey） */
  visited: ReadonlySet<string>;
  onSelect: (index: number) => void;
}) {
  const s = useStrings();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const selectedGroup = useMemo(
    () => groups.find(([, members]) => members.some((m) => m.index === selectedIndex))?.[0],
    [groups, selectedIndex],
  );
  // 只在选中项换组时展开：依赖 collapsed 会让用户刚收起的选中组立刻被弹开
  useEffect(() => {
    if (selectedGroup == null) return;
    setCollapsed((prev) => {
      if (!prev.has(selectedGroup)) return prev;
      const next = new Set(prev);
      next.delete(selectedGroup);
      return next;
    });
  }, [selectedGroup]);

  const query = filter.trim().toLowerCase();
  const matches = useMemo(
    () =>
      query
        ? groups.flatMap(([, members]) =>
            members.filter((m) => displayPath(m.item.file).toLowerCase().includes(query)),
          )
        : null,
    [groups, query],
  );

  const renderItem = (
    { item: { file: f, entry }, index: i }: { item: FileListItem; index: number },
    showDir: boolean,
  ) => {
    const path = displayPath(f);
    const { dir, base } = splitPath(path);
    const stat = fileStats(f);
    const sum = entry?.projection?.summary;
    const key = fileKey(f);
    const seen = visited.has(key) && i !== selectedIndex;
    return (
      <button
        key={key}
        className={`file-item${i === selectedIndex ? " selected" : ""}${seen ? " visited" : ""}`}
        onClick={() => onSelect(i)}
      >
        <Tooltip content={path}>
          <span className="file-path">
            {showDir && dir && <span className="file-dir">{dir}</span>}
            {base.split(/(?<=[-_])/).map((part, index) => (
              <Fragment key={index}>
                {part}
                <wbr />
              </Fragment>
            ))}
          </span>
        </Tooltip>
        <span className="file-meta">
          <Tooltip content={s.statusLabel[f.type as FileStatus] ?? f.type}>
            <span className={`status status-${f.type}`}>
              <StatusIcon status={f.type as FileStatus} />
            </span>
          </Tooltip>
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
          {seen && (
            <span className="file-seen" aria-label={s.viewed}>
              ✓
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="sidebar-filter">
        <input
          className="filter-input"
          placeholder={s.filterFiles}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            // 回车打开首个匹配；Esc 清空
            if (e.key === "Enter" && matches?.[0]) onSelect(matches[0].index);
            if (e.key === "Escape") setFilter("");
          }}
        />
      </div>
      {matches ? (
        <>
          {matches.map((m) => renderItem(m, true))}
          {matches.length === 0 && <div className="dim pad note">{s.noMatchingFiles}</div>}
        </>
      ) : (
        groups.map(([key, members]) => {
          const lowValue = key === LOW_VALUE_GROUP;
          const dir = lowValue ? "" : key;
          const title = lowValue ? s.sectionLowValue : dir && members.length > 1 ? dir : null;
          const isCollapsed = title != null && collapsed.has(key);
          return (
            <section
              className={`file-group${lowValue ? " low-value" : ""}`}
              key={key}
              aria-label={lowValue ? s.sectionLowValue : dir || "/"}
            >
              {title != null && (
                <button
                  className="file-group-title"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                >
                  <IconChevron open={!isCollapsed} />
                  <span className="file-group-name">{title}</span>
                  <span className="file-group-count">{members.length}</span>
                </button>
              )}
              {!isCollapsed && members.map((m) => renderItem(m, members.length === 1 || lowValue))}
            </section>
          );
        })
      )}
    </>
  );
}
