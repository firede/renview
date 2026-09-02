import type { Strings } from "../i18n";

/** 简体中文（产品的原始语言，串与 i18n 改造前逐字一致） */
export const zhCN: Strings = {
  loading: "加载中…",
  loadError: (error) => `出错了：${error}`,
  serverGoneTitle: "renview 服务已断开",
  modeChanges: "变更",
  modeBrowse: "浏览",
  fileCount: (n) => `${n} 个文件`,
  refresh: "刷新",
  refreshing: "刷新中…",
  noChanges: "没有检测到变更",
  statusLabel: {
    add: "新增",
    delete: "删除",
    modify: "修改",
    rename: "改名",
  },
  degradeLabel: {
    // no-profile 不算降级（该语言本就没有投影），不展示
    "parse-error": "解析失败",
    "too-large": "文件过大",
    "no-source": "无法读取文件内容",
  },
  summaryChips: {
    signature: "签名",
    body: "实现",
    "type-only": "类型",
    added: "新增",
    removed: "删除",
  },
  openInViewer: "在查看器中打开",
  fellBack: (reason) => `已退回原始 diff（${reason}）`,
  foldedLines: (n) => `已折叠 ${n} 行`,
  shortcutS: "快捷键 S",
  shortcutB: "快捷键 B",
  toggleSidebar: "侧栏",
  simplified: "简化",
  rawDiff: "原始 diff",
  unified: "单列",
  split: "双列",
  viewerDegradeLabel: {
    // no-profile 不是失败，用户无从行动，仅显示"源码"表明投影态
    "no-profile": "源码",
    "parse-error": "已显示源码（解析失败）",
    "too-large": "已显示源码（文件过大）",
    binary: "二进制文件",
  },
  filterFiles: "过滤文件…",
  noMatchingFiles: "无匹配文件",
  selectFileToBrowse: "选择一个文件开始浏览",
  notTextViewable: "该文件无法以文本查看。",
  source: "源码",
  foldedTypeFormat: (n) => `${n} 行类型/格式性变更已折叠`,
  erasureHint: "被简化隐藏的原文",
  noVisibleChanges: "无可见变更（可能全部被折叠或为纯改名）。",
};
