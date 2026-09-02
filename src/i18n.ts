/**
 * 语言解析与核心文案目录。
 * 解析链：配置文件 language → 环境检测（LC_ALL > LC_MESSAGES > LANG > Intl 系统 locale）→ 英文回落；
 * 匹配按 BCP 47 根语言（忽略地区/文字）：zh-TW → zh → zh-CN，en-US → en。
 * 语言文件按 BCP 47 标签命名（src/locales/en.ts、src/locales/zh-CN.ts），
 * 文案按各语言原生习惯撰写，不做逐字对译。
 */
import { en } from "./locales/en";
import { zhCN } from "./locales/zh-CN";

export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** 任何匹配失败都回落到英文 */
export const FALLBACK_LOCALE: Locale = "en";

export function messages(locale: Locale): Messages {
  return locale === "zh-CN" ? zhCN : en;
}

/** BCP 47 根语言匹配：归一化（去编码/修饰符、_ → -）后只取语言子标签；不匹配返回 null */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const root = tag
    .trim()
    .split(/[.@]/, 1)[0]!
    .replace(/_/g, "-")
    .split("-", 1)[0]!
    .toLowerCase();
  if (!root) return null;
  for (const l of SUPPORTED_LOCALES) {
    if (l.split("-", 1)[0]!.toLowerCase() === root) return l;
  }
  return null;
}

/** 经 Intl 取操作系统 locale（Windows 等无 LANG 环境）；不可用时返回 null */
function intlSystemLocale(): string | null {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale || null;
  } catch {
    return null;
  }
}

/** 环境语言检测：POSIX 变量优先，其次 OS locale，最后英文回落 */
export function detectLocale(
  env: NodeJS.ProcessEnv = process.env,
  systemLocale?: string | null,
): Locale {
  for (const key of ["LC_ALL", "LC_MESSAGES", "LANG"] as const) {
    const m = matchLocale(env[key]);
    if (m) return m;
  }
  return matchLocale(systemLocale === undefined ? intlSystemLocale() : systemLocale) ??
    FALLBACK_LOCALE;
}

/** 完整解析链：配置值（BCP 47 根匹配）优先；未设置/无法匹配时走环境检测（含英文回落） */
export function resolveLocale(
  configured: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Locale {
  return matchLocale(configured) ?? detectLocale(env);
}

/** 核心文案目录形状：CLI / 配置警告 / API 错误 / 分析层摘要串 */
export interface Messages {
  cli: {
    help: string;
    invalidPort: (value: string) => string;
    notInRepo: string;
    started: (url: string) => string;
    repo: (root: string) => string;
    configWarning: (path: string, warning: string) => string;
    /** 被动更新提示：启动时一行（缓存命中才打印） */
    updateAvailable: (current: string, latest: string) => string;
    upgradeInvalidVersion: (value: string) => string;
    upgradeFetchFailed: string;
    /** 非安装脚本/包管理器渠道（源码或 dist/ 直跑），拒绝升级 */
    upgradeUnknownInstall: string;
    upgradeAlreadyLatest: (version: string) => string;
    upgradeViaScript: (version: string) => string;
    upgradeViaPm: (pm: string, version: string) => string;
    upgradeFailed: (detail: string) => string;
    upgradeManualHint: string;
  };
  config: {
    tomlParseFailed: (detail: string) => string;
    fontFamilyNotString: (got: string) => string;
    fontSizeNotPositive: (got: string, fallback: number) => string;
    languageNotString: (got: string) => string;
    languageUnsupported: (value: string) => string;
    updateCheckNotBoolean: (got: string) => string;
  };
  api: {
    missingPath: string;
    invalidPath: string;
    fileNotFound: string;
    notFound: string;
    gitDiffFailed: (detail: string) => string;
    gitLsFilesFailed: (detail: string) => string;
  };
  analysis: {
    anonymousName: string;
    unknownName: string;
    commentChanges: string;
    outsideDeclarations: string;
    /** 类型文本超长截断后缀 */
    truncatedSuffix: string;
    /** 成员名超过 6 个截断后的总数后缀 */
    nameList: (shown: string, total: number) => string;
    /** 顶层 import/use 连续段的单行折叠摘要 */
    importsFold: (keyword: string, count: number, shown: string[], hasMore: boolean) => string;
    /** 多个 type 声明摘要之间的连接符 */
    typeSpecJoiner: string;
    /** diff 折叠组的成员级摘要（定位到类型声明时）；members 为 null 时只给声明名 */
    foldedTypeMembers: (decl: string, members: string | null) => string;
    /** body 变更单元的实现摘要注释行（决策点/调用枚举） */
    bodyNote: (parts: string[], total: number, hasMore: boolean) => string;
  };
}
