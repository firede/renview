# 产品与业务决策

- renview 定位：为 agent 主导开发场景优化人类审阅认知带宽的 diff review 工具，核心是人类看抽象是否合理而非逐行看实现。
- 核心交互：基于静态程序化分析的语言感知 diff 投影 + 逐级披露，v1 不做 LLM 摘要。
- v1 纯查看，不做评论、不做状态存储，用户发现问题后复制粘贴回 harness 用自然语言反馈。
- 主要入口是 agent harness 内 slash 命令 / skill 触发 CLI，CLI 参数语义贴合 git diff。
- CLI 无参默认展示 working tree vs HEAD 的变更（贴合 agent harness 的 diff 视图语义）。
- 默认 diff 必须包含 untracked 新文件（agent 常新建文件，漏掉会形成审阅盲区）。
- 信任原则：折叠而非删除，每个折叠处可见隐藏了什么并可展开，任意层级一键回到原始 diff。
- 解析失败或超大文件降级为行级 diff，且降级状态对用户可见。
- body 变更的"摘要"是结构化枚举（哪个分支变了、新增了什么调用），不是自然语言摘要。
- 注释变更折叠为"注释变更"低优先级单元：可见、可展开，但不打断主审阅流程。
- 排序与过滤同等重要：文件级汇总优先呈现公开 API / 签名变更。
- 目标规模按单 PR 级 diff 设计，初期不做 monorepo 性能设计。
- 语言顺序：TypeScript/TSX 先行，其余语言先退回行级 diff。
- worktree 支持、已看标记、agent 化 review 能力均为后期事项。
- 竞品结论：静态语言感知投影 + 逐级披露的格子目前空缺（difftastic 做精度、SemanticDiff 只做风格噪音、CodeRabbit 等做 LLM 散文摘要），但存在窗口期。
- npm 包名 renview 无冲突。
