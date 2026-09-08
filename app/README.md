# renview Web 应用

`app/` 提供公开 GitHub PR 的变更审阅，与本地工具共享查看器和分析核心；`www/` 是官网。

## 本地开发

需要 Bun 和 Redis。首次构建 GDScript 解析器还需要 Docker。

1. 在仓库根目录执行 `bun install`。
2. 复制 `.env.example` 为 `.env`，填写 GitHub App 的 Client ID、Client Secret，并用 `openssl rand -hex 32` 生成 `AUTH_ENCRYPTION_KEY`。
3. GitHub App 的回调地址设为 `${APP_ORIGIN}/auth/callback`；开发环境默认 `http://localhost:3000/auth/callback`。保持用户令牌过期，不申请额外权限，不启用 Webhook。此登录流程不需要 App 私钥。
4. 启动 Redis，在仓库根目录执行 `bun run dev:app`。

| 命令                | 用途                  |
| ------------------- | --------------------- |
| `bun run dev:app`   | 启动开发服务          |
| `bun run build:app` | 构建应用和分析 worker |
| `bun run start:app` | 启动构建后的应用      |

运行构建后的应用时，将 `ANALYSIS_WORKER_PATH` 设为 `app/dist/analysis-worker.js` 的绝对路径。`app/Dockerfile` 使用仓库根目录作为构建上下文。

## 访问

首页接受 GitHub PR 地址，也支持 `/?pr=<编码后的 PR 地址>` 快捷跳转，阅读地址为 `/gh/owner/repo/pull/123`。

应用只读取公开 PR，不提供全仓浏览。认证信息保存在 SQLite，源码和分析结果仅作临时缓存；用户令牌过期后需要重新登录。

发布构建使用 `bun run build:release`，产出 CLI 包及 `dist/app-image/`。CI 将后者作为 Docker 命名上下文 `release`，设置构建参数 `APP_BUILD=release`，复用同一次构建的应用产物；普通 Docker 构建仍从源码开始。
