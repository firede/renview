import {
  isDelete,
  isInsert,
  isNormal,
  type HunkData,
  type HunkTokens,
  type TokenNode,
} from "react-diff-view";
import type { HighlighterCore } from "shiki/core";
import type { ResolvedTheme } from "./theme";

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

const LANG_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  typescript: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  gdscript: () => import("shiki/langs/gdscript.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsonc: () => import("shiki/langs/jsonc.mjs"),
  json5: () => import("shiki/langs/json5.mjs"),
  jsonl: () => import("shiki/langs/jsonl.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
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
): Promise<HToken[][] | null> {
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
  const { tokens } = h.codeToTokens(text, { lang: lang as never, theme: THEME_NAME[theme] });
  return tokens.map((line) =>
    line.map((t) => ({ content: t.content, color: t.color, fontStyle: t.fontStyle })),
  );
}

function toNodes(line: HToken[]): TokenNode[] {
  return line.map((t) => ({
    type: "shiki",
    value: t.content,
    color: t.color,
    fontStyle: t.fontStyle,
  }));
}

/**
 * 高亮一个文件的 diff：每侧只拼接实际 diff 行，再回填到原始行号。
 * 成本随 diff 内容增长，而非末尾行号；百万行文件尾部的小改动也不分配百万个空行。
 * 局限：hunk 外缺失的语法上下文可能导致断色，仅影响颜色不影响文本。
 */
export async function highlightDiff(
  hunks: HunkData[],
  lang: string,
  theme: ResolvedTheme,
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

  const side = async (byLine: Map<number, string>): Promise<TokenNode[][]> => {
    const out: TokenNode[][] = [];
    if (byLine.size === 0) return out;
    const entries = [...byLine];
    const text = entries.map(([, content]) => content).join("\n");
    const lines = await highlightText(text, lang, theme);
    if (!lines) return out;
    for (let i = 0; i < entries.length; i++) {
      const t = lines[i];
      if (t) out[entries[i]![0] - 1] = toNodes(t);
    }
    return out;
  };

  const [oldTokens, newTokens] = await Promise.all([side(oldByLine), side(newByLine)]);
  return { old: oldTokens, new: newTokens };
}
