/** 交互允许超时降级；测试与离线产物必须完整分词，不能随机器速度改变结果。 */
export const HIGHLIGHT_POLICY = {
  interactive: { tokenizeTimeLimit: 500 },
  deterministic: { tokenizeTimeLimit: 0 },
} as const;

export type HighlightMode = keyof typeof HIGHLIGHT_POLICY;
