/**
 * renview 壳包 postinstall：平台包（optionalDependencies，按 os/cpu 过滤安装）里的二进制
 * 硬链接到 bin 桩位；optional dep 未装上时（--no-optional / yarn1 等）从 registry 下载兜底。
 * 纯 node 无依赖，任何包管理器的安装期都能跑。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.join(pkgDir, "bin", "renview.exe");
const require = createRequire(import.meta.url);
const version = require("./package.json").version;

const OS = { darwin: "darwin", linux: "linux", win32: "windows" };
const CPU = { arm64: "arm64", x64: "x64" };

function fail(message) {
  console.error(`renview: ${message}`);
  console.error("renview: 也可以改用安装脚本：curl -fsSL https://renview.6636.tech/install | bash");
  process.exit(1);
}

const platform = OS[process.platform];
const arch = CPU[process.arch];
if (!platform || !arch) fail(`unsupported platform: ${process.platform} ${process.arch}`);
if (platform === "windows" && arch !== "x64") fail("Windows arm64 is not supported yet; use WSL");
const platformPkg = `renview-${platform}-${arch}`;
const binName = platform === "windows" ? "renview.exe" : "renview";

function linkBinary(source) {
  fs.rmSync(binPath, { force: true });
  try {
    fs.linkSync(source, binPath);
  } catch {
    fs.copyFileSync(source, binPath);
  }
  if (platform !== "windows") fs.chmodSync(binPath, 0o755);
}

/** optional dep 已按 os/cpu 装上时，直接取其 bin 下的二进制 */
function fromOptionalDependency() {
  try {
    const depPkgJson = require.resolve(`${platformPkg}/package.json`);
    const candidate = path.join(path.dirname(depPkgJson), "bin", binName);
    return fs.existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** optional dep 缺失时的兜底：从 registry 元数据取 tarball 地址，下载 + 校验 sha512 + 解压 */
async function fromRegistry() {
  const registry = (process.env.npm_config_registry || "https://registry.npmjs.org").replace(
    /\/+$/,
    "",
  );
  const metaRes = await fetch(`${registry}/${platformPkg}/${version}`);
  if (!metaRes.ok) {
    fail(`platform package ${platformPkg}@${version} not found on ${registry}`);
  }
  const meta = await metaRes.json();
  const url = meta?.dist?.tarball;
  const integrity = meta?.dist?.integrity;
  if (!url) fail(`registry metadata for ${platformPkg}@${version} has no tarball URL`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "renview-postinstall-"));
  try {
    const res = await fetch(url);
    if (!res.ok) fail(`download failed: ${url} (HTTP ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (typeof integrity === "string" && integrity.startsWith("sha512-")) {
      const actual = `sha512-${createHash("sha512").update(buf).digest("base64")}`;
      if (actual !== integrity) fail(`integrity check failed for ${platformPkg}@${version}`);
    }
    const tgz = path.join(tmp, "pkg.tgz");
    fs.writeFileSync(tgz, buf);
    // win10+ 自带 bsdtar，macOS/Linux 必有 tar
    execFileSync("tar", ["-xzf", tgz, "-C", tmp], { stdio: "ignore" });
    const extracted = path.join(tmp, "package", "bin", binName);
    if (!fs.existsSync(extracted)) fail(`tarball of ${platformPkg}@${version} has no bin/${binName}`);
    linkBinary(extracted);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const local = fromOptionalDependency();
if (local) {
  linkBinary(local);
} else {
  console.warn(`renview: optional dependency ${platformPkg} not installed, downloading from registry…`);
  try {
    await fromRegistry();
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

// 装完验证一次：跑不起来（如 glibc 过旧）时尽早暴露，而不是留一个坏二进制
try {
  const out = execFileSync(binPath, ["--version"], {
    encoding: "utf8",
    timeout: 15000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (out !== version) {
    console.warn(`renview: installed binary reports version ${out}, expected ${version}`);
  }
} catch (e) {
  console.warn(`renview: installed binary failed to run: ${e instanceof Error ? e.message : e}`);
}
