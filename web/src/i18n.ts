import { useSyncExternalStore } from "react";
import type { ChangeKind, FileEntry, FileStatus, ViewerFile } from "../../src/analysis/types";
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

export type Locale = "zh-CN" | "en";

/** diff 视图展示的降级原因：FileEntry 的降级原因去掉 no-profile（该语言本就没有投影，不算降级） */
type DiffDegradeReason = Exclude<NonNullable<FileEntry["degradedReason"]>, "no-profile">;
/** 查看器工具条的降级徽章原因（与 ViewerFile.degradedReason 全量一致） */
type ViewerDegradeReason = NonNullable<ViewerFile["degradedReason"]>;

/**
 * 界面文案目录：zh-CN 与 en 各提供一份完整实现（locales/ 下）。
 * 含插值的串用函数；英文有单复数之分的串在函数内判断。
 */
export interface Strings {
  /** 加载占位（App 整页与查看器工具条共用） */
  loading: string;
  /** 整页加载失败提示 */
  loadError: (error: string) => string;
  /** 顶栏分段：变更审阅 */
  modeChanges: string;
  /** 顶栏分段：浏览 */
  modeBrowse: string;
  /** 顶栏变更文件总数 */
  fileCount: (n: number) => string;
  /** 刷新按钮 */
  refresh: string;
  /** 刷新进行中的按钮文案 */
  refreshing: string;
  /** 无变更时的整页占位 */
  noChanges: string;
  /** 侧栏文件状态徽章 */
  statusLabel: Record<FileStatus, string>;
  /** diff 视图"已退回原始 diff"的原因文案 */
  degradeLabel: Record<DiffDegradeReason, string>;
  /** 变更分类徽章 */
  summaryChips: Record<ChangeKind, string>;
  /** 在查看器中打开按钮 */
  openInViewer: string;
  /** 已退回原始 diff 的提示（括号内含原因） */
  fellBack: (reason: string) => string;
  /** 简化视图"已折叠 N 行"提示 */
  foldedLines: (n: number) => string;
  /** 简化/原始切换按钮的快捷键提示（App 与查看器共用） */
  shortcutS: string;
  /** 简化视图分段按钮（App 与查看器共用） */
  simplified: string;
  /** 原始 diff 分段按钮 */
  rawDiff: string;
  /** 单列 diff 分段按钮 */
  unified: string;
  /** 双列 diff 分段按钮 */
  split: string;
  /** 查看器工具条的降级徽章 */
  viewerDegradeLabel: Record<ViewerDegradeReason, string>;
  /** 文件过滤输入框占位 */
  filterFiles: string;
  /** 过滤无匹配结果 */
  noMatchingFiles: string;
  /** 未选择文件时的占位 */
  selectFileToBrowse: string;
  /** 文件无法以文本查看的提示 */
  notTextViewable: string;
  /** 源码分段按钮 */
  source: string;
  /** 折叠的类型/格式性变更行数摘要 */
  foldedTypeFormat: (n: number) => string;
  /** 擦除标记的无障碍标注（hover 浮层还原被擦除的原文） */
  erasureHint: string;
  /** 简化视图无可见变更的占位 */
  noVisibleChanges: string;
}

const catalogs: Record<Locale, Strings> = { "zh-CN": zhCN, en };

let currentLocale: Locale = "en"; // 配置未到达前的默认（产品回落语言为英文）
let current: Strings = catalogs.en;
const listeners = new Set<() => void>();

/** 应用语言：换目录 + 同步 <html lang> + 通知组件重渲染 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  current = catalogs[locale];
  document.documentElement.lang = locale;
  for (const l of listeners) l();
}

/** 组件取当前语言文案；setLocale 时自动重渲染 */
export function useStrings(): Strings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => current,
  );
}
