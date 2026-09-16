import { resolveHighlightLanguage } from "./langForPath";
import type { SRow } from "../../src/analysis/types";
import {
  isDelete,
  isInsert,
  isNormal,
  markEdits,
  type HunkData,
  type HunkTokens,
  type TokenNode,
} from "react-diff-view";
import type { HighlighterCore } from "shiki/core";
import type { ResolvedTheme } from "./theme";
import { HIGHLIGHT_POLICY, type HighlightMode } from "./highlight-policy";

/** 一行的高亮 token（shiki 输出精简为渲染所需字段） */
export interface HToken {
  content: string;
  color?: string;
  /** shiki FontStyle 位掩码：1 italic / 2 bold / 4 underline */
  fontStyle?: number;
}

/*
 * shiki 高开销且非首屏必需：核心、主题与各语言语法全部动态 import（按语言懒加载）。
 * 用 JS 正则引擎而非 oniguruma wasm，避开 wasm 嵌入/加载问题。
 * 明暗双主题：主题 JSON 同样懒加载，按当前解析主题取色（主题切换时 hook 重算 token）。
 */
let corePromise: Promise<HighlighterCore> | null = null;
const loadedLangs = new Set<string>();
const loadedThemes = new Set<ResolvedTheme>();

const THEME_NAME: Record<ResolvedTheme, string> = {
  dark: "github-dark-default",
  light: "github-light-default",
};
const THEME_LOADERS: Record<ResolvedTheme, () => Promise<{ default: unknown }>> = {
  dark: () => import("shiki/themes/github-dark-default.mjs"),
  light: () => import("shiki/themes/github-light-default.mjs"),
};

