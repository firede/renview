# 技术选型

- 运行时与分发：Bun，`bun build --compile` 单文件跨平台分发（Claude Code / opencode 同款路线）。
- 前端：React + TypeScript + Vite，构建产物嵌入二进制。
- 传统 diff 视图用现成库渲染（首选 @git-diff-view/react 或 react-diff-view），投影视图完全自研。
- 语法高亮：Shiki，浏览器内运行，按语言懒加载。
- 前端不引入路由库与状态库，样式先纯 CSS。
- tree-sitter 运行时用 web-tree-sitter（WASM），不用 node 原生 binding（避免 node-gyp / .node 分发问题）。
- 语法 wasm 与 web-tree-sitter 版本、query 三位一体锁定，CI 自建语法 wasm。
- wasm 必须 `with { type: "file" }` 嵌入并按字节加载（绕开 bun --compile 的 wasm 路径 bug）。
- 避免任何 V8 API 原生依赖（nodegit、node-pty 等），运行时依赖保持纯 JS / WASM。
- 统一 diff 解析：服务端用 parse-diff 0.12.0（精确锁定）。
- 传统 diff 视图渲染选定 react-diff-view 3.3.3，投影视图为完全自研组件。
- tree-sitter：web-tree-sitter 0.27.0 + tree-sitter-typescript 0.23.2（官方 npm 包自带 wasm），精确锁版，wasm 由 scripts/sync-wasm.ts 复制到 wasm/ 后内嵌。
- 已实测：bun build --compile 单文件二进制内 tree-sitter WASM 解析 + 内嵌 SPA 服务全链路可用。
- 分发入口单一：GitHub Releases + 安装脚本，二进制 60–120MB 需 gzip 分发。
- CI 锁定 Bun 版本，按平台跑真实二进制的冒烟测试。
