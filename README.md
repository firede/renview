# renview

帮助人类降低认知负担的代码审核工具。对 git diff 做语言感知的投影（签名/实现/类型变更分层），支持逐级披露与原始 diff 回退。

## 使用

```bash
renview                    # 审阅未提交变更（working tree vs HEAD，含 untracked 新文件）
renview --staged           # 审阅已暂存变更
renview main...HEAD        # 审阅分支区间
renview HEAD~3 -- src/     # 指定区间与路径
renview -p 8080 --no-open  # 指定端口、不自动打开浏览器
```

除 `-p/--port`、`--no-open`、`-h/--help`、`-v/--version` 外，参数原样透传给 `git diff`。

界面含「变更 / 浏览」两种模式：变更 = diff 审阅（默认简化视图，可回退原始 diff）；浏览 = 完整文件的只读简化视图（可切源码、声明大纲跳转）。

## 配置

配置文件为 TOML 格式，位置：`$XDG_CONFIG_HOME/renview/config.toml`（默认 `~/.config/renview/config.toml`），Windows 为 `%APPDATA%\renview\config.toml`。

```toml
# 界面语言：BCP 47 标签，按根语言匹配（如 zh-TW 归为 zh-CN）；支持 zh-CN、en
# 不设置时自动检测系统语言（LC_ALL/LC_MESSAGES/LANG），匹配不到回落英文
language = "zh-CN"
# 代码字体：逗号分隔列表，未安装时回落到内置系统等宽栈
font_family = "JetBrains Mono, Sarasa Mono SC"
# 代码阅读区字号（px，默认 12），行高随字号联动
font_size = 13
```

保存后窗口重新聚焦即生效，无需重启。配置写坏（语法/类型错误）时回退默认值并在终端提示，不影响审阅。

## 开发

```bash
bun install
bun run dev                      # 同步 wasm + 构建前端 + watch 启动 CLI
bun test                         # 分析层测试
bun run typecheck
bun run build                    # 交叉编译全平台单文件二进制到 dist/
bun run scripts/build.ts --host  # 仅编译本机平台

# 体验（示例变更仓库：math.ts / main.rs 已修改，util.ts 未跟踪）
bun run scripts/gen-fixture.ts
(cd test/fixture-repo && bun run ../../src/cli.ts)
```

## 决策记录

业务与技术决策以一句话条目记录在 `.agents/truth/`（product / architecture / stack）。
