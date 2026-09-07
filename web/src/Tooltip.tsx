import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";
import type { ReactElement, ReactNode } from "react";

/** 共用全局延迟与浮层定位，不增加正常控件的布局层级。 */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  if (!content) return children;
  const disabled = Boolean((children.props as { disabled?: boolean }).disabled);
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger
        render={disabled ? <span className="tooltip-disabled">{children}</span> : children}
      />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={6} className="tooltip-positioner">
          <BaseTooltip.Popup className="tooltip-popup">{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
