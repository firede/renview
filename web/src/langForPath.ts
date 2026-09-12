/** 文件名/扩展名 → shiki 语言映射（纯数据，无运行时副作用；highlight.tsx 与 scripts/gen-demo.ts 共用） */

/** 扩展名 → shiki 语言（有 profile 的语言 + 无简化规则但值得高亮的常见格式） */
const EXT_LANG: Record<string, string> = {
  swift: "swift",
  swiftinterface: "swift",
  m: "objective-c",
  mm: "objective-cpp",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hh: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  metal: "cpp",
  plist: "xml",
  entitlements: "xml",
  xcprivacy: "xml",
  stringsdict: "xml",
  storyboard: "xml",
  xib: "xml",
  xcscheme: "xml",
  xcworkspacedata: "xml",
  xccheckout: "xml",
  xcstrings: "json",
  xctestplan: "json",
  pbxproj: "openstep",
  strings: "apple-strings",
  xcconfig: "xcconfig",
  podspec: "ruby",
  rb: "ruby",
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
  java: "java",
  xml: "xml",
  xsd: "xml",
  xsl: "xml",
  xslt: "xml",
  fxml: "xml",
  pom: "xml",
  gradle: "groovy",
  groovy: "groovy",
  kt: "kotlin",
  kts: "kotlin",
  properties: "properties",
  dockerfile: "docker",
  sql: "sql",
  sh: "bash",
  bat: "batch",
  cmd: "batch",
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
  "Package.resolved": "json",
  "Podfile.lock": "yaml",
  Podfile: "ruby",
  Gemfile: "ruby",
  Fastfile: "ruby",
  Appfile: "ruby",
  Matchfile: "ruby",
  Deliverfile: "ruby",
  Scanfile: "ruby",
  Snapfile: "ruby",
  ".gitignore": "bash",
  ".gitattributes": "bash",
  ".dockerignore": "bash",
  gradlew: "bash",
  mvnw: "bash",
};

/** 按文件名/扩展名映射 shiki 语言；无映射返回 null（不高亮，纯文本渲染） */
export function shikiLangForPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = path.split("/").pop()!;
  const byName = FILENAME_LANG[base];
  if (byName) return byName;
  if (/^dockerfile(?:\..+)?$/i.test(base)) return "docker";
  const m = /\.([^.]+)$/.exec(base);
  return m ? (EXT_LANG[m[1]!.toLowerCase()] ?? null) : null;
}

/** 只修正有歧义的候选语法；缺少完整上下文时保留路径默认值。 */
export function resolveHighlightLanguage(lang: string, source: string): string {
  if (lang === "c") {
    const objc = /@(interface|implementation|protocol|class|property|end)\b/.test(source);
    const cpp = /\b(namespace|template)\s*[<{\w]|\bstd::/.test(source);
    if (objc) return cpp ? "objective-cpp" : "objective-c";
    if (cpp) return "cpp";
  }
  if (
    (lang === "xml" || lang === "apple-strings") &&
    /^\s*(?:<\?xml\b|<!DOCTYPE\s+plist|<plist\b)/.test(source)
  )
    return "xml";
  if (lang === "xml" && /^\s*(?:\/\*[\s\S]*?\*\/\s*)*[{(]/.test(source)) return "openstep";
  return lang;
}
