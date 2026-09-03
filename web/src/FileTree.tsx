import { useEffect, useMemo, useState } from "react";
import { IconChevron, IconFile, IconFolder } from "./icons";

/** 目录树数据模型：由文件路径列表构建 */

export interface TreeDir {
  kind: "dir";
  /** 展示名（单子目录链压缩后可能是 "a/b"） */
  name: string;
  /** 完整路径前缀 */
  path: string;
  children: TreeNode[];
}

export interface TreeFile {
  kind: "file";
  name: string;
  path: string;
}

export type TreeNode = TreeDir | TreeFile;

/**
 * 由路径列表构建目录树：
 * - 目录在前、文件在后，各自按名称排序；
 * - 单子目录链压缩（a 只含 b 时合并为 "a/b"，与 GitHub/VSCode 一致）。
 */
export function buildTree(paths: string[]): TreeNode[] {
  interface MutableDir {
    children: Map<string, MutableDir>;
    files: string[];
  }
  const root: MutableDir = { children: new Map(), files: [] };
  for (const p of paths) {
    const segs = p.split("/");
    let dir = root;
    for (let i = 0; i < segs.length - 1; i++) {
      const s = segs[i]!;
      let next = dir.children.get(s);
      if (!next) {
        next = { children: new Map(), files: [] };
        dir.children.set(s, next);
      }
      dir = next;
    }
    dir.files.push(segs[segs.length - 1]!);
  }

  const toNodes = (dir: MutableDir, prefix: string): TreeNode[] => {
    const dirs: TreeDir[] = [...dir.children.entries()].map(([name, d]) => {
      let label = name;
      let full = prefix ? `${prefix}/${name}` : name;
      let cur = d;
      while (cur.files.length === 0 && cur.children.size === 1) {
        const [childName, childDir] = [...cur.children.entries()][0]!;
        label += `/${childName}`;
        full += `/${childName}`;
        cur = childDir;
      }
      return { kind: "dir", name: label, path: full, children: toNodes(cur, full) };
    });
    const files: TreeFile[] = dir.files.map((f) => ({
      kind: "file",
      name: f,
      path: prefix ? `${prefix}/${f}` : f,
    }));
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  };
  return toNodes(root, "");
}

/** 树中所有目录的路径（用于选中文件时展开其祖先） */
export function allDirPaths(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (ns: TreeNode[]) => {
    for (const n of ns) {
      if (n.kind === "dir") {
        out.push(n.path);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return out;
}

/**
 * 浏览模式的目录树侧栏。
 * 顶层目录默认展开；选中文件（含 diff 跳转）时自动展开其祖先目录。
 */
export function FileTree({
  paths,
  selected,
  onSelect,
}: {
  paths: string[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const tree = useMemo(() => buildTree(paths), [paths]);
  // null = 尚未初始化（等首个非空 tree 时展开顶层目录）；初始化后完全由用户控制
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  useEffect(() => {
    setExpanded((prev) => {
      if (prev !== null) return prev;
      return new Set(tree.filter((n) => n.kind === "dir").map((n) => n.path));
    });
  }, [tree]);

  // 选中文件变化时，展开其祖先目录（jump/大纲定位需要目标可见）
  useEffect(() => {
    if (!selected) return;
    setExpanded((prev) => {
      const base = prev ?? new Set<string>();
      const next = new Set(base);
      for (const dirPath of allDirPaths(tree)) {
        if (selected.startsWith(`${dirPath}/`)) next.add(dirPath);
      }
      return next.size === base.size ? prev : next;
    });
  }, [selected, tree]);

  const open = expanded ?? new Set<string>();
  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="file-tree">
      <TreeLevel nodes={tree} depth={0} open={open} onToggle={toggle} selected={selected} onSelect={onSelect} />
    </div>
  );
}

function TreeLevel({
  nodes,
  depth,
  open,
  onToggle,
  selected,
  onSelect,
}: {
  nodes: TreeNode[];
  depth: number;
  open: Set<string>;
  onToggle: (path: string) => void;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <>
      {nodes.map((n) =>
        n.kind === "dir" ? (
          <div key={n.path}>
            {/* 行结构三列对齐：chevron 定宽槽（文件留空）+ 文件夹/文件图标 + 名字——同级目录与文件视觉对齐 */}
            <button
              className="tree-row tree-dir"
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => onToggle(n.path)}
            >
              <span className="tree-chevron">
                <IconChevron open={open.has(n.path)} width={12} height={12} />
              </span>
              <IconFolder className="tree-icon" width={14} height={14} />
              <span className="tree-name">{n.name}</span>
            </button>
            {open.has(n.path) && (
              <TreeLevel
                nodes={n.children}
                depth={depth + 1}
                open={open}
                onToggle={onToggle}
                selected={selected}
                onSelect={onSelect}
              />
            )}
          </div>
        ) : (
          <button
            key={n.path}
            className={`tree-row tree-file${n.path === selected ? " selected" : ""}`}
            style={{ paddingLeft: 8 + depth * 12 }}
            title={n.path}
            onClick={() => onSelect(n.path)}
          >
            <span className="tree-chevron" />
            <IconFile className="tree-icon" width={14} height={14} />
            <span className="tree-name">{n.name}</span>
          </button>
        ),
      )}
    </>
  );
}
