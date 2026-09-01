import type { Node } from "web-tree-sitter";
import type { ParsedChange, ParsedFile } from "./map";
import { parseSource } from "./parser";

/**
 * 简化器：把类型性质 / 技巧性质的语法从源码中抹掉，输出与原文逐行 1:1 对齐的简化文本。
 * 语言 profile 以 walker 形式给出删除/替换操作（op），引擎负责重叠消解与逐行重建。
 */

export interface SimplifyOp {
  /** 字节偏移，[start, end) */
  start: number;
  end: number;
  /** 省略为删除；给出为替换 */
  replacement?: string;
}

/** 语言简化规则：前序遍历 CST 时回调；返回 true 表示不再深入该子树 */
export type SimplifyWalker = (node: Node, source: string, ops: SimplifyOp[]) => boolean | void;

export function del(node: Node): SimplifyOp {
  return { start: node.startIndex, end: node.endIndex };
}

export function delSpan(start: number, end: number): SimplifyOp {
  return { start, end };
}

export function replaceNode(node: Node, replacement: string): SimplifyOp {
  return { start: node.startIndex, end: node.endIndex, replacement };
}

/** 删除“模式: 类型”中的“: 类型”部分（parameter / let_declaration / field_declaration 通用） */
export function stripColonType(node: Node, ops: SimplifyOp[]): void {
  const children = node.children;
  for (let i = 0; i < children.length; i++) {
    const c = children[i]!;
    if (c.type === ":" && !c.isNamed) {
      const typeNode = children.slice(i + 1).find((x) => x.isNamed);
      if (typeNode) ops.push({ start: c.startIndex, end: typeNode.endIndex });
      return;
    }
  }
}

/** 删除函数返回类型（rust: 连同前面的 `->` 一起） */
export function stripReturnType(node: Node, ops: SimplifyOp[]): void {
  const ret = node.childForFieldName("return_type");
  if (!ret) return;
  const prev = ret.previousSibling;
  const start = prev && !prev.isNamed && prev.type === "->" ? prev.startIndex : ret.startIndex;
  ops.push({ start, end: ret.endIndex });
}

/** 应用 op 集合并逐行重建：输出行与输入行 1:1 对齐（被抹空的行输出 ""） */
export function applySimplify(source: string, ops: SimplifyOp[]): string[] {
  const lines = source.split("\n");
  if (ops.length === 0) return lines;

  // 起点升序、同起点长 span 优先；丢弃与已接受 op 重叠的内层 op
  const sorted = [...ops].sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted: SimplifyOp[] = [];
  for (const op of sorted) {
    const last = accepted[accepted.length - 1];
    if (last && op.start < last.end) continue;
    if (op.end <= op.start && !op.replacement) continue;
    accepted.push(op);
  }

  const starts: number[] = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);

  const out: string[] = [];
  for (let li = 0; li < lines.length; li++) {
    const ls = starts[li]!;
    const le = ls + lines[li]!.length; // 不含换行符
    const lineOps = accepted
      .filter((op) => op.start < le && op.end > ls)
      .map((op) => ({ ...op, start: Math.max(op.start, ls), end: Math.min(op.end, le) }));
    if (lineOps.length === 0) {
      out.push(lines[li]!);
      continue;
    }
    let result = "";
    let cursor = ls;
    const append = (frag: string) => {
      if (!frag) return;
      // 接缝空白修复：前段以空白结尾时，去掉本段前导空白（避免出现双空格）
      if (result.endsWith(" ") || result.endsWith("\t")) frag = frag.replace(/^[ \t]+/, "");
      result += frag;
    };
    for (const op of lineOps) {
      append(source.slice(cursor, op.start));
      if (op.replacement != null) append(op.replacement);
      cursor = op.end;
    }
    append(source.slice(cursor, le));
    out.push(result.replace(/[ \t]+$/, ""));
  }
  return out;
}

