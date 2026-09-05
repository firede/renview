# renview 开发指南

帮助人类降低认知负担的代码审核工具。用法与开发命令见 [README.md](README.md)。

## 产品决策

`.agents/truth/product.md` 只记录对产品重要、且无法从代码直接读出的定位、范围与取舍理由。

- 只有改变这类产品取舍时才更新 truth；每条一句话，说明结论与理由，合并重复条目。
- 实现细节、依赖版本、测试约束、修复经过与审查结果留在代码、测试、提交或专项文档中，不复制进 truth。
- 过期或代码已能说明的条目直接删除，历史由 git 保留；仅会反复被重提的弃案才记入 `.agents/archived.md`。
- 产品方向变更前查阅相关决策；普通修复、重构和样式调整无需新增记录。

## 代码约定

- 注释、文档、提交信息一律中文；提交信息用 `feat|fix|test|docs|chore|refactor: 摘要` 格式。
- 测试用 `bun:test`，放 `test/*.test.ts`；改分析层逻辑必须同步补测试。
- 提交前跑 `bun run test` 与 `bun run typecheck`，保持全绿；pre-push 钩子（simple-git-hooks，`bun install` 时经 prepare 自动安装）强制同一道检查，紧急时用 `git push --no-verify` 跳过。
- 注意 `bun test`（裸命令）与 `bun run test`（含 sync:wasm）的区别：CI、钩子等干净环境一律用 `bun run test`。
