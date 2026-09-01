import type { Messages } from "../i18n";

/** 简体中文（现有文案的原位迁移，保持既有措辞） */
export const zhCN: Messages = {
  cli: {
    help: `renview — 帮助人类降低认知负担的代码审核工具

用法: renview [选项] [<git diff 参数>...]

选项:
  -p, --port <端口>   指定本地服务端口（默认随机）
      --no-open       不自动打开浏览器
  -h, --help          显示帮助
  -v, --version       显示版本

未提供 git diff 参数时，默认展示 working tree 相对 HEAD 的变更（含 untracked 新文件）。

示例:
  renview                    审阅当前未提交变更
  renview --staged           审阅已暂存变更
  renview main...HEAD        审阅分支区间
  renview HEAD~3 -- src/     审阅指定区间与路径
`,
    invalidPort: (v) => `无效端口: ${v}`,
    notInRepo: "当前目录不在 git 仓库内。",
    started: (url) => `renview 已启动: ${url}`,
    repo: (root) => `仓库: ${root}`,
    configWarning: (path, w) => `配置 ${path}: ${w}`,
  },
  config: {
    tomlParseFailed: (d) => `TOML 解析失败（${d}），已使用默认配置`,
    fontFamilyNotString: (got) => `font_family 应为字符串（收到 ${got}），已使用默认字体`,
    fontSizeNotPositive: (got, fb) =>
      `font_size 应为正数（收到 ${got}），已使用默认字号 ${fb}`,
    languageNotString: (got) => `language 应为字符串（收到 ${got}），已自动检测语言`,
    languageUnsupported: (v) =>
      `language 无法匹配已支持的语言（收到 ${JSON.stringify(v)}，支持 zh-CN、en），已自动检测语言`,
  },
  api: {
    missingPath: "缺少 path 参数",
    invalidPath: "非法路径",
    fileNotFound: "文件不存在",
    notFound: "未找到",
    gitDiffFailed: (d) => `git diff 失败: ${d}`,
    gitLsFilesFailed: (d) => `git ls-files 失败: ${d}`,
  },
  analysis: {
    anonymousName: "(匿名)",
    unknownName: "(未知)",
    commentChanges: "注释变更",
    outsideDeclarations: "声明之外的变更",
    truncatedSuffix: "…（截断）",
    nameList: (shown, total) => `${shown}, …（共 ${total} 个）`,
    importsFold: (keyword, count, shown, hasMore) =>
      `${keyword} × ${count}（${shown.join("、")}${hasMore ? "…" : ""}）`,
    typeSpecJoiner: "；",
  },
};
