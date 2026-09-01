#!/usr/bin/env bun
import pkg from "../package.json";
import { configPath, createConfigLoader } from "./config";
import { findRepoRoot } from "./git";
import { messages, type Messages } from "./i18n";
import { startServer } from "./server";

interface CliOptions {
  port?: number;
  open: boolean;
  gitArgs: string[];
}

function parseArgs(argv: string[], m: Messages): CliOptions {
  const gitArgs: string[] = [];
  let port: number | undefined;
  let open = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-p" || a === "--port") {
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
  return { port, open, gitArgs };
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

  const opts = parseArgs(process.argv.slice(2), m);

  const root = await findRepoRoot(process.cwd());
  if (!root) {
    console.error(m.cli.notInRepo);
    process.exit(1);
  }

  const server = await startServer(root, opts.gitArgs, { port: opts.port });
  const url = `http://127.0.0.1:${server.port}`;
  console.log(m.cli.started(url));
  console.log(m.cli.repo(root));
  if (opts.open) openBrowser(url);
}

await main();
