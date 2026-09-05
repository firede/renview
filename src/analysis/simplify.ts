import type { Node, Tree } from "web-tree-sitter";
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
  /**
   * 省略为删除；给出为替换。
   * replacement 不应含换行：跨行 op 的替换文本只落起始行（后续行纯删除），
   * 含换行会把多行内容压进首行、破坏输出与原文的 1:1 行对齐；跨行擦除改用逐 token 删除 op。
   */
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

/** 删除 [start, end) 并吞掉紧邻的前导空白（"addr string" 擦除类型 → "addr"，不留空格） */
export function delSwallowingLeadingSpace(start: number, end: number, source: string): SimplifyOp {
  while (start > 0 && (source[start - 1] === " " || source[start - 1] === "\t")) start--;
  return { start, end };
}

/** 删除函数返回类型（rust: 连同前面的 `->` 一起） */
export function stripReturnType(node: Node, ops: SimplifyOp[]): void {
  const ret = node.childForFieldName("return_type");
  if (!ret) return;
  const prev = ret.previousSibling;
  const start = prev && !prev.isNamed && prev.type === "->" ? prev.startIndex : ret.startIndex;
  ops.push({ start, end: ret.endIndex });
}

/** 行内擦除记录：简化行内的列区间（0-based，删除为零宽；替换为替换文本的区间）+ 被擦除的原文片段 */
export interface EraseSpan {
  start: number;
  end: number;
  original: string;
}

/** 简化结果：与原文 1:1 对齐的行 + 逐行擦除记录（hover 披露的数据源） */
export interface SimplifyResult {
  lines: string[];
  /** 与 lines 1:1 对齐；无擦除的行为空数组 */
  erasures: EraseSpan[][];
}

/** 应用 op 集合并逐行重建：输出行与输入行 1:1 对齐（被抹空的行输出 ""），并记录每行擦除位置 */
export function applySimplify(source: string, ops: SimplifyOp[]): SimplifyResult {
  const lines = source.split("\n");
  if (ops.length === 0) return { lines, erasures: lines.map(() => []) };

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
  const eraseOut: EraseSpan[][] = [];
  let opIndex = 0;
  for (let li = 0; li < lines.length; li++) {
    const ls = starts[li]!;
    const le = ls + lines[li]!.length; // 不含换行符
    // accepted 已按起点排序且互不重叠；随行号推进游标，避免每行扫描全部擦除。
    while (opIndex < accepted.length && accepted[opIndex]!.end <= ls) opIndex++;
    const lineOps: SimplifyOp[] = [];
    for (let oi = opIndex; oi < accepted.length && accepted[oi]!.start < le; oi++) {
      const op = accepted[oi]!;
      if (op.end <= ls) continue;
      lineOps.push({
        start: Math.max(op.start, ls),
        end: Math.min(op.end, le),
        // 跨行替换只出现在首行，后续行仍须保留逐行擦除原文。
        replacement: op.start >= ls ? op.replacement : undefined,
      });
    }
    if (lineOps.length === 0) {
      out.push(lines[li]!);
      eraseOut.push([]);
      continue;
    }
    let result = "";
    const lineErases: Array<EraseSpan & { srcStart: number; srcEnd: number }> = [];
    let cursor = ls;
    const append = (frag: string) => {
      if (!frag) return;
      // 接缝空白修复：前段以空白结尾时，去掉本段前导空白（避免出现双空格）
      if (result.endsWith(" ") || result.endsWith("\t")) frag = frag.replace(/^[ \t]+/, "");
      result += frag;
    };
    for (const op of lineOps) {
      append(source.slice(cursor, op.start));
      // 列区间在运行时按已产出文本度量（接缝修复可能影响前段长度）
      const at = result.length;
      const lastE = lineErases[lineErases.length - 1];
      if (lastE && lastE.end === at && lastE.srcEnd === op.start) {
        // 源中相邻的连续擦除（如 `?` 紧跟 `: T`）合并为一个标记，避免同点堆叠多个浮层
        lastE.original = source.slice(lastE.srcStart, op.end);
        lastE.srcEnd = op.end;
        if (op.replacement != null) {
          append(op.replacement);
          lastE.end = result.length;
        }
      } else if (op.replacement != null) {
        append(op.replacement);
        lineErases.push({
          start: at,
          end: result.length,
          original: source.slice(op.start, op.end),
          srcStart: op.start,
          srcEnd: op.end,
        });
      } else if (op.end > op.start) {
        lineErases.push({
          start: at,
          end: at,
          original: source.slice(op.start, op.end),
          srcStart: op.start,
          srcEnd: op.end,
        });
      }
      cursor = op.end;
    }
    append(source.slice(cursor, le));
    out.push(result.replace(/[ \t]+$/, ""));
    eraseOut.push(lineErases.map(({ srcStart: _, srcEnd: __, ...rest }) => rest));
  }
  return { lines: out, erasures: eraseOut };
}

