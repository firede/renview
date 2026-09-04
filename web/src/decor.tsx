import type { ReactNode } from "react";
import { Tooltip } from "@base-ui-components/react/tooltip";
import { tokenStyle, type HToken } from "./highlight";
import { decorateLine, type DecorSeg, type LineDecor } from "./lineDecor";
import { useStrings } from "./i18n";

/**
 * 行内装饰渲染：decorateLine 产出的段序列组装为 React 节点（切分与锚定规则见 lineDecor.ts）。
 * 擦除标记 hover 浮层还原被擦除的原文（披露阶梯的 hover 层）。
 */

export type { LineDecor } from "./lineDecor";

function ErasureTip({
  original,
  className,
  offsetCh,
  children,
}: {
  original: string;
  className: string;
  /** 零宽 tick 的间隙居中偏移（ch）；transform 移动视觉与命中区，tooltip 锚点随动 */
  offsetCh?: number;
  children?: ReactNode;
}) {
  const s = useStrings();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <span
            className={className}
            tabIndex={0}
            aria-label={s.erasureHint}
            style={offsetCh ? { transform: `translateX(${offsetCh}ch)` } : undefined}
          />
        }
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

function SegSpan({ seg }: { seg: DecorSeg }) {
  if (!seg.hl && !seg.color && !seg.fontStyle) return <>{seg.text}</>;
  return (
    <span className={seg.hl} style={tokenStyle(seg)}>
      {seg.text}
    </span>
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
  const segs = decorateLine(text, tokens, decor);
  if (segs.length === 0) return <> </>;

  // 连续同属一个擦除标记的段归入同一浮层触发器
  const nodes: ReactNode[] = [];
  let key = 0;
  let i = 0;
  while (i < segs.length) {
    const seg = segs[i]!;
    if (!seg.erasure) {
      nodes.push(<SegSpan key={key++} seg={seg} />);
      i++;
      continue;
    }
    const era = seg.erasure;
    const inner: ReactNode[] = [];
    while (
      i < segs.length &&
      segs[i]!.erasure?.original === era.original &&
      segs[i]!.erasure?.kind === era.kind
    ) {
      inner.push(<SegSpan key={key++} seg={segs[i]!} />);
      i++;
    }
    nodes.push(
      <ErasureTip
        key={key++}
        original={era.original}
        className={`erasure-${era.kind}`}
        offsetCh={era.kind === "mark" ? era.offsetCh : undefined}
      >
        {inner}
      </ErasureTip>,
    );
  }
  return <>{nodes}</>;
}
