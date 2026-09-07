#!/usr/bin/env bun
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import pkg from "../package.json";
import { configPath, createConfigLoader } from "./config";
import { findRepoRoot, getDiff, resolveDiffArgs } from "./git";
import { messages, type Messages } from "./i18n";
import { startServer } from "./server";
import { checkForUpdate, upgrade } from "./updater";

interface CliOptions {
  port?: number;
  cwd?: string;
  open: boolean;
  gitArgs: string[];
}

export function parseArgs(argv: string[], m: Messages): CliOptions {
  const gitArgs: string[] = [];
  let port: number | undefined;
  let open = true;
  let cwd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      gitArgs.push(...argv.slice(i));
      break;
    }
    if (a === "-C" || a === "--cwd" || a?.startsWith("--cwd=")) {
      const value = a.startsWith("--cwd=") ? a.slice(6) : argv[++i];
      if (!value || (!a.startsWith("--cwd=") && value.startsWith("-"))) {
        console.error(m.cli.missingCwd);
        process.exit(1);
      }
      cwd = value;
    } else if (a === "-p" || a === "--port") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v <= 0 || v > 65535) {
        console.error(m.cli.invalidPort(argv[i]!));
        process.exit(1);
      }
      port = v;
    } else if (a === "--no-open") {
      open = false;
    } else if (a === "-h" || a === "--help") {
      console.log(m.cli.help);
      process.exit(0);
    } else if (a === "-v" || a === "--version") {
      console.log(pkg.version);
      process.exit(0);
    } else {
      gitArgs.push(a);
    }
  }
  return { port, open, gitArgs, cwd };
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  Bun.spawn([cmd, ...args], { stdout: "ignore", stderr: "ignore" });
}

async function main(): Promise<void> {
  // 先读配置解析语言（配置 > 环境检测 > 英文），CLI 输出全程使用该语言
  const { config } = await createConfigLoader(configPath())();
  const m = messages(config.language);

  const argv = process.argv.slice(2);
  // upgrade 是子命令而非 diff 参数，拦截在仓库检测之前（不要求在 git 仓库内）
  if (argv[0] === "upgrade") {
    await upgrade(argv[1], m);
    return;
  }

  const opts = parseArgs(argv, m);

  const cwd = resolve(opts.cwd ?? process.cwd());
  if (!(await stat(cwd).catch(() => null))?.isDirectory()) {
    console.error(m.cli.invalidCwd(cwd));
    process.exit(1);
  }
  const root = await findRepoRoot(cwd);
  if (!root) {
    console.error(opts.cwd == null ? m.cli.notInRepo : `${m.cli.notInRepo} ${cwd}`);
    process.exit(1);
  }

  const diffArgs = await resolveDiffArgs(root, opts.gitArgs);
  // 使用与 API 相同的命令预检；无效 revision 或参数不应先打开浏览器。
  try {
    await getDiff(root, diffArgs, config.language);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const server = await startServer(root, diffArgs, { port: opts.port });
  const url = `http://127.0.0.1:${server.port}`;
  console.log(m.cli.started(url));
  console.log(m.cli.repo(root));
  // 被动更新提示：读缓存命中才打印，后台刷新缓存；fire-and-forget，绝不阻塞启动
  if (config.updateCheck && !process.env.RENVIEW_DISABLE_UPDATE_CHECK) {
    void checkForUpdate(pkg.version, m);
  }
  if (opts.open) openBrowser(url);
}

if (import.meta.main) await main();