/** 收集 op：前序遍历，walker 返回 true 则跳过子树 */
export function collectSimplifyOps(
  root: Node,
  source: string,
  walker: SimplifyWalker,
): SimplifyOp[] {
  const ops: SimplifyOp[] = [];
  const walk = (node: Node) => {
    const skip = walker(node, source, ops);
    if (skip === true) return;
    for (const child of node.namedChildren) walk(child);
  };
  walk(root);
  return ops;
}

/** 对已解析的 CST 做简化（供一次 parse 多处复用）；存在错误节点时抛异常 */
export function simplifyTree(tree: Tree, source: string, walker: SimplifyWalker): SimplifyResult {
  if (tree.rootNode.hasError) throw new Error("tree-sitter 解析存在错误节点");
  return applySimplify(source, collectSimplifyOps(tree.rootNode, source, walker));
}

/** 解析 + 简化一段源码；解析出错时抛异常（调用方决定降级） */
export async function simplifySource(
  profile: { grammarFile: string; simplify: SimplifyWalker },
  source: string,
): Promise<SimplifyResult> {
  const tree = await parseSource(profile.grammarFile, source);
  try {
    return simplifyTree(tree, source, profile.simplify);
  } finally {
    tree.delete();
  }
}

/* ---- 简化 diff 行构建 ---- */

export type SRow =
  | {
      kind: "ctx" | "del" | "add";
      text: string;
      oldLn?: number;
      newLn?: number;
      /** 行内擦除记录（取自该侧简化行）；无则省略 */
      erases?: EraseSpan[];
      /** 词级高亮配对 id：配对的 del/add 行携带相同 id（同一次构建内唯一） */
      pair?: number;
    }
  | {
      kind: "fold";
      count: number;
      oldLines: string[];
      newLines: string[];
      /** 折叠行的新旧侧行号（1-based，与 oldLines/newLines 平行），供折叠摘要定位声明成员 */
      oldLns?: number[];
      newLns?: number[];
      /** 成员级折叠摘要（关联到类型声明时由 describeFold 产出）；缺省时前端按 count 回落 */
      summary?: string;
    };

export interface SimplifiedViewData {
  rows: SRow[];
  stats: { folded: number; visible: number };
}

/** buildSimplifiedRows 的简化输入：完整结果或仅行文本（无擦除信息，如测试与 corpus-check） */
export type SimplifyInput = SimplifyResult | string[] | null;

/** 折叠组描述器：按折叠行的新旧行号产出成员级摘要；无法定位时返回 null */
export type FoldDescriber = (oldLns: number[], newLns: number[]) => string | null;

function sideLines(s: SimplifyInput): string[] | null {
  return s == null ? null : Array.isArray(s) ? s : s.lines;
}

function sideErases(s: SimplifyInput, ln: number): EraseSpan[] | undefined {
  if (s == null || Array.isArray(s)) return undefined;
  const e = s.erasures[ln - 1];
  return e && e.length > 0 ? e : undefined;
}

type VisibleRow = Extract<SRow, { kind: "ctx" | "del" | "add" }>;

/** 相似度配对用的 token：词与单个标点（空白不参与，缩进差异不干扰配对） */
function simTokens(t: string): string[] {
  return t.match(/[\p{L}\p{N}_$]+|[^\s\p{L}\p{N}_$]/gu) ?? [];
}

/** 多重集 Dice 系数 */
function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const t of a) pool.set(t, (pool.get(t) ?? 0) + 1);
  let shared = 0;
  for (const t of b) {
    const c = pool.get(t) ?? 0;
    if (c > 0) {
      shared++;
      pool.set(t, c - 1);
    }
  }
  return (2 * shared) / (a.length + b.length);
}

/** 配对相似度阈值：低于此视为两行无关（误配对产生的高亮比缺失更糟糕） */
const PAIR_THRESHOLD = 0.5;

/**
 * 块内可见 del/add 行按相似度贪心配对（全局最优优先，同分按行序），打上 pair id。
 * 配对只是高亮提示，不改变的 del 在前、add 在后的呈现顺序。
 */
