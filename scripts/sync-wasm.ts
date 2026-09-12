import { createHash } from "node:crypto";
import { $ } from "bun";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";

/** 把 node_modules 里的 tree-sitter wasm 复制到 wasm/，供源码以固定路径内嵌（编译进二进制） */

const MAP: Record<string, string> = {
  "node_modules/web-tree-sitter/web-tree-sitter.wasm": "wasm/tree-sitter.wasm",
  "node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm": "wasm/typescript.wasm",
  "node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm": "wasm/tsx.wasm",
  "node_modules/tree-sitter-rust/tree-sitter-rust.wasm": "wasm/rust.wasm",
  "node_modules/tree-sitter-go/tree-sitter-go.wasm": "wasm/go.wasm",
  "node_modules/tree-sitter-python/tree-sitter-python.wasm": "wasm/python.wasm",
  "node_modules/tree-sitter-java/tree-sitter-java.wasm": "wasm/java.wasm",
};

mkdirSync("wasm", { recursive: true });
for (const [src, dst] of Object.entries(MAP)) {
  copyFileSync(src, dst);
  console.log(`${src} -> ${dst}`);
}

/**
 * gdscript 和 swift 的 npm 包不附带 wasm（只有 parser.c 源码），
 * 用 docker（emscripten/emsdk）+ tree-sitter CLI 构建；Swift 同时校验依赖与构建脚本指纹。
 */
async function buildGrammar(name: string): Promise<void> {
  const dst = `wasm/${name}.wasm`;
  const stamp = `${dst}.build-id`;
  const buildId =
    name === "swift"
      ? createHash("sha256")
          .update(readFileSync(import.meta.path))
          .update(readFileSync(`node_modules/tree-sitter-${name}/package.json`))
          .digest("hex")
      : null;
  if (
    existsSync(dst) &&
    (!buildId || (existsSync(stamp) && readFileSync(stamp, "utf8") === buildId))
  ) {
    console.log(`${dst} 已存在，跳过构建`);
    return;
  }
  const buildDir = `.wasm-build/${name}`;
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  for (const f of ["grammar.js", "tree-sitter.json", "src"]) {
    cpSync(`node_modules/tree-sitter-${name}/${f}`, `${buildDir}/${f}`, { recursive: true });
  }
  if (name === "swift") {
    // 0.7.1 的 scanner 分配了零字节，且空快照未清理 raw string 状态。
    const scannerPath = `${buildDir}/src/scanner.c`;
    const scanner = readFileSync(scannerPath, "utf8")
      .replace("calloc(0, sizeof(struct ScannerState))", "calloc(1, sizeof(struct ScannerState))")
      .replace(
        "if (length < 4) {\n        return;",
        "if (length < 4) {\n        tree_sitter_swift_external_scanner_reset(payload);\n        return;",
      );
    writeFileSync(scannerPath, scanner);
  }
  // CLI 版本与 package.json devDependencies 的 tree-sitter-cli 保持一致
  // 容器内是 root，构建产物在 Linux 宿主机上属 root 所有，chown 回宿主用户以便清理与缓存
  //（macOS/Windows 的 Docker Desktop 本就映射为宿主用户，chown 无害）
  const uid = process.getuid?.() ?? 0;
  const gid = process.getgid?.() ?? 0;
  const generate = name === "swift" ? "npx tree-sitter generate && " : "";
  const cmd = `npm i --no-save --silent tree-sitter-cli@0.25.10 && ${generate}npx tree-sitter build --wasm . && chown -R ${uid}:${gid} /work`;
  console.log(`构建 tree-sitter-${name} wasm（docker + emscripten，首次需拉取镜像）…`);
  const r =
    await $`docker run --rm -v ${process.cwd()}/${buildDir}:/work -w /work emscripten/emsdk:3.1.74 bash -lc ${cmd}`
      .quiet()
      .nothrow();
  if (r.exitCode !== 0) {
    console.error(`${name} wasm 构建失败（需要可用的 docker）：\n${r.stderr.toString()}`);
    process.exit(1);
  }
  const built = readdirSync(buildDir).find((f) => f.endsWith(".wasm"));
  if (!built) {
    console.error("构建未产生 wasm 产物");
    process.exit(1);
  }
  copyFileSync(`${buildDir}/${built}`, dst);
  if (buildId) writeFileSync(stamp, buildId);
  try {
    rmSync(".wasm-build", { recursive: true, force: true });
  } catch {
    // 产物已拷出，清理失败不影响结果（防御非预期的文件属主问题）
    console.warn(".wasm-build 清理失败（不影响产物），可手动删除");
  }
  console.log(`${buildDir}/${built} -> ${dst}`);
}

await buildGrammar("gdscript");
await buildGrammar("swift");
