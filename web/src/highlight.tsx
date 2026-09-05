import { useEffect, useState, type CSSProperties } from "react";
import type { HunkData, HunkTokens, RenderToken } from "react-diff-view";
import { useTheme, type ResolvedTheme } from "./theme";

import { highlightText, highlightDiff, type HToken } from "./highlight-core";
export { highlightText, highlightDiff, type HToken } from "./highlight-core";
/** 语言映射收敛在 ./langForPath（纯数据模块，scripts/gen-demo.ts 等非浏览器消费方共用） */
import { shikiLangForPath } from "./langForPath";
export { shikiLangForPath };

/** React hook：文本/语言/主题变化时异步高亮；完成前返回 null（调用方先渲染纯文本，完成后替换） */
export function useHighlightedLines(text: string | null, lang: string | null): HToken[][] | null {
  const theme = useTheme();
  const [result, setResult] = useState<{
    text: string;
    lang: string;
    theme: ResolvedTheme;
    tokens: HToken[][] | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (text == null || !lang) return;
    highlightText(text, lang, theme)
      .then((t) => {
        if (!cancelled) setResult({ text, lang, theme, tokens: t });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [text, lang, theme]);
  return result?.text === text && result?.lang === lang && result?.theme === theme
    ? result.tokens
    : null;
}

export function tokenStyle(t: { color?: string; fontStyle?: number }): CSSProperties {
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

/** react-diff-view 的 renderToken：只认我们自产的 shiki 节点，其余交回默认渲染 */
export const renderDiffToken: RenderToken = (token, renderDefault, index) =>
  token.type === "shiki" ? (
    <span key={index} style={tokenStyle({ color: token.color, fontStyle: token.fontStyle })}>
      {token.value}
    </span>
  ) : (
    renderDefault(token, index)
  );

/** 当前选中 diff 文件的高亮 tokens；无语言映射或切走文件时返回 null（纯文本渲染） */
export function useDiffTokens(
  file: { hunks: HunkData[]; newPath: string; oldPath: string } | null,
): HunkTokens | null {
  const theme = useTheme();
  const [result, setResult] = useState<{
    file: typeof file;
    theme: ResolvedTheme;
    tokens: HunkTokens;
  } | null>(null);
  const path = file ? (file.newPath !== "/dev/null" ? file.newPath : file.oldPath) : null;
  const lang = shikiLangForPath(path);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (file && lang) {
      highlightDiff(file.hunks, lang, theme)
        .then((t) => {
          if (!cancelled) setResult({ file, theme, tokens: t });
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [file, lang, theme]);
  return result?.file === file && result?.theme === theme ? result.tokens : null;
}
