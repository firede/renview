import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

export const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN = 200;
/** 上限取 560 与半屏的较小值（窄窗口不挤死内容区） */
const sidebarMax = () => Math.min(560, Math.round(window.innerWidth * 0.5));

const clampWidth = (w: number) => Math.min(Math.max(w, SIDEBAR_MIN), sidebarMax());

/** 侧栏容器：右缘手柄拖拽调宽（双击手柄复位默认宽度）。
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

export interface SideSection {
  title: string;
  body: ReactNode;
}

const SPLIT_DEFAULT = 0.55;
const SPLIT_MIN = 0.15;
const SPLIT_MAX = 0.85;

/**
 * 侧栏上下分栏：上主列表（文件）下辅助列表（变更单元/大纲），
 * 中间手柄拖拽调整比例（双击复位）。标题常驻小字降权，不参与滚动。
 */
export function SideSections({ top, bottom }: { top: SideSection; bottom: SideSection }) {
  const [ratio, setRatio] = useState(SPLIT_DEFAULT);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    document.body.classList.add("row-resizing");
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const r = (e.clientY - rect.top) / rect.height;
    setRatio(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, r)));
  };
  const onPointerUp = () => {
    dragging.current = false;
    document.body.classList.remove("row-resizing");
  };

  return (
    <div className="side-sections" ref={containerRef}>
      <section className="side-section" style={{ height: `${ratio * 100}%` }}>
        <header className="side-head">{top.title}</header>
        <div className="side-body">{top.body}</div>
      </section>
      <div
        className="side-vsplit"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => setRatio(SPLIT_DEFAULT)}
      />
      <section className="side-section grow">
        <header className="side-head">{bottom.title}</header>
        <div className="side-body">{bottom.body}</div>
      </section>
    </div>
  );
}
