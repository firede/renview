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

## 开发

```bash
bun install
bun run dev                      # 同步 wasm + 构建前端 + watch 启动 CLI
bun test                         # 分析层测试
bun run typecheck
bun run build                    # 交叉编译全平台单文件二进制到 dist/
bun run scripts/build.ts --host  # 仅编译本机平台
```

## 决策记录

业务与技术决策以一句话条目记录在 `.agents/truth/`（product / architecture / stack）。
