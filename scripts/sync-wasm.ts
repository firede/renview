import { copyFileSync, mkdirSync } from "node:fs";

/** 把 node_modules 里的 tree-sitter wasm 复制到 wasm/，供源码以固定路径内嵌（编译进二进制） */

const MAP: Record<string, string> = {
  "node_modules/web-tree-sitter/web-tree-sitter.wasm": "wasm/tree-sitter.wasm",
  "node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm": "wasm/typescript.wasm",
  "node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm": "wasm/tsx.wasm",
  "node_modules/tree-sitter-rust/tree-sitter-rust.wasm": "wasm/rust.wasm",
};

mkdirSync("wasm", { recursive: true });
for (const [src, dst] of Object.entries(MAP)) {
  copyFileSync(src, dst);
  console.log(`${src} -> ${dst}`);
}
