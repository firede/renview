/**
 * 把 dist/ 的平台二进制组装成发布产物：
 *   dist/npm/renview-<target>/  5 个平台包（os/cpu 字段供 npm 平台过滤）
 *   dist/npm/renview/           壳包（optionalDependencies 钉同版本平台包 + postinstall）
 *   dist/release/renview-<target>.tar.gz + checksums.txt  GitHub Release 镜像资产
 * 用法：先 bun run build（或 --host 只出本机平台，此时 pack 只打包已存在的目标），再 bun run scripts/pack.ts
 */
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import pkg from "../package.json";

const TARGETS = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "windows-x64"] as const;
type Target = (typeof TARGETS)[number];

const NPM_OS: Record<string, string> = { darwin: "darwin", linux: "linux", windows: "win32" };

const version = pkg.version;
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`package.json 版本号不是合法 semver: ${version}`);
  process.exit(1);
}

const REPOSITORY = { type: "git", url: "git+https://github.com/firede/renview.git" };

function targetInfo(target: Target) {
  const sep = target.indexOf("-");
  const platform = target.slice(0, sep);
  const arch = target.slice(sep + 1);
  const exe = platform === "windows";
  return {
    platform,
    arch,
    npmOs: NPM_OS[platform]!,
    binary: exe ? "renview.exe" : "renview",
    distFile: `dist/renview-${target}${exe ? ".exe" : ""}`,
  };
}

/** 只打包 dist/ 里真实存在的目标：CI 全量构建出 5 个，本地 --host 冒烟只出 1 个 */
const built = TARGETS.filter((t) => existsSync(targetInfo(t).distFile));
if (built.length === 0) {
  console.error("dist/ 下没有任何平台二进制，请先运行 bun run build");
  process.exit(1);
}

rmSync("dist/npm", { recursive: true, force: true });
rmSync("dist/release", { recursive: true, force: true });
mkdirSync("dist/npm", { recursive: true });
mkdirSync("dist/release", { recursive: true });

const checksums: string[] = [];

for (const target of built) {
  const info = targetInfo(target);
  const dir = `dist/npm/renview-${target}`;
  mkdirSync(`${dir}/bin`, { recursive: true });

  copyFileSync(info.distFile, `${dir}/bin/${info.binary}`);
  chmodSync(`${dir}/bin/${info.binary}`, 0o755);
  copyFileSync("LICENSE", `${dir}/LICENSE`);
  writeFileSync(
    `${dir}/package.json`,
    JSON.stringify(
      {
        name: `renview-${target}`,
        version,
        description: `renview 的 ${target} 平台二进制（由壳包 renview 按平台引用，请勿直接安装）`,
        license: "MIT",
        os: [info.npmOs],
        cpu: [info.arch],
        // 无 bin 字段：原始二进制无 shebang，npm 会在发布时剔除；postinstall 按固定路径 bin/ 取文件
        repository: REPOSITORY,
      },
      null,
      2,
    ) + "\n",
  );

  // tarball 内是扁平的 renview(.exe) 单文件
  const tarball = `dist/release/renview-${target}.tar.gz`;
  const tar = Bun.spawnSync(["tar", "-czf", tarball, "-C", `${dir}/bin`, info.binary]);
  if (tar.exitCode !== 0) {
    console.error(`tar 打包失败: ${tarball}\n${tar.stderr.toString()}`);
    process.exit(1);
  }
  const sha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  checksums.push(`${sha256}  renview-${target}.tar.gz`);
  console.log(`✓ renview-${target}（npm 包 + tarball）`);
}

// 壳包：optionalDependencies 钉同版本平台包，postinstall 把二进制链接到 bin 桩位
const shellDir = "dist/npm/renview";
mkdirSync(`${shellDir}/bin`, { recursive: true });
writeFileSync(
  `${shellDir}/bin/renview.exe`,
  `#!/usr/bin/env node
// postinstall 未运行时的占位桩：bin 链接先指向这里，postinstall 会把它替换成真正的原生二进制
console.error("renview: the postinstall script did not run, so the binary is missing.");
console.error("Reinstall without --ignore-scripts, or use: curl -fsSL https://renview.6636.tech/install | bash");
process.exit(1);
`,
);
chmodSync(`${shellDir}/bin/renview.exe`, 0o755);
copyFileSync("scripts/npm/postinstall.mjs", `${shellDir}/postinstall.mjs`);
copyFileSync("LICENSE", `${shellDir}/LICENSE`);
writeFileSync(
  `${shellDir}/package.json`,
  JSON.stringify(
    {
      name: "renview",
      version,
      description: pkg.description,
      license: "MIT",
      bin: { renview: "./bin/renview.exe" },
      scripts: { postinstall: "node ./postinstall.mjs" },
      os: ["darwin", "linux", "win32"],
      cpu: ["arm64", "x64"],
      optionalDependencies: Object.fromEntries(built.map((t) => [`renview-${t}`, version])),
      repository: REPOSITORY,
    },
    null,
    2,
  ) + "\n",
);
console.log("✓ renview（壳包）");

writeFileSync("dist/release/checksums.txt", checksums.join("\n") + "\n");
console.log(
  `✓ dist/release/checksums.txt\n\n版本 ${version}，共 ${built.length} 个平台包 + 1 个壳包`,
);
if (built.length < TARGETS.length) {
  console.log(
    `注意：dist/ 中只有 ${built.join(", ")}，未打包全部 ${TARGETS.length} 个目标（本地 --host 冒烟属正常）`,
  );
}
