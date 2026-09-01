import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";

/** 经校验并与默认值合并后的界面配置，前端可直接应用 */
export interface UiConfig {
  font: {
    /** 完整 CSS font-family 值：用户字体在前，内置系统栈兜底 */
    family: string;
    /** 代码阅读区字号（px） */
    size: number;
  };
}

export interface LoadedConfig {
  config: UiConfig;
  /** 配置问题描述（语法错误 / 类型错误等），供 CLI 呈现；配置问题永不阻塞审阅 */
  warnings: string[];
}

/** 内置代码字体栈，须与 web/src/app.css 的 --font-mono 默认值保持一致 */
export const DEFAULT_FONT_FAMILY =
  'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
export const DEFAULT_FONT_SIZE = 12;

const DEFAULT_CONFIG: UiConfig = {
  font: { family: DEFAULT_FONT_FAMILY, size: DEFAULT_FONT_SIZE },
};

/** 配置文件位置：$XDG_CONFIG_HOME/renview/config.toml；Windows 落 %APPDATA%\renview\config.toml */
export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform === "win32") {
    return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "renview", "config.toml");
  }
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "renview", "config.toml");
}

/** 单个字体名转 CSS font-family 片段：剥离引号/反斜杠/换行后统一加双引号 */
function cssFontName(name: string): string | null {
  const clean = name.replace(/["\\\r\n]/g, "").trim();
  return clean ? `"${clean}"` : null;
}

/** 用户字体（逗号分隔列表）拼在内置系统栈前：字体未安装时自然回落 */
function resolveFontFamily(value: string): string {
  const names = value
    .split(",")
    .map(cssFontName)
    .filter((n): n is string => n != null);
  return names.length ? `${names.join(", ")}, ${DEFAULT_FONT_FAMILY}` : DEFAULT_FONT_FAMILY;
}

/**
 * 解析 TOML 文本并与默认值合并。
 * 语法错误整体回退默认；类型错误逐键回退并产生警告；未知键静默忽略（新旧版本互读不报错）。
 */
export function parseConfigText(raw: string): LoadedConfig {
  let doc: unknown;
  try {
    doc = parseToml(raw);
  } catch (e) {
    return {
      config: DEFAULT_CONFIG,
      warnings: [`TOML 解析失败（${e instanceof Error ? e.message : String(e)}），已使用默认配置`],
    };
  }
  const warnings: string[] = [];
  const config: UiConfig = { font: { ...DEFAULT_CONFIG.font } };
  const d = doc as Record<string, unknown>;

  if ("font_family" in d) {
    if (typeof d.font_family === "string") {
      config.font.family = resolveFontFamily(d.font_family);
    } else {
      warnings.push(`font_family 应为字符串（收到 ${typeof d.font_family}），已使用默认字体`);
    }
  }
  if ("font_size" in d) {
    if (typeof d.font_size === "number" && Number.isFinite(d.font_size) && d.font_size > 0) {
      config.font.size = d.font_size;
    } else {
      warnings.push(
        `font_size 应为正数（收到 ${JSON.stringify(d.font_size)}），已使用默认字号 ${DEFAULT_FONT_SIZE}`,
      );
    }
  }
  return { config, warnings };
}

/**
 * 带缓存的配置加载器：每次调用重新读文件（保存配置后窗口聚焦即生效，无需重启 CLI），
 * 内容未变则复用上次结果（引用相等，调用方据此只在变化时输出警告）。
 */
export function createConfigLoader(path: string): () => Promise<LoadedConfig> {
  let lastRaw: string | null = null;
  let lastResult: LoadedConfig | null = null;
  return async () => {
    let raw: string | null;
    try {
      raw = await Bun.file(path).text();
    } catch {
      raw = null; // 文件不存在或不可读：全默认，不算配置问题
    }
    if (lastResult && raw === lastRaw) return lastResult;
    const result: LoadedConfig =
      raw == null ? { config: DEFAULT_CONFIG, warnings: [] } : parseConfigText(raw);
    lastRaw = raw;
    lastResult = result;
    return result;
  };
}
