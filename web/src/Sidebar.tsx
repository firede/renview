import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

export const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN = 200;
/** 上限取 560 与半屏的较小值（窄窗口不挤死内容区） */
const sidebarMax = () => Math.min(560, Math.round(window.innerWidth * 0.5));

const clampWidth = (w: number) => Math.min(Math.max(w, SIDEBAR_MIN), sidebarMax());

/**
 * 宽度与分栏比例存 sessionStorage：单次会话内记忆（刷新/模式切换不丢）。
 * 不用 localStorage——端口每次启动随机、按源隔离，跨启动持久化本就无意义。
 * 读写包 try/catch：隐私模式等场景 sessionStorage 可能不可用，记忆失效不影响功能。
 */
function readSessionNumber(key: string): number | null {
  try {
    const v = Number(sessionStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeSessionNumber(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {}
}

const WIDTH_KEY = "renview:sidebarWidth";

/** 侧栏宽度初始值：会话记忆优先，否则默认 300 */
export function initialSidebarWidth(): number {
  const v = readSessionNumber(WIDTH_KEY);
  return v != null ? clampWidth(v) : SIDEBAR_DEFAULT_WIDTH;
}

/** 持久化侧栏宽度（App 的 effect 里调用） */
export function persistSidebarWidth(width: number): void {
  writeSessionNumber(WIDTH_KEY, width);
}

/** 侧栏容器：右缘手柄拖拽调宽（双击手柄复位默认宽度）。 */
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
    // 合成事件（测试/脚本派发）的 pointerId 可能无效，捕获失败不阻断拖拽
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
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
 * 中间手柄拖拽调整比例（双击复位，比例存 sessionStorage——storageKey 按场景区分）。
 * 标题常驻小字降权，不参与滚动。
 */
export function SideSections({
  top,
  bottom,
  storageKey,
}: {
  top: SideSection;
  bottom: SideSection;
  storageKey: string;
}) {
  const [ratio, setRatio] = useState(() => {
    const v = readSessionNumber(`renview:sideSplit:${storageKey}`);
    return v != null ? Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v)) : SPLIT_DEFAULT;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    writeSessionNumber(`renview:sideSplit:${storageKey}`, ratio);
  }, [ratio, storageKey]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    // 合成事件（测试/脚本派发）的 pointerId 可能无效，捕获失败不阻断拖拽
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
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
