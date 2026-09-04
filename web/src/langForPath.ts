/** 文件名/扩展名 → shiki 语言映射（纯数据，无运行时副作用；highlight.tsx 与 scripts/gen-demo.ts 共用） */

/** 扩展名 → shiki 语言（有 profile 的语言 + 无简化规则但值得高亮的常见格式） */
const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  jsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  rs: "rust",
  go: "go",
  gd: "gdscript",
  py: "python",
  pyi: "python",
  pyw: "python",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  jsonl: "jsonl",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
};

/** 按文件名的特殊映射（无扩展名）；gitignore 类文件无专用语法，用 bash 近似（注释与通配模式均可读） */
const FILENAME_LANG: Record<string, string> = {
  ".gitignore": "bash",
  ".gitattributes": "bash",
  ".dockerignore": "bash",
};

/** 按文件名/扩展名映射 shiki 语言；无映射返回 null（不高亮，纯文本渲染） */
export function shikiLangForPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = path.split("/").pop()!;
  const byName = FILENAME_LANG[base];
  if (byName) return byName;
  const m = /\.([^.]+)$/.exec(base);
  return m ? (EXT_LANG[m[1]!.toLowerCase()] ?? null) : null;
}
