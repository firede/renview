import type { ReactNode, SVGProps } from "react";
import type { DeclKind } from "../../src/analysis/types";
import { useStrings } from "./i18n";

/**
 * 内联 SVG 图标集：16 视窗、currentColor 描边、1.5 线宽，风格对齐 lucide。
 * 不引入图标包——所需图标极少，内联零依赖且可被单文件二进制直接内嵌。
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M6 2.5v11" />
    </Icon>
  );
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
