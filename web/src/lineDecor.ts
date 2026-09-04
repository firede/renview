import type { EraseSpan } from "../../src/analysis/types";
import type { HToken } from "./highlight";

/**
 * 行内装饰几何：把一行文本按 token 颜色、词级差异高亮、擦除披露标记切分为段（纯函数）。
 * 产品渲染（decor.tsx）与 www 演示数据生成（scripts/gen-demo.ts）共用同一份切分与
 * 擦除锚定规则，防止演示与产品行为漂移。
 *
 * 擦除标记分两种：替换段（替换文本带虚线下划线）与删除点（锚定到紧邻标识符——
 * 前侧优先，前后都不是标识符时回落零宽 tick）。
 */

export interface LineDecor {
  /** 词级差异区间（字符列，0-based 半开） */
  hl?: Array<[number, number]>;
  hlClass?: "wadd" | "wdel";
  /** 行内擦除记录（行内的列区间 + 原文片段） */
  erases?: EraseSpan[];
}

/** 装饰后的文本段；相邻同属性段已合并 */
export interface DecorSeg {
  text: string;
  color?: string;
  /** shiki FontStyle 位掩码：1 italic / 2 bold / 4 underline */
  fontStyle?: number;
  /** 词级差异高亮 */
  hl?: "wadd" | "wdel";
  /** 该段被擦除标记覆盖（替换段 / 锚定删除点 / 零宽 tick），hover 还原 original */
  erasure?: { original: string; kind: "repl" | "adj" | "mark"; offsetCh?: number };
}

export function decorateLine(text: string, tokens: HToken[] | null, decor?: LineDecor): DecorSeg[] {
  const len = text.length;
  if (len === 0) return [];

  // token 颜色边界：tokens 拼接须与 text 完全一致，不一致（异常输入）退化为无颜色
  let tokenSpans: Array<{ start: number; end: number; t: HToken }> | null = null;
  if (tokens) {
    let off = 0;
    const spans: Array<{ start: number; end: number; t: HToken }> = [];
    for (const t of tokens) {
      spans.push({ start: off, end: off + t.content.length, t });
      off += t.content.length;
    }
    if (off === len) tokenSpans = spans;
  }

  // 切分点：token 边界 + 差异区间边界 + 擦除区间边界
  const cuts = new Set<number>([0, len]);
  if (tokenSpans) for (const s of tokenSpans) cuts.add(s.start);
  for (const [s0, e0] of decor?.hl ?? []) {
    cuts.add(Math.max(0, s0));
    cuts.add(Math.min(len, e0));
  }
  const erases = (decor?.erases ?? []).map((e) => ({
    start: Math.max(0, Math.min(len, e.start)),
    end: Math.max(0, Math.min(len, e.end)),
    original: e.original,
  }));
  for (const e of erases) {
    cuts.add(e.start);
    cuts.add(e.end);
  }
  const pts = [...cuts].sort((a, b) => a - b);

  const hl = decor?.hl ?? [];
  const hlClass = decor?.hlClass;
  const inHl = (p: number): "wadd" | "wdel" | undefined =>
    hlClass && hl.some(([s0, e0]) => p >= s0 && p < e0) ? hlClass : undefined;

  let tokenIdx = 0;
  const tokenAt = (p: number): HToken | undefined => {
    if (!tokenSpans) return undefined;
    while (tokenIdx < tokenSpans.length && p >= tokenSpans[tokenIdx]!.end) tokenIdx++;
    const s = tokenSpans[tokenIdx];
    return s && p >= s.start && p < s.end ? s.t : undefined;
  };

  // 输出一段区间（按切分点逐段带色/高亮；段跨界时按 [from, to) 裁切——锚定词起点不一定是 token 边界）
  const segs: DecorSeg[] = [];
  const emitRange = (from: number, to: number, erasure?: DecorSeg["erasure"]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      const lo = Math.max(p, from);
      const hi = Math.min(q, to);
      if (lo >= hi) continue;
      const t = tokenAt(lo);
      segs.push({
        text: text.slice(lo, hi),
        color: t?.color,
        fontStyle: t?.fontStyle || undefined,
        hl: inHl(lo),
        erasure,
      });
    }
  };

  let cursor = 0;
  const IDENT_BEFORE = /[\p{L}\p{N}_$]+$/u;
  const IDENT_AFTER = /^[\p{L}\p{N}_$]+/u;
  // 零宽 tick 居中到相邻空白间隙中央：各语言的擦除落点偏左（TS）偏右（Go/Rust）不一，
  // 居中避免 tick 在视觉上贴连任一 token（返回 0 时省略，保持输出紧凑）
  const gapCenterOffset = (c: number): number | undefined => {
    let l = c;
    while (l > 0 && text[l - 1] === " ") l--;
    let r = c;
    while (r < len && text[r] === " ") r++;
    const off = (r - c - (c - l)) / 2;
    return off === 0 ? undefined : off;
  };
  for (const e of erases) {
    if (e.start < cursor) continue; // 防御重叠（正常不会发生）
    if (e.start !== e.end) {
      // 替换段：替换文本带虚线下划线，hover 还原原文
      emitRange(cursor, e.start);
      emitRange(e.start, e.end, { original: e.original, kind: "repl" });
      cursor = e.end;
      continue;
    }
    // 零宽删除点：优先锚定紧邻标识符（前侧优先），hover 目标是真实文字而非空隙
    const c = e.start;
    const before = text.slice(0, c).match(IDENT_BEFORE)?.[0];
    const after = c < len ? text.slice(c).match(IDENT_AFTER)?.[0] : undefined;
    if (before && c - before.length >= cursor) {
      emitRange(cursor, c - before.length);
      emitRange(c - before.length, c, { original: e.original, kind: "adj" });
      cursor = c;
    } else if (after) {
      emitRange(cursor, c);
      emitRange(c, c + after.length, { original: e.original, kind: "adj" });
      cursor = c + after.length;
    } else {
      emitRange(cursor, c);
      segs.push({
        text: "",
        erasure: { original: e.original, kind: "mark", offsetCh: gapCenterOffset(c) },
      });
      cursor = c;
    }
  }
  emitRange(cursor, len);

  // 相邻同属性段合并，token 边界产生的无意义切分不泄漏给消费者
  const merged: DecorSeg[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.color === s.color &&
      last.fontStyle === s.fontStyle &&
      last.hl === s.hl &&
      last.erasure?.original === s.erasure?.original &&
      last.erasure?.kind === s.erasure?.kind
    ) {
      last.text += s.text;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}
