/** 交叉编译各平台单文件二进制；--host 只编译当前平台（本地冒烟用） */

const TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-windows-x64",
  "bun-windows-arm64",
] as const;

function hostTarget(): (typeof TARGETS)[number] {
  const p =
    process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
  const a = process.arch === "arm64" ? "arm64" : "x64";
  return `bun-${p}-${a}` as (typeof TARGETS)[number];
}

const onlyHost = process.argv.includes("--host");
const targets = onlyHost ? [hostTarget()] : TARGETS;

for (const target of targets) {
  const name = target.replace("bun-", "");
  const outfile = `dist/renview-${name}${name.startsWith("windows") ? ".exe" : ""}`;
  const result = await Bun.build({
    entrypoints: ["./src/cli.ts"],
    compile: { target, outfile },
    minify: true,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
  console.log(`✓ ${outfile}`);
}
