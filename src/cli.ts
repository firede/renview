#!/usr/bin/env bun
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import pkg from "../package.json";
import { configPath, createConfigLoader } from "./config";
import { findRepoRoot, getDiff, resolveDiffArgs } from "./git";
import { messages } from "./i18n";
import { parseArgs } from "./cli-args";
import { startServer } from "./server";
import { checkForUpdate, upgrade } from "./updater";

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
  // 升级不依赖仓库，在目录检测前分流。
  if (opts.command === "upgrade") {
    await upgrade(opts.version, m);
    return;
  }

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

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
