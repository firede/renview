# 技术选型

- 运行时与分发：Bun，`bun build --compile` 单文件跨平台分发（Claude Code / opencode 同款路线）。
- 前端：React + TypeScript + Vite，构建产物嵌入二进制。
- 传统 diff 视图渲染用现成库 react-diff-view，投影视图完全自研。
- 语法高亮：Shiki（createHighlighterCore + JS 正则引擎，避开 oniguruma wasm 嵌入），浏览器内按语言懒加载，主题 github-dark-default。
- 前端不引入路由库与状态库，样式先纯 CSS。
- tree-sitter：运行时用 web-tree-sitter（WASM，不用 node 原生 binding，避免 node-gyp / .node 分发问题）；语法包优先选官方 npm 自带 wasm 的并精确锁版（具体版本以 lockfile 为准），由 scripts/sync-wasm.ts 复制到 wasm/ 后内嵌。
- 语法 wasm 与 web-tree-sitter 版本、query 三位一体锁定，CI 自建语法 wasm。
- wasm 必须 `with { type: "file" }` 嵌入并按字节加载（绕开 bun --compile 的 wasm 路径 bug）。
- 避免任何 V8 API 原生依赖（nodegit、node-pty、ast-grep napi 等），运行时依赖保持纯 JS / WASM。
- 语言 wasm：tree-sitter-gdscript 无官方 wasm 包，sync-wasm 经 docker emscripten 从 grammar 源码自建（wasm/gdscript.wasm 存在则跳过）；其余语言用 npm 自带 wasm。
- 分发主体为 bun --compile 单文件二进制：GitHub Releases + 安装脚本，npm 包仅作二进制 CDN（控制运行环境，避免非 bun 环境误装不可用）；二进制 60–120MB 需 gzip。
- CI 锁定 Bun 版本，按平台跑真实二进制的冒烟测试。
- UI 组件库：暂不引入；hover 披露（tooltip/popover 定位与焦点管理）落地时选用 headless 的 base-ui（与纯 CSS 相容），不引入 shadcn/ui（绑定 tailwind 样式体系，与"样式纯 CSS"冲突）。目录树等轻量交互自研（base-ui 本无现成 tree 组件）。
- 代码字体：系统栈（ui-monospace → "SF Mono" → Menlo → Consolas → Liberation Mono → monospace），不内置字体资产；全站收敛到唯一 token `--font-mono` 并元素级声明（UA 的 pre 样式会压过继承值，代码区声明必须落在元素上），未来开放用户配置代码字体时覆写该 token 即可；若 dogfood 中跨设备渲染不一致影响审阅，再评估内置 OFL 等宽字体。
