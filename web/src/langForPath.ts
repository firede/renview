/** 文件名/扩展名 → shiki 语言映射（纯数据，无运行时副作用；highlight.tsx 与 scripts/gen-demo.ts 共用） */

/** 扩展名 → shiki 语言（有 profile 的语言 + 无简化规则但值得高亮的常见格式） */
export const EXT_LANG: Record<string, string> = {
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
  gdshader: "gdshader",
  gdshaderinc: "gdshader",
  shader: "shaderlab",
  tscn: "gdresource",
  tres: "gdresource",
  godot: "gdresource",
  import: "ini",
  gdextension: "ini",
  gdnlib: "ini",
  gdns: "ini",
  cs: "csharp",
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
  csproj: "xml",
  gradle: "groovy",
  groovy: "groovy",
  kt: "kotlin",
  kts: "kotlin",
  properties: "properties",
  ini: "ini",
  cfg: "ini",
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
  po: "po",
  pot: "po",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
};

/** 按文件名的特殊映射（无扩展名）；ignore 为自研近似语法（langs/ignore.ts），覆盖通配清单与 gitattributes 属性行 */
export const FILENAME_LANG: Record<string, string> = {
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
  ".gitignore": "ignore",
  ".gitattributes": "ignore",
  ".dockerignore": "ignore",
  ".npmignore": "ignore",
  ".eslintignore": "ignore",
  ".prettierignore": "ignore",
  ".ignore": "ignore",
  ".gitmodules": "ini",
  ".editorconfig": "ini",
  gradlew: "bash",
  mvnw: "bash",
};

/** 特殊文件名匹配规则同时用于运行时识别与支持清单。 */
export const FILENAME_PATTERNS = [{ pattern: /^dockerfile(?:\..+)?$/i, language: "docker" }];

/** 按文件名/扩展名映射 shiki 语言；无映射返回 null（不高亮，纯文本渲染） */
export function shikiLangForPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = path.split("/").pop()!;
  const byName = FILENAME_LANG[base];
  if (byName) return byName;
  const byPattern = FILENAME_PATTERNS.find(({ pattern }) => pattern.test(base));
  if (byPattern) return byPattern.language;
  const m = /\.([^.]+)$/.exec(base);
  return m ? (EXT_LANG[m[1]!.toLowerCase()] ?? null) : null;
}

/** 只修正有歧义的候选语法；缺少完整上下文时保留路径默认值。 */
export function resolveHighlightLanguage(lang: string, source: string): string {
  if (lang === "c") {
    const objc = /@(interface|implementation|protocol|class|property|end)\b/.test(source);
    const cpp =
      /\b(namespace|template)\s*[<{\w]|\bstd::|\bclass\s+\w+\s*[{:]|\bextern\s+"C"|\bvirtual\s+~?\w+\s*\(|(?:public|private|protected)\s*:/.test(
        source,
      );
    if (objc) return cpp ? "objective-cpp" : "objective-c";
    if (cpp) return "cpp";
  }
  // .m 同扩展名歧义：无 Objective-C 标记且有 MATLAB 特征（function 定义、% 行注释）时按 matlab 处理
  if (
    lang === "objective-c" &&
    !/@(interface|implementation|protocol|class|property|end|autoreleasepool)\b|#(?:import|include)\b/.test(
      source,
    ) &&
    /(^\s*function\b|^\s*%)/m.test(source)
  )
    return "matlab";
  if (
    (lang === "xml" || lang === "apple-strings") &&
    /^\s*(?:<\?xml\b|<!DOCTYPE\s+plist|<plist\b)/.test(source)
  )
    return "xml";
  if (lang === "xml" && /^\s*(?:\/\*[\s\S]*?\*\/\s*)*[{(]/.test(source)) return "openstep";
  if (lang === "shaderlab" || lang === "gdshader") {
    // 排除注释中的示例；保留字符串，避免把字符串内的斜杠误当注释。
    const code = source.replace(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)/g,
      (part) => (part.startsWith("/") ? part.replace(/[^\r\n]/g, " ") : part),
    );
    // .shader 默认 ShaderLab；出现 Godot 声明时修正语法。
    if (lang === "shaderlab" && /^\s*shader_type\s+\w+/m.test(code)) return "gdshader";
    if (lang === "gdshader" && /(^\s*(?:CGPROGRAM|HLSLPROGRAM)\b|^\s*Shader\s+")/m.test(code))
      return "shaderlab";
  }
  return lang;
}