/** 收集 op：前序遍历，walker 返回 true 则跳过子树 */
export function collectSimplifyOps(root: Node, source: string, walker: SimplifyWalker): SimplifyOp[] {
  const ops: SimplifyOp[] = [];
  const walk = (node: Node) => {
    const skip = walker(node, source, ops);
    if (skip === true) return;
    for (const child of node.namedChildren) walk(child);
  };
  walk(root);
  return ops;
}

/** 解析 + 简化一段源码；解析出错时抛异常（调用方决定降级） */
export async function simplifySource(
  profile: { grammarFile: string; simplify: SimplifyWalker },
  source: string,
): Promise<string[]> {
  const tree = await parseSource(profile.grammarFile, source);
  if (tree.rootNode.hasError) throw new Error("tree-sitter 解析存在错误节点");
  return applySimplify(source, collectSimplifyOps(tree.rootNode, source, profile.simplify));
}

/* ---- 简化 diff 行构建 ---- */

export type SRow =
  | { kind: "ctx" | "del" | "add"; text: string; oldLn?: number; newLn?: number }
  | { kind: "fold"; count: number; oldLines: string[]; newLines: string[] };

export interface SimplifiedViewData {
  rows: SRow[];
  stats: { folded: number; visible: number };
}

/**
 * 在 git hunk 结构上构建简化 diff 行：
 * 简化后文本相同的 del/add 行对（含双双被抹空）折叠为 fold 标记；
 * 被抹空的变更行自动折叠；被抹空的上下文行直接不显示。
 */
export function buildSimplifiedRows(
  file: ParsedFile,
  oldSimplified: string[] | null,
  newSimplified: string[] | null,
): SimplifiedViewData {
  const rows: SRow[] = [];
  let folded = 0;
  let visible = 0;

  const orig = (c: ParsedChange) => c.content.slice(1);
  const simpOld = (ln: number) => oldSimplified?.[ln - 1] ?? "";
  const simpNew = (ln: number) => newSimplified?.[ln - 1] ?? "";

  const pushFold = (oldLines: string[], newLines: string[]) => {
    const count = Math.max(oldLines.length, newLines.length);
    const last = rows[rows.length - 1];
    if (last?.kind === "fold") {
      last.oldLines.push(...oldLines);
      last.newLines.push(...newLines);
      last.count += count;
    } else {
      rows.push({ kind: "fold", count, oldLines: [...oldLines], newLines: [...newLines] });
    }
    folded += count;
  };

  for (const chunk of file.chunks) {
    const changes = chunk.changes;
    let i = 0;
    while (i < changes.length) {
      const c = changes[i]!;
      if (c.type === "normal") {
        const text = simpOld(c.ln1!);
        // 原文为空的上下文行保留作视觉间隔；被抹空的非空上下文行不显示
        if (orig(c).trim() === "" || text !== "") {
          rows.push({ kind: "ctx", text, oldLn: c.ln1, newLn: c.ln2 });
        }
        i++;
        continue;
      }
      const dels: ParsedChange[] = [];
      const adds: ParsedChange[] = [];
      while (i < changes.length && changes[i]!.type === "del") dels.push(changes[i++]!);
      while (i < changes.length && changes[i]!.type === "add") adds.push(changes[i++]!);

      const used = new Array<boolean>(adds.length).fill(false);
      for (const d of dels) {
        const ds = simpOld(d.ln!);
        const j = adds.findIndex((a, idx) => !used[idx] && simpNew(a.ln!) === ds);
        if (j >= 0) {
          used[j] = true;
          pushFold([orig(d)], [orig(adds[j]!)]);
        } else if (ds === "") {
          pushFold([orig(d)], []);
        } else {
          rows.push({ kind: "del", text: ds, oldLn: d.ln });
          visible++;
        }
      }
      adds.forEach((a, idx) => {
        if (used[idx]) return;
        const as = simpNew(a.ln!);
        if (as === "") {
          pushFold([], [orig(a)]);
        } else {
          rows.push({ kind: "add", text: as, newLn: a.ln });
          visible++;
        }
      });
    }
  }
  return { rows, stats: { folded, visible } };
}