function pairVisibleRows(dels: VisibleRow[], adds: VisibleRow[], nextPair: () => number): void {
  if (dels.length === 0 || adds.length === 0) return;
  const delToks = dels.map((r) => simTokens(r.text));
  const addToks = adds.map((r) => simTokens(r.text));
  const cands: Array<{ i: number; j: number; score: number }> = [];
  for (let i = 0; i < dels.length; i++) {
    for (let j = 0; j < adds.length; j++) {
      const score = similarity(delToks[i]!, addToks[j]!);
      if (score >= PAIR_THRESHOLD) cands.push({ i, j, score });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.i - b.i || a.j - b.j);
  const usedD = new Array<boolean>(dels.length).fill(false);
  const usedA = new Array<boolean>(adds.length).fill(false);
  for (const { i, j } of cands) {
    if (usedD[i] || usedA[j]) continue;
    usedD[i] = usedA[j] = true;
    const id = nextPair();
    dels[i]!.pair = id;
    adds[j]!.pair = id;
  }
}

/**
 * 在 git hunk 结构上构建简化 diff 行：
 * 简化后文本相同的 del/add 行对（含双双被抹空）折叠为 fold 标记；
 * 被抹空的变更行自动折叠；被抹空的上下文行直接不显示。
 * 例外：原文为空行的变更不进折叠（展开无内容可审，折叠标记纯属干扰），以普通空行呈现。
 * 剩余可见 del/add 行按相似度配对（pair id），供前端词级高亮。
 */
export function buildSimplifiedRows(
  file: ParsedFile,
  oldSimplified: SimplifyInput,
  newSimplified: SimplifyInput,
  describeFold?: FoldDescriber | null,
): SimplifiedViewData {
  const rows: SRow[] = [];
  let folded = 0;
  let visible = 0;
  let pairSeq = 0;

  const orig = (c: ParsedChange) => c.content.slice(1);
  const oldLines = sideLines(oldSimplified);
  const newLines = sideLines(newSimplified);
  const simpOld = (ln: number) => oldLines?.[ln - 1] ?? "";
  const simpNew = (ln: number) => newLines?.[ln - 1] ?? "";

  const pushFold = (ol: string[], nl: string[], ols: number[], nls: number[]) => {
    const count = Math.max(ol.length, nl.length);
    const last = rows[rows.length - 1];
    if (last?.kind === "fold") {
      last.oldLines.push(...ol);
      last.newLines.push(...nl);
      last.oldLns?.push(...ols);
      last.newLns?.push(...nls);
      last.count += count;
    } else {
      rows.push({
        kind: "fold",
        count,
        oldLines: [...ol],
        newLines: [...nl],
        oldLns: [...ols],
        newLns: [...nls],
      });
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
          const row: VisibleRow = { kind: "ctx", text, oldLn: c.ln1, newLn: c.ln2 };
          const erases = sideErases(oldSimplified, c.ln1!);
          if (erases) row.erases = erases;
          rows.push(row);
        }
        i++;
        continue;
      }
      const dels: ParsedChange[] = [];
      const adds: ParsedChange[] = [];
      while (i < changes.length && changes[i]!.type === "del") dels.push(changes[i++]!);
      while (i < changes.length && changes[i]!.type === "add") adds.push(changes[i++]!);

      const blockDels: VisibleRow[] = [];
      const blockAdds: VisibleRow[] = [];
      const used = new Array<boolean>(adds.length).fill(false);
      for (const d of dels) {
        // 空行不进折叠，直接以普通空行呈现（与空白上下文行作视觉间隔一致）
        if (orig(d).trim() === "") {
          rows.push({ kind: "del", text: "", oldLn: d.ln });
          visible++;
          continue;
        }
        const ds = simpOld(d.ln!);
        const j = adds.findIndex((a, idx) => !used[idx] && simpNew(a.ln!) === ds);
        if (j >= 0) {
          used[j] = true;
          pushFold([orig(d)], [orig(adds[j]!)], [d.ln!], [adds[j]!.ln!]);
        } else if (ds === "") {
          pushFold([orig(d)], [], [d.ln!], []);
        } else {
          const row: VisibleRow = { kind: "del", text: ds, oldLn: d.ln };
          const erases = sideErases(oldSimplified, d.ln!);
          if (erases) row.erases = erases;
          rows.push(row);
          blockDels.push(row);
          visible++;
        }
      }
      adds.forEach((a, idx) => {
        if (used[idx]) return;
        if (orig(a).trim() === "") {
          rows.push({ kind: "add", text: "", newLn: a.ln });
          visible++;
          return;
        }
        const as = simpNew(a.ln!);
        if (as === "") {
          pushFold([], [orig(a)], [], [a.ln!]);
        } else {
          const row: VisibleRow = { kind: "add", text: as, newLn: a.ln };
          const erases = sideErases(newSimplified, a.ln!);
          if (erases) row.erases = erases;
          rows.push(row);
          blockAdds.push(row);
          visible++;
        }
      });
      pairVisibleRows(blockDels, blockAdds, () => ++pairSeq);
    }
  }

  // 折叠组的成员级摘要（关联类型声明成员时）；失败保持缺省，前端按行数回落
  if (describeFold) {
    for (const r of rows) {
      if (r.kind !== "fold") continue;
      const summary = describeFold(r.oldLns ?? [], r.newLns ?? []);
      if (summary) r.summary = summary;
    }
  }
  return { rows, stats: { folded, visible } };
}
