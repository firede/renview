#!/usr/bin/env bun
import pkg from "../package.json";
import { findRepoRoot } from "./git";
import { startServer } from "./server";

const HELP = `renview — 帮助人类降低认知负担的代码审核工具

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
`;

interface CliOptions {
  port?: number;
  open: boolean;
  gitArgs: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const gitArgs: string[] = [];
  let port: number | undefined;
  let open = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p" || a === "--port") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v <= 0 || v > 65535) {
        console.error(`无效端口: ${argv[i]}`);
        process.exit(1);
      }
      port = v;
    } else if (a === "--no-open") {
      open = false;
    } else if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (a === "-v" || a === "--version") {
      console.log(pkg.version);
      process.exit(0);
    } else {
      gitArgs.push(a);
    }
  }
  return { port, open, gitArgs };
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  Bun.spawn([cmd, ...args], { stdout: "ignore", stderr: "ignore" });
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const root = await findRepoRoot(process.cwd());
  if (!root) {
    console.error("当前目录不在 git 仓库内。");
    process.exit(1);
  }

  const server = await startServer(root, opts.gitArgs, { port: opts.port });
  const url = `http://127.0.0.1:${server.port}`;
  console.log(`renview 已启动: ${url}`);
  console.log(`仓库: ${root}`);
  if (opts.open) openBrowser(url);
}

await main();
