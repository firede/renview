import type { ReactNode } from "react";
import { Tooltip } from "@base-ui-components/react/tooltip";
import type { EraseSpan } from "../../src/analysis/types";
import { tokenStyle, type HToken } from "./highlight";
import { useStrings } from "./i18n";

/**
 * 行内装饰渲染：把一行简化文本按 token 颜色、词级差异高亮、擦除披露标记组装。
 * 擦除标记分两种：替换段（替换文本带虚线下划线）与删除点（锚定到紧邻标识符——
 * 下划线缠在真实文字上，hover 目标可读可点；前后都不是标识符时回落零宽 tick）。
 * 两者 hover 浮层还原被擦除的原文（披露阶梯的 hover 层）。
 */

export interface LineDecor {
  /** 词级差异区间（字符列，0-based 半开） */
  hl?: Array<[number, number]>;
  hlClass?: "wadd" | "wdel";
  /** 行内擦除记录（简化行内的列区间 + 原文片段） */
  erases?: EraseSpan[];
}

function ErasureTip({
  original,
  className,
  children,
}: {
  original: string;
  className: string;
  children?: ReactNode;
}) {
  const s = useStrings();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<span className={className} tabIndex={0} aria-label={s.erasureHint} />}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="erasure-pop">
            <code>{original}</code>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function DecoratedLine({
  text,
  tokens,
  decor,
}: {
  text: string;
  tokens: HToken[] | null;
  decor?: LineDecor;
}) {
  const len = text.length;
  if (len === 0) return <> </>;

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
  const inHl = (p: number) => hlClass && hl.some(([s0, e0]) => p >= s0 && p < e0);

  let tokenIdx = 0;
  const styleAt = (p: number) => {
    if (!tokenSpans) return undefined;
    while (tokenIdx < tokenSpans.length && p >= tokenSpans[tokenIdx]!.end) tokenIdx++;
    const s = tokenSpans[tokenIdx];
    return s && p >= s.start && p < s.end ? tokenStyle(s.t) : undefined;
  };

  // 输出一段纯文本区间（按切分点逐段带色/高亮；段跨界时按 [from, to) 裁切——锚定词起点不一定是 token 边界）
  let key = 0;
  const emitRange = (nodes: ReactNode[], from: number, to: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      const lo = Math.max(p, from);
      const hi = Math.min(q, to);
      if (lo >= hi) continue;
      const cls = inHl(lo) ? hlClass : undefined;
      const style = styleAt(lo);
      nodes.push(
        cls || style ? (
          <span key={key++} className={cls} style={style}>
            {text.slice(lo, hi)}
          </span>
        ) : (
          text.slice(lo, hi)
        ),
      );
    }
  };

  const nodes: ReactNode[] = [];
  let cursor = 0;
  const IDENT_BEFORE = /[\p{L}\p{N}_$]+$/u;
  const IDENT_AFTER = /^[\p{L}\p{N}_$]+/u;
  for (const e of erases) {
    if (e.start < cursor) continue; // 防御重叠（正常不会发生）
    if (e.start !== e.end) {
      // 替换段：替换文本带虚线下划线，hover 还原原文
      emitRange(nodes, cursor, e.start);
      const inner: ReactNode[] = [];
      emitRange(inner, e.start, e.end);
      nodes.push(
        <ErasureTip key={key++} original={e.original} className="erasure-repl">
          {inner}
        </ErasureTip>,
      );
      cursor = e.end;
      continue;
    }
    // 零宽删除点：优先锚定紧邻标识符（前侧优先）， hover 目标是真实文字而非空隙
    const c = e.start;
    const before = text.slice(0, c).match(IDENT_BEFORE)?.[0];
    const after = c < len ? text.slice(c).match(IDENT_AFTER)?.[0] : undefined;
    if (before && c - before.length >= cursor) {
      emitRange(nodes, cursor, c - before.length);
      const inner: ReactNode[] = [];
      emitRange(inner, c - before.length, c);
      nodes.push(
        <ErasureTip key={key++} original={e.original} className="erasure-adj">
          {inner}
        </ErasureTip>,
      );
      cursor = c;
    } else if (after) {
      emitRange(nodes, cursor, c);
      const inner: ReactNode[] = [];
      emitRange(inner, c, c + after.length);
      nodes.push(
        <ErasureTip key={key++} original={e.original} className="erasure-adj">
          {inner}
        </ErasureTip>,
      );
      cursor = c + after.length;
    } else {
      emitRange(nodes, cursor, c);
      nodes.push(<ErasureTip key={key++} original={e.original} className="erasure-mark" />);
      cursor = c;
    }
  }
  emitRange(nodes, cursor, len);
  return <>{nodes}</>;
}
