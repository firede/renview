/**
 * 更新检测与升级：npm registry 为唯一版本源。
 * 被动提示读 config 目录的 update-check.json 缓存（上次结果先行提示、后台刷新供下次），
 * fire-and-forget，任何失败静默，绝不阻塞启动；升级动作为用户显式触发的 `renview upgrade`。
 */
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json";
import { configPath } from "./config";
import type { Messages } from "./i18n";

/** 官网承载的安装脚本地址（upgrade 对脚本安装方式重跑它） */
export const INSTALL_SCRIPT_URL = "https://renview.6636.tech/install";

function registry(env: NodeJS.ProcessEnv = process.env): string {
  return (env.RENVIEW_REGISTRY ?? "https://registry.npmjs.org").replace(/\/+$/, "");
}

/** 纯数字三元组比较：a>b → 1，a<b → -1，相等或任一侧非标准 semver → 0（保守不提示） */
export function compareVersions(a: string, b: string): number {
  const pa = /^(\d+)\.(\d+)\.(\d+)/.exec(a);
  const pb = /^(\d+)\.(\d+)\.(\d+)/.exec(b);
  if (!pa || !pb) return 0;
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export type InstallMethod = "script" | "bun" | "pnpm" | "yarn" | "npm" | "unknown";

/**
 * 按二进制所在路径推断安装方式：~/.renview/bin 下为安装脚本；
 * 各 pm 全局目录按路径特征区分；不是 renview 命名的二进制（bun run 源码、dist/ 直跑）为 unknown。
 */
export function detectInstallMethod(
  execPath: string,
  home: string = homedir(),
): InstallMethod {
  // 先统一分隔符与小写再判定（basename 在 POSIX 上不认 Windows 的反斜杠）
  const p = execPath.replace(/\\/g, "/").toLowerCase();
  const base = p.split("/").pop()!;
  if (base !== "renview" && base !== "renview.exe") return "unknown";
  const scriptHome = `${home.replace(/\\/g, "/").toLowerCase()}/.renview/`;
  if (p.startsWith(scriptHome)) return "script";
  if (p.includes("/.bun/")) return "bun";
  if (p.includes("/pnpm")) return "pnpm";
  if (p.includes("/yarn/")) return "yarn";
  return "npm";
}

/** 从 npm registry 取壳包最新版本；任何失败返回 null（调用方自行决定报错还是静默） */
export async function latestVersion(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  try {
    const res = await fetch(`${registry(env)}/renview/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

interface UpdateCheckCache {
  lastCheck: number;
  latest?: string;
}

const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * 被动更新提示：缓存里已知更新版本则打印一行；缓存超过 24h 则后台拉取刷新。
 * 任何失败都静默——更新检查永不阻塞审阅。
 */
export async function checkForUpdate(
  current: string,
  m: Messages,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    const cacheFile = join(dirname(configPath(env)), "update-check.json");
    let cache: UpdateCheckCache | null = null;
    try {
      const parsed: unknown = await Bun.file(cacheFile).json();
      if (parsed && typeof parsed === "object" && "lastCheck" in parsed) {
        cache = parsed as UpdateCheckCache;
      }
    } catch {
      // 无缓存或损坏：当作无缓存
    }
    if (cache?.latest && compareVersions(cache.latest, current) > 0) {
      console.log(m.cli.updateAvailable(current, cache.latest));
    }
    if (!cache || typeof cache.lastCheck !== "number" || Date.now() - cache.lastCheck > CHECK_INTERVAL) {
      const latest = await latestVersion(env);
      if (latest) {
        const next: UpdateCheckCache = { lastCheck: Date.now(), latest };
        await Bun.write(cacheFile, JSON.stringify(next));
      }
    }
  } catch {
    // 静默
  }
}

async function runInherited(cmd: string[]): Promise<number> {
  const proc = Bun.spawn(cmd, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  return proc.exited;
}

/** `renview upgrade [版本]`：不指定版本时取 registry latest；按安装方式分流升级 */
export async function upgrade(target: string | undefined, m: Messages): Promise<void> {
  if (target && !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(target)) {
    console.error(m.cli.upgradeInvalidVersion(target));
    process.exit(1);
  }
  // 先判定安装渠道：非正式渠道直接拒，免得离线时先报一个误导性的网络错误
  const method = detectInstallMethod(process.execPath);
  if (method === "unknown") {
    console.error(m.cli.upgradeUnknownInstall);
    process.exit(1);
  }
  const version = target ?? (await latestVersion());
  if (!version) {
    console.error(m.cli.upgradeFetchFailed);
    process.exit(1);
  }
  if (!target && compareVersions(version, pkg.version) <= 0) {
    console.log(m.cli.upgradeAlreadyLatest(pkg.version));
    return;
  }

  let code: number;
  if (method === "script") {
    console.log(m.cli.upgradeViaScript(version));
    const scriptPath = join(tmpdir(), `renview-install-${process.pid}.sh`);
    try {
      const res = await fetch(INSTALL_SCRIPT_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Bun.write(scriptPath, await res.text());
      // 安装目录与 PATH 已在首次安装时配置，重跑脚本跳过这两步
      code = await runInherited(["bash", scriptPath, "--version", version, "--no-modify-path"]);
    } catch (e) {
      console.error(m.cli.upgradeFailed(e instanceof Error ? e.message : String(e)));
      console.error(m.cli.upgradeManualHint);
      process.exit(1);
    }
  } else {
    console.log(m.cli.upgradeViaPm(method, version));
    const cmds: Record<"npm" | "bun" | "pnpm" | "yarn", string[]> = {
      npm: ["npm", "install", "-g", `renview@${version}`],
      bun: ["bun", "install", "-g", `renview@${version}`],
      pnpm: ["pnpm", "add", "-g", `renview@${version}`],
      yarn: ["yarn", "global", "add", `renview@${version}`],
    };
    code = await runInherited(cmds[method]);
  }
  if (code !== 0) {
    console.error(m.cli.upgradeFailed(`exit code ${code}`));
    process.exit(1);
  }
}
