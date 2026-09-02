import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

export const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN = 200;
/** 上限取 560 与半屏的较小值（窄窗口不挤死内容区） */
const sidebarMax = () => Math.min(560, Math.round(window.innerWidth * 0.5));

const clampWidth = (w: number) => Math.min(Math.max(w, SIDEBAR_MIN), sidebarMax());

/**
 * 侧栏容器：右缘手柄拖拽调宽（双击复位默认宽度）。
 * 宽度不持久化——端口每次启动随机，localStorage 按源隔离跨会话无意义。
 */
export function Sidebar({
  width,
  onWidthChange,
  children,
}: {
  width: number;
  onWidthChange: (width: number) => void;
  children: ReactNode;
}) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
    document.body.classList.add("col-resizing");
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onWidthChange(clampWidth(drag.current.startWidth + e.clientX - drag.current.startX));
  };
  const onPointerUp = () => {
    drag.current = null;
    document.body.classList.remove("col-resizing");
  };

  return (
    <>
      <aside className="sidebar" style={{ width }}>
        {children}
      </aside>
      <div
        className="side-resizer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => onWidthChange(SIDEBAR_DEFAULT_WIDTH)}
      />
    </>
  );
}