export const LANG_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  swift: () => import("shiki/langs/swift.mjs"),
  "objective-c": () => import("shiki/langs/objective-c.mjs"),
  matlab: () => import("shiki/langs/matlab.mjs"),
  "objective-cpp": () => import("shiki/langs/objective-cpp.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  openstep: () => import("./langs/apple").then((m) => ({ default: m.openstep })),
  "apple-strings": () => import("./langs/apple").then((m) => ({ default: m.strings })),
  xcconfig: () => import("./langs/apple").then((m) => ({ default: m.xcconfig })),
  ignore: () => import("./langs/ignore").then((m) => ({ default: m.ignore })),
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  gdscript: () => import("shiki/langs/gdscript.mjs"),
  gdshader: () => import("shiki/langs/gdshader.mjs"),
  gdresource: () => import("shiki/langs/gdresource.mjs"),
  shaderlab: () => import("shiki/langs/shaderlab.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  groovy: () => import("shiki/langs/groovy.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  properties: () => import("shiki/langs/properties.mjs"),
  ini: () => import("shiki/langs/ini.mjs"),
  docker: () => import("shiki/langs/docker.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  batch: () => import("shiki/langs/batch.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsonc: () => import("shiki/langs/jsonc.mjs"),
  json5: () => import("shiki/langs/json5.mjs"),
  jsonl: () => import("shiki/langs/jsonl.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  po: () => import("shiki/langs/po.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  sass: () => import("shiki/langs/sass.mjs"),
  less: () => import("shiki/langs/less.mjs"),
};

function highlighter(): Promise<HighlighterCore> {
  corePromise ??= (async () => {
    // shiki 核心也动态加载：高亮非首屏必需，不进主 bundle
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return corePromise;
}

/** 高亮整段文本，返回逐行 token；语言不支持时返回 null */
export async function highlightText(
  text: string,
  lang: string,
  theme: ResolvedTheme,
  mode: HighlightMode = "interactive",
): Promise<HToken[][] | null> {
  lang = resolveHighlightLanguage(lang, text);
  const loader = LANG_LOADERS[lang];
  if (!loader) return null;
  const h = await highlighter();
  if (!loadedThemes.has(theme)) {
    await h.loadTheme((await THEME_LOADERS[theme]()).default as never);
    loadedThemes.add(theme);
  }
  if (!loadedLangs.has(lang)) {
    await h.loadLanguage((await loader()).default as never);
    loadedLangs.add(lang);
  }
  const { tokens } = h.codeToTokens(text, {
    lang: lang as never,
    theme: THEME_NAME[theme],
    ...HIGHLIGHT_POLICY[mode],
  });
  return tokens.map((line) =>
    line.map((t) => ({ content: t.content, color: t.color, fontStyle: t.fontStyle })),
  );
}

/** react-diff-view 增强器使用的"路径"：祖先节点 + 文本叶；shiki token 化为 [样式节点, 文本叶] */
type TokenPath = Array<{ type: string; [key: string]: unknown }>;

function toPaths(line: HToken[]): TokenPath[] {
  return line.map((t) => [
    { type: "shiki", color: t.color, fontStyle: t.fontStyle },
    { type: "text", value: t.content },
  ]);
}

/** 路径还原为嵌套节点（叶在最内层）；不合并相邻同类节点，渲染按节点递归即可。edit 节点只留类型（行号等定位字段渲染不用） */
function pathToNode(path: TokenPath): TokenNode {
  return path.reduceRight<TokenNode | null>((child, node) => {
    const base = node.type === "edit" ? { type: "edit" } : { ...node };
    return child ? { ...base, children: [child] } : base;
  }, null)!;
}

/** 差异字符占块内文本的比例超过此值即视为整块重写，词级标记只剩噪音 */
const MAX_EDIT_RATIO = 0.5;

/**
 * 去掉整块重写里的词级标记：按 del/add 块统计被标记字符占比，过半则该块两侧都还原为无标记路径。
 * markEdits 把 edit 节点放在路径首位（wrap），据此识别与剥离。
 */
function pruneNoisyEdits(hunks: HunkData[], oldPaths: TokenPath[][], newPaths: TokenPath[][]) {
  const leafLen = (p: TokenPath) => String(p[p.length - 1]!.value ?? "").length;
  for (const h of hunks) {
    let i = 0;
    while (i < h.changes.length) {
      if (isNormal(h.changes[i]!)) {
        i++;
        continue;
      }
      const oldLns: number[] = [];
      const newLns: number[] = [];
      while (i < h.changes.length && !isNormal(h.changes[i]!)) {
        const c = h.changes[i]!;
        if (isDelete(c)) oldLns.push(c.lineNumber);
        else if (isInsert(c)) newLns.push(c.lineNumber);
        i++;
      }
      let edited = 0;
      let total = 0;
      const visit = (paths: TokenPath[][], lns: number[]) => {
        for (const ln of lns) {
          for (const p of paths[ln - 1] ?? []) {
            const n = leafLen(p);
            total += n;
            if (p[0]!.type === "edit") edited += n;
          }
        }
      };
      visit(oldPaths, oldLns);
      visit(newPaths, newLns);
      if (total === 0 || edited / total <= MAX_EDIT_RATIO) continue;
      const strip = (paths: TokenPath[][], lns: number[]) => {
        for (const ln of lns) {
          const line = paths[ln - 1];
          if (line) paths[ln - 1] = line.map((p) => p.filter((n) => n.type !== "edit"));
        }
      };
      strip(oldPaths, oldLns);
      strip(newPaths, newLns);
    }
  }
}

/**
 * 高亮一个文件的 diff：每侧按连续行分段高亮，再回填到原始行号，并标记 del/add 块内的词级差异。
 * 成本随 diff 内容增长，而非末尾行号；百万行文件尾部的小改动也不分配百万个空行。
 * lang 为 null 时不做语法高亮，只保留词级差异标记。
 * 局限：hunk 外缺失的语法上下文可能导致断色，仅影响颜色不影响文本。
 */
export async function highlightDiff(
  hunks: HunkData[],
  lang: string | null,
  theme: ResolvedTheme,
  mode: HighlightMode = "interactive",
): Promise<HunkTokens> {
  const oldByLine = new Map<number, string>();
  const newByLine = new Map<number, string>();
  for (const h of hunks) {
    for (const c of h.changes) {
      if (isNormal(c)) {
        oldByLine.set(c.oldLineNumber, c.content);
        newByLine.set(c.newLineNumber, c.content);
      } else if (isDelete(c)) {
        oldByLine.set(c.lineNumber, c.content);
      } else if (isInsert(c)) {
        newByLine.set(c.lineNumber, c.content);
      }
    }
  }

  const side = async (byLine: Map<number, string>): Promise<TokenPath[][]> => {
    const lines = lang ? await highlightSparseLines(byLine, lang, theme, mode) : [];
    const out: TokenPath[][] = [];
    // 无高亮结果的行退化为纯文本路径，词级标记不依赖语法高亮是否可用
    for (const [ln, content] of byLine) {
      const toks = lines[ln - 1];
      out[ln - 1] = toks ? toPaths(toks) : [[{ type: "text", value: content }]];
    }
    return out;
  };

  const [oldPaths, newPaths] = markEdits(hunks, { type: "block" })(
    await Promise.all([side(oldByLine), side(newByLine)]),
  );
  pruneNoisyEdits(hunks, oldPaths, newPaths);
  const toNodes = (lines: TokenPath[][]): TokenNode[][] => {
    const out: TokenNode[][] = [];
    lines.forEach((paths, i) => {
      out[i] = paths.map(pathToNode);
    });
    return out;
  };
  return { old: toNodes(oldPaths), new: toNodes(newPaths) };
}

/** 按原始行号高亮连续片段，缺口处重置语法状态。 */
export async function highlightSparseLines(
  byLine: Map<number, string>,
  lang: string,
  theme: ResolvedTheme,
  mode: HighlightMode = "interactive",
): Promise<HToken[][]> {
  const out: HToken[][] = [];
  const entries = [...byLine].sort(([a], [b]) => a - b);
  for (let start = 0; start < entries.length;) {
    let end = start + 1;
    while (end < entries.length && entries[end]![0] === entries[end - 1]![0] + 1) end++;
    const text = entries
      .slice(start, end)
      .map(([, content]) => content)
      .join("\n");
    const lines = await highlightText(text, lang, theme, mode);
    if (!lines) return out;
    for (let i = start; i < end; i++) {
      const t = lines[i - start];
      if (t) out[entries[i]![0] - 1] = t;
    }
    start = end;
  }
  return out;
}

/** 简化视图按原始行号拆分两侧，折叠内容不参与可见行高亮。 */
export async function highlightSimplifiedRows(
  rows: SRow[],
  lang: string,
  theme: ResolvedTheme,
  mode: HighlightMode = "interactive",
) {
  const oldLines = new Map<number, string>();
  const newLines = new Map<number, string>();
  for (const row of rows) {
    if (row.kind === "fold") continue;
    if (row.oldLn != null) oldLines.set(row.oldLn, row.text);
    if (row.newLn != null) newLines.set(row.newLn, row.text);
  }
  const [old, next] = await Promise.all([
    highlightSparseLines(oldLines, lang, theme, mode),
    highlightSparseLines(newLines, lang, theme, mode),
  ]);
  return { old, new: next };
}
