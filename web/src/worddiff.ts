/**
 * 词级行内 diff：配对 del/add 行的差异区间（字符列，0-based 半开），供简化视图行内高亮。
 * token 为词与单个标点（空白只作分隔）；差异取 LCS 之外的部分，只隔空白的相邻差异合并为一段。
 */

interface Tok {
  start: number;
  end: number;
  text: string;
}

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  for (const m of s.matchAll(/[\p{L}\p{N}_$]+|[^\s\p{L}\p{N}_$]/gu)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

/** 超长行放弃词级高亮（LCS 为 O(n·m)，行级 diff 场景足够） */
const MAX_TOKENS = 200;

/** 单侧的差异区间序列 */
function diffSide(matched: boolean[], toks: Tok[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let open: Tok | null = null;
  for (let i = 0; i < toks.length; i++) {
    if (matched[i]) {
      open = null;
      continue;
    }
    if (!open) {
      ranges.push([toks[i]!.start, toks[i]!.end]);
      open = toks[i];
    } else {
      // 相邻差异合并（中间隔的空白并入区间，高亮不断裂）
      ranges[ranges.length - 1]![1] = toks[i]!.end;
    }
  }
  return ranges;
}

export interface WordDiff {
  a: Array<[number, number]>;
  b: Array<[number, number]>;
}

/** 求配对行的词级差异区间；无差异或超长返回 null */
export function wordDiffRanges(a: string, b: string): WordDiff | null {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0 || ta.length > MAX_TOKENS || tb.length > MAX_TOKENS) {
    return null;
  }

  // LCS 动态规划（行内 token 数量小）
  const n = ta.length;
  const m = tb.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        ta[i]!.text === tb[j]!.text
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ma = new Array<boolean>(n).fill(false);
  const mb = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (ta[i]!.text === tb[j]!.text) {
      ma[i] = mb[j] = true;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  const ra = diffSide(ma, ta);
  const rb = diffSide(mb, tb);
  if (ra.length === 0 && rb.length === 0) return null;
  return { a: ra, b: rb };
}
