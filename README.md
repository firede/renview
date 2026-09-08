# renview

[English](README.en.md) · [官网](https://view.bandwidth.ren)

帮助人类读懂 agent 写的代码，把注意力留给业务建模、接口和关键流程。

renview 在本地浏览器中展示 Git 变更，收起类型标注等语言细节，让代码的主要变化更容易看清。

- **简化审阅**：保留连续的代码阅读体验，突出参数、模型成员与实现的变化。
- **随时对照**：悬停查看被简化的片段，展开折叠与上下文，或切换到原始 diff。
- **浏览源码**：用同样的简化视图阅读仓库文件，通过声明大纲跳转。

代码分析在本机完成，无需 LLM。简化视图用于辅助理解，原始代码始终可查。

## 安装

使用安装脚本（Windows 需在 Git Bash 中运行）：

```bash
curl -fsSL https://view.bandwidth.ren/install | bash
```

也可以通过 npm 安装：

```bash
npm install -g renview
```

支持 macOS、Linux（glibc）和 Windows，均提供 x64 与 arm64 版本。

升级到最新版：

```bash
renview upgrade
```

## 使用

在 Git 仓库中运行，自动打开浏览器：

```bash
renview
```

默认审阅全部未提交变更，包括已暂存、未暂存和未跟踪的新文件。

| 场景                                      | 命令                            |
| ----------------------------------------- | ------------------------------- |
| 只看已暂存变更                            | `renview diff --staged`         |
| 查看分支相对共同祖先的变更                | `renview diff main...HEAD`      |
| 对比三个提交前与当前工作区，只看 src 目录 | `renview diff HEAD~3 -- src/`   |
| 指定仓库目录                              | `renview -C ../project`         |
| 指定端口，不自动打开浏览器                | `renview --port 8080 --no-open` |

`renview` 等同于 `renview diff`。工具选项（如 `--port`、`--no-open`、`-C`）放在子命令前，`diff` 后的参数原样传给 `git diff`，`--` 用于分隔路径。旧写法 `renview main...HEAD`、`renview --staged` 改为增加 `diff` 子命令；端口使用 `--port`，不再支持 `-p`。

审阅已暂存变更或提交区间时，不混入工作区草稿。比较版本与筛选路径沿用 `git diff` 的参数，用 `renview --help` 查看工具选项。

界面默认进入「变更」模式，可在简化视图与原始 diff 之间切换，按需展开未变更的上下文。「浏览」模式用于阅读仓库文件。

支持 TypeScript / JavaScript、Rust、Go、Python 和 GDScript 的代码简化；其他文件使用原始 diff。

## 配置

无需配置即可使用，界面语言和主题默认跟随系统。需要自定义时，创建 `~/.config/renview/config.toml`；设置了 `XDG_CONFIG_HOME` 时使用该目录下的 `renview/config.toml`，Windows 使用 `%APPDATA%\renview\config.toml`。

```toml
language = "zh-CN"
theme = "light"
font_family = "JetBrains Mono, Sarasa Mono SC"
font_size = 13
update_check = false
```

| 配置项         | 说明                         | 默认值       |
| -------------- | ---------------------------- | ------------ |
| `language`     | `zh-CN` 或 `en`              | 自动检测     |
| `theme`        | `auto`、`light` 或 `dark`    | `auto`       |
| `font_family`  | 字体名称，多个字体用逗号分隔 | 系统等宽字体 |
| `font_size`    | 代码字号，单位 px            | `12`         |
| `update_check` | 启动时检查新版本             | `true`       |

界面配置保存后，重新聚焦窗口即可生效。

## 开发

需要 Bun；首次构建 GDScript 解析器还需要可用的 Docker。

```bash
bun install
bun run dev diff HEAD~5
```

开发服务启动后，在浏览器打开终端显示的地址。

| 命令                | 用途                                |
| ------------------- | ----------------------------------- |
| `bun run check`     | 测试、类型检查和 lint，共用构建资源 |
| `bun run test`      | 准备构建资源并运行全部测试          |
| `bun run typecheck` | 类型检查                            |
| `bun run build`     | 构建各平台二进制到 dist 目录        |
| `bun run gen:demo`  | 更新官网演示数据                    |

开发约定见 [AGENTS.md](AGENTS.md)，产品取舍见 [产品决策](.agents/truth/product.md)。

Web 应用的本地开发见 [app/README.md](app/README.md)。
