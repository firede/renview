import { Language, Parser, type Tree } from "web-tree-sitter";
import treeSitterWasm from "../../wasm/tree-sitter.wasm" with { type: "file" };
import typescriptWasm from "../../wasm/typescript.wasm" with { type: "file" };
import tsxWasm from "../../wasm/tsx.wasm" with { type: "file" };
import rustWasm from "../../wasm/rust.wasm" with { type: "file" };
import goWasm from "../../wasm/go.wasm" with { type: "file" };
import gdscriptWasm from "../../wasm/gdscript.wasm" with { type: "file" };
import pythonWasm from "../../wasm/python.wasm" with { type: "file" };

/**
 * tree-sitter 解析层。
 * wasm 一律以 `with { type: "file" }` 嵌入并按字节加载（绕开 bun --compile 的 wasm 路径问题）。
 * wasm/ 目录由 scripts/sync-wasm.ts 从锁定版本的 npm 包复制（gdscript 为 docker 构建）。
 */

const GRAMMAR_WASM: Record<string, string> = {
  typescript: typescriptWasm,
  tsx: tsxWasm,
  rust: rustWasm,
  go: goWasm,
  gdscript: gdscriptWasm,
  python: pythonWasm,
};

let parserReady: Promise<void> | null = null;
const languages = new Map<string, Promise<Language>>();
const parsers = new Map<string, Parser>();

function initParser(): Promise<void> {
  parserReady ??= (async () => {
    const wasmBinary = await Bun.file(treeSitterWasm).arrayBuffer();
    await Parser.init({ wasmBinary });
  })();
  return parserReady;
}

async function loadLanguage(grammar: string): Promise<Language> {
  await initParser();
  let p = languages.get(grammar);
  if (!p) {
    p = (async () => {
      const file = GRAMMAR_WASM[grammar];
      if (!file) throw new Error(`未知语法: ${grammar}`);
      const bytes = new Uint8Array(await Bun.file(file).arrayBuffer());
      return Language.load(bytes);
    })();
    languages.set(grammar, p);
  }
  return p;
}

export async function parseSource(grammar: string, source: string): Promise<Tree> {
  const lang = await loadLanguage(grammar);
  let parser = parsers.get(grammar);
  if (!parser) {
    parser = new Parser();
    parser.setLanguage(lang);
    parsers.set(grammar, parser);
  }
  const tree = parser.parse(source);
  if (!tree) throw new Error("tree-sitter parse 返回 null");
  return tree;
}
