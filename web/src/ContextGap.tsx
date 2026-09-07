import { Tooltip } from "./Tooltip";
import type { ContextGap as Gap } from "./reviewContext";
import { useStrings } from "./i18n";
import { IconExpandAll, IconExpandDown, IconExpandUp } from "./icons";

export function ContextGap({
  gap,
  onExpand,
  scope,
  trailing = false,
}: {
  gap: Gap;
  onExpand: (start: number, end: number) => void;
  scope?: string | null;
  trailing?: boolean;
}) {
  const s = useStrings();
  const count = gap.end - gap.start;
  return (
    <div className="context-gap">
      <div className="context-gap-controls">
        {count > 20 && (
          <>
            {gap.before > 0 && (
              <Tooltip content={s.expandDown}>
                <button
                  aria-label={s.expandDown}
                  onClick={() => onExpand(gap.start, Math.min(gap.end, gap.start + 20))}
                >
                  <IconExpandDown />
                </button>
              </Tooltip>
            )}
            {!trailing && (
              <Tooltip content={s.expandUp}>
                <button
                  aria-label={s.expandUp}
                  onClick={() => onExpand(Math.max(gap.start, gap.end - 20), gap.end)}
                >
                  <IconExpandUp />
                </button>
              </Tooltip>
            )}
          </>
        )}
        <Tooltip content={s.expandAll}>
          <button aria-label={s.expandAll} onClick={() => onExpand(gap.start, gap.end)}>
            <IconExpandAll />
          </button>
        </Tooltip>
      </div>
      <div className="context-gap-summary">
        <Tooltip content={s.hiddenContext(count)}>
          <span className="context-gap-count" aria-label={s.hiddenContext(count)}>
            ⋯ {count}
          </span>
        </Tooltip>
        {scope && <code>{scope}</code>}
      </div>
    </div>
  );
}
