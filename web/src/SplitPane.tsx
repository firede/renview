import { useRef, useState, type ReactNode } from "react";
import { Group, Panel, Separator, type PanelImperativeHandle } from "react-resizable-panels";

export const SIDEBAR_DEFAULT_WIDTH = 300;
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 560;

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

/**
 * 侧栏 + 内容区的水平切分（react-resizable-panels 承载拖拽/键盘调整/双击复位的交互细节）。
 * 侧栏像素定宽（preserve-pixel-size：窗口缩放不改变宽度）；hidden 时退化为整栏内容。
 * 宽度会话内记忆：onResize 落 sessionStorage，重新挂载（含显隐切换）时读回。
 */
export function SplitPane({
  hidden,
  side,
  children,
}: {
  hidden: boolean;
  side: ReactNode;
  children: ReactNode;
}) {
  // 仅在挂载时读取（hidden 切换导致重挂载时取回拖拽后的宽度）
  const [initialWidth] = useState(() => readSessionNumber(WIDTH_KEY) ?? SIDEBAR_DEFAULT_WIDTH);
  const sidePanel = useRef<PanelImperativeHandle>(null);

  if (hidden) {
    return (
      <div className="body">
        <div className="content" role="main">
          {children}
        </div>
      </div>
    );
  }

  return (
    <Group
      orientation="horizontal"
      className="body"
      onLayoutChanged={() => {
        // 布局定型时持久化（拖拽释放/键盘调整/双击复位都经此）；onResize 走 ResizeObserver，标签页隐藏时不触发
        const px = sidePanel.current?.getSize().inPixels;
        if (px) writeSessionNumber(WIDTH_KEY, Math.round(px));
      }}
    >
      <Panel
        id="side"
        role="complementary"
        className="sidebar"
        defaultSize={initialWidth}
        minSize={SIDEBAR_MIN}
        maxSize={SIDEBAR_MAX}
        groupResizeBehavior="preserve-pixel-size"
        panelRef={sidePanel}
      >
        {side}
      </Panel>
      <Separator
        className="side-resizer"
        disableDoubleClick
        onDoubleClick={() => sidePanel.current?.resize(SIDEBAR_DEFAULT_WIDTH)}
      />
      <Panel id="main" role="main" className="content" minSize="20%">
        {children}
      </Panel>
    </Group>
  );
}

export interface SideSection {
  title: string;
  /** 标题右侧的快捷键提示（小字降权） */
  hint?: string;
  body: ReactNode;
}

/**
 * 侧栏内部的上下分栏：上主列表（文件/目录树）下辅助列表（变更单元/大纲）。
 * 下栏按内容取高（至多约四成），其余空间留给主列表：辅助列表常常很短甚至为空，
 * 固定比例会让主列表在大变更集里只剩几行可见。
 */
export function SideSections({ top, bottom }: { top: SideSection; bottom: SideSection }) {
  return (
    <div className="side-sections">
      <div className="side-section top">
        <header className="side-head">
          {top.title}
          {top.hint && <span className="side-hint">{top.hint}</span>}
        </header>
        <div className="side-body">{top.body}</div>
      </div>
      <div className="side-section bottom">
        <header className="side-head">
          {bottom.title}
          {bottom.hint && <span className="side-hint">{bottom.hint}</span>}
        </header>
        <div className="side-body">{bottom.body}</div>
      </div>
    </div>
  );
}
