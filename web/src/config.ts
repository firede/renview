/** 服务端 /api/config 返回的界面配置（已与默认值合并，可直接应用） */
export interface UiConfig {
  font: { family: string; size: number };
}

/** 拉取界面配置；失败（服务异常等）返回 null，调用方按未配置处理 */
export async function fetchUiConfig(): Promise<UiConfig | null> {
  try {
    const r = await fetch("/api/config");
    const d = (await r.json()) as { ok: boolean; config?: UiConfig };
    return d.ok && d.config ? d.config : null;
  } catch {
    return null;
  }
}

/** 应用配置到 CSS token（app.css 中 --font-mono / --font-size-code 的覆写点） */
export function applyUiConfig(c: UiConfig | null): void {
  if (!c) return;
  const style = document.documentElement.style;
  style.setProperty("--font-mono", c.font.family);
  style.setProperty("--font-size-code", `${c.font.size}px`);
}
