import type { Messages } from "../i18n";

/** 简体中文（现有文案的原位迁移，保持既有措辞） */
export const zhCN: Messages = {
  cli: {
    help: `renview — 帮助人类降低认知负担的代码审核工具

用法: renview [选项] [<git diff 参数>...]
      renview upgrade [版本]

子命令:
  upgrade [版本]        升级到最新（或指定）版本

选项:
  -p, --port <端口>   指定本地服务端口（默认 17171，占用时递增）
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
    updateAvailable: (current, latest) =>
      `发现新版本 v${latest}（当前 v${current}），运行 renview upgrade 升级`,
    upgradeInvalidVersion: (v) => `无效版本号: ${v}`,
    upgradeFetchFailed:
      "获取最新版本失败，请检查网络（或 RENVIEW_REGISTRY 指向的 registry 是否可用）",
    upgradeUnknownInstall:
      "当前 renview 不是经安装脚本或包管理器安装的（可能是开发构建），请手动更新",
    upgradeAlreadyLatest: (v) => `已是最新版本（v${v}）`,
    upgradeViaScript: (v) => `正在通过安装脚本升级到 v${v}…`,
    upgradeViaPm: (pm, v) => `正在通过 ${pm} 升级到 v${v}…`,
    upgradeFailed: (d) => `升级失败: ${d}`,
    upgradeManualHint: "手动升级: curl -fsSL https://renview.6636.tech/install | bash",
  },
  config: {
    tomlParseFailed: (d) => `TOML 解析失败（${d}），已使用默认配置`,
    fontFamilyNotString: (got) => `font_family 应为字符串（收到 ${got}），已使用默认字体`,
    fontSizeNotPositive: (got, fb) => `font_size 应为正数（收到 ${got}），已使用默认字号 ${fb}`,
    languageNotString: (got) => `language 应为字符串（收到 ${got}），已自动检测语言`,
    languageUnsupported: (v) =>
      `language 无法匹配已支持的语言（收到 ${JSON.stringify(v)}，支持 zh-CN、en），已自动检测语言`,
    updateCheckNotBoolean: (got) => `update_check 应为布尔值（收到 ${got}），已使用默认开启`,
    themeUnsupported: (v) => `theme 只支持 auto、dark、light（收到 ${v}），已跟随系统`,
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
    foldedTypeMembers: (decl, members) =>
      members ? `${decl}：${members}（类型/格式变更）` : `${decl}（类型/格式变更）`,
    bodyNote: (parts, total, hasMore) =>
      `实现变化：${parts.join("；")}${hasMore ? `（共 ${total} 处）` : ""}`,
  },
};
