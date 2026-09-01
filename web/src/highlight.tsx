import { useEffect, useState, type CSSProperties } from "react";
import { isDelete, isInsert, isNormal, type HunkData, type HunkTokens, type RenderToken, type TokenNode } from "react-diff-view";
import type { HighlighterCore } from "shiki/core";

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
 */
let corePromise: Promise<HighlighterCore> | null = null;
const loadedLangs = new Set<string>();
const THEME = "github-dark-default";

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
};

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

function highlighter(): Promise<HighlighterCore> {
  corePromise ??= (async () => {
    // shiki 核心也动态加载：高亮非首屏必需，不进主 bundle
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
    ]);
    return createHighlighterCore({
      themes: [import("shiki/themes/github-dark-default.mjs")],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return corePromise;
}

/** 高亮整段文本，返回逐行 token；语言不支持时返回 null */
export async function highlightText(text: string, lang: string): Promise<HToken[][] | null> {
  const loader = LANG_LOADERS[lang];
  if (!loader) return null;
  const h = await highlighter();
  if (!loadedLangs.has(lang)) {
    await h.loadLanguage((await loader()).default as never);
    loadedLangs.add(lang);
  }
  const { tokens } = h.codeToTokens(text, { lang: lang as never, theme: THEME });
  return tokens.map((line) =>
    line.map((t) => ({ content: t.content, color: t.color, fontStyle: t.fontStyle })),
  );
}

/** React hook：文本/语言变化时异步高亮；完成前返回 null（调用方先渲染纯文本，完成后替换） */
export function useHighlightedLines(text: string | null, lang: string | null): HToken[][] | null {
  const [tokens, setTokens] = useState<HToken[][] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTokens(null);
    if (text == null || !lang) return;
    highlightText(text, lang)
      .then((t) => {
        if (!cancelled) setTokens(t);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [text, lang]);
  return tokens;
}

export function tokenStyle(t: HToken): CSSProperties {
  const s: CSSProperties = {};
  if (t.color) s.color = t.color;
  if (t.fontStyle) {
    if (t.fontStyle & 1) s.fontStyle = "italic";
    if (t.fontStyle & 2) s.fontWeight = 600;
    if (t.fontStyle & 4) s.textDecoration = "underline";
  }
  return s;
}

/** 渲染一行高亮 token；空行渲染空格保住行高 */
export function TokenSpans({ tokens }: { tokens: HToken[] }) {
  if (tokens.length === 0) return <> </>;
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={tokenStyle(t)}>
          {t.content}
        </span>
      ))}
    </>
  );
}

/* ---- react-diff-view 集成：tokens 按文件行号（1-based）索引，空洞行不高亮 ---- */

function toNodes(line: HToken[]): TokenNode[] {
  return line.map((t) => ({
    type: "shiki",
    value: t.content,
    color: t.color,
    fontStyle: t.fontStyle,
  }));
}

/**
 * 高亮一个文件的 diff：每侧拼出带空洞的伪全文（行号对齐）整体高亮，
 * 再按行号回填为 react-diff-view 的 HunkTokens。
 * 局限：跨 hunk 的多行语法构造（块注释/模板串）在空洞处可能断色，仅影响颜色不影响文本。
 */
export async function highlightDiff(hunks: HunkData[], lang: string): Promise<HunkTokens> {
  const oldByLine = new Map<number, string>();
  const newByLine = new Map<number, string>();
  let oldMax = 0;
  let newMax = 0;
  for (const h of hunks) {
    for (const c of h.changes) {
      if (isNormal(c)) {
        oldByLine.set(c.oldLineNumber, c.content);
        newByLine.set(c.newLineNumber, c.content);
        oldMax = Math.max(oldMax, c.oldLineNumber);
        newMax = Math.max(newMax, c.newLineNumber);
      } else if (isDelete(c)) {
        oldByLine.set(c.lineNumber, c.content);
        oldMax = Math.max(oldMax, c.lineNumber);
      } else if (isInsert(c)) {
        newByLine.set(c.lineNumber, c.content);
        newMax = Math.max(newMax, c.lineNumber);
      }
    }
  }

  const side = async (byLine: Map<number, string>, max: number): Promise<TokenNode[][]> => {
    const out: TokenNode[][] = [];
    if (max === 0) return out;
    const text = Array.from({ length: max }, (_, i) => byLine.get(i + 1) ?? "").join("\n");
    const lines = await highlightText(text, lang);
    if (!lines) return out;
    for (const ln of byLine.keys()) {
      const t = lines[ln - 1];
      if (t) out[ln - 1] = toNodes(t);
    }
    return out;
  };

  const [oldTokens, newTokens] = await Promise.all([
    side(oldByLine, oldMax),
    side(newByLine, newMax),
  ]);
  return { old: oldTokens, new: newTokens };
}

/** react-diff-view 的 renderToken：只认我们自产的 shiki 节点，其余交回默认渲染 */
export const renderDiffToken: RenderToken = (token, renderDefault, index) =>
  token.type === "shiki" ? (
    <span
      key={index}
      style={tokenStyle({ content: token.value, color: token.color, fontStyle: token.fontStyle })}
    >
      {token.value}
    </span>
  ) : (
    renderDefault(token, index)
  );

/** 当前选中 diff 文件的高亮 tokens；无语言映射或切走文件时返回 null（纯文本渲染） */
export function useDiffTokens(file: { hunks: HunkData[]; newPath: string; oldPath: string } | null): HunkTokens | null {
  const [tokens, setTokens] = useState<HunkTokens | null>(null);
  const path = file ? (file.newPath !== "/dev/null" ? file.newPath : file.oldPath) : null;
  const lang = shikiLangForPath(path);
  useEffect(() => {
    let cancelled = false;
    setTokens(null);
    if (file && lang) {
      highlightDiff(file.hunks, lang)
        .then((t) => {
          if (!cancelled) setTokens(t);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [file, lang]);
  return tokens;
}
