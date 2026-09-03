import type { ReactNode, SVGProps } from "react";
import type { DeclKind, FileStatus } from "../../src/analysis/types";
import { useStrings } from "./i18n";

/**
 * 内联 SVG 图标集：24 视窗（路径与 lucide 兼容）、currentColor 描边、渲染 16px。
 * 不引入图标包——所需图标极少，内联零依赖且可被单文件二进制直接内嵌。
 * 图标化只用于语义通用的控件（刷新/分栏/状态等）；产品特定概念（简化/原始/变更/浏览）保留文字。
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** 侧栏显隐开关（顶栏） */
export function IconPanelLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </Icon>
  );
}

/** 刷新 */
export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Icon>
  );
}

/** 在查看器中打开（跳离当前上下文） */
export function IconOpenExternal(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15 3h6v6" />
      <path d="m21 3-9 9" />
      <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
    </Icon>
  );
}

/** 单列 diff */
export function IconUnified(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </Icon>
  );
}

/** 双列 diff */
export function IconSplit(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M12 3v18" />
    </Icon>
  );
}

/** 文件状态：新增 */
export function IconStatusAdd(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

/** 文件状态：删除 */
export function IconStatusDelete(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

/** 文件状态：修改 */
export function IconStatusModify(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </Icon>
  );
}

/** 文件状态：改名 */
export function IconStatusRename(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Icon>
  );
}

/** 目录（文件树） */
export function IconFolder(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </Icon>
  );
}

/** 文件（文件树） */
export function IconFile(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </Icon>
  );
}

/** 展开/收起箭头（文件树目录） */
export function IconChevron({ open, ...props }: SVGProps<SVGSVGElement> & { open?: boolean }) {
  return (
    <Icon {...props}>{open ? <path d="m6 9 6 6 6-6" /> : <path d="m9 18 6-6-6-6" />}</Icon>
  );
}

/** 文件状态图标（文件列表元信息位）：图形承担状态语义，title 给全称 */
const STATUS_ICON: Record<FileStatus, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  add: IconStatusAdd,
  delete: IconStatusDelete,
  modify: IconStatusModify,
  rename: IconStatusRename,
};

export function StatusIcon({ status }: { status: FileStatus }) {
  const C = STATUS_ICON[status];
  return <C width={12} height={12} />;
}

/** 声明类别的单字符徽章：变更单元与大纲行共用（glyph 压缩类别信息，title 给全称） */
const KIND_GLYPH: Record<DeclKind, string> = {
  function: "ƒ",
  class: "C",
  type: "T",
  variable: "x",
  other: "•",
};

export function KindGlyph({ kind }: { kind: DeclKind }) {
  const s = useStrings();
  return (
    <span className={`kind-glyph kind-${kind}`} title={s.declKind[kind]}>
      {KIND_GLYPH[kind]}
    </span>
  );
}
