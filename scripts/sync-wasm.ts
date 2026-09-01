import { $ } from "bun";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";

/** 把 node_modules 里的 tree-sitter wasm 复制到 wasm/，供源码以固定路径内嵌（编译进二进制） */

const MAP: Record<string, string> = {
  "node_modules/web-tree-sitter/web-tree-sitter.wasm": "wasm/tree-sitter.wasm",
  "node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm": "wasm/typescript.wasm",
  "node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm": "wasm/tsx.wasm",
  "node_modules/tree-sitter-rust/tree-sitter-rust.wasm": "wasm/rust.wasm",
  "node_modules/tree-sitter-go/tree-sitter-go.wasm": "wasm/go.wasm",
};

mkdirSync("wasm", { recursive: true });
for (const [src, dst] of Object.entries(MAP)) {
  copyFileSync(src, dst);
  console.log(`${src} -> ${dst}`);
}

/**
 * tree-sitter-gdscript 的 npm 包不附带 wasm（只有 parser.c 源码），
 * 用 docker（emscripten/emsdk）+ tree-sitter CLI 从 grammar 源码构建；已存在则跳过。
 */
async function syncGdscript(): Promise<void> {
  const dst = "wasm/gdscript.wasm";
  if (existsSync(dst)) {
    console.log(`${dst} 已存在，跳过构建`);
    return;
  }
  const buildDir = ".wasm-build/gdscript";
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  for (const f of ["grammar.js", "tree-sitter.json", "src"]) {
    cpSync(`node_modules/tree-sitter-gdscript/${f}`, `${buildDir}/${f}`, { recursive: true });
  }
  // CLI 版本与 package.json devDependencies 的 tree-sitter-cli 保持一致
  const cmd = "npm i --no-save --silent tree-sitter-cli@0.25.10 && npx tree-sitter build --wasm .";
  console.log("构建 tree-sitter-gdscript wasm（docker + emscripten，首次需拉取镜像）…");
  const r =
    await $`docker run --rm -v ${process.cwd()}/${buildDir}:/work -w /work emscripten/emsdk:3.1.74 bash -lc ${cmd}`
      .quiet()
      .nothrow();
  if (r.exitCode !== 0) {
    console.error(`gdscript wasm 构建失败（需要可用的 docker）：\n${r.stderr.toString()}`);
    process.exit(1);
  }
  const built = readdirSync(buildDir).find((f) => f.endsWith(".wasm"));
  if (!built) {
    console.error("构建未产生 wasm 产物");
    process.exit(1);
  }
  copyFileSync(`${buildDir}/${built}`, dst);
  rmSync(".wasm-build", { recursive: true, force: true });
  console.log(`${buildDir}/${built} -> ${dst}`);
}

await syncGdscript();
