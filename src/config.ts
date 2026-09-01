import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { detectLocale, matchLocale, messages, resolveLocale, type Locale } from "./i18n";

/** 经校验、解析后的配置，CLI 与前端可直接应用 */
export interface UiConfig {
  font: {
    /** 完整 CSS font-family 值：用户字体在前，内置系统栈兜底 */
    family: string;
    /** 代码阅读区字号（px） */
    size: number;
  };
  /** 界面与输出语言：language 配置项经 BCP 47 根语言匹配；未设置/无法匹配时按环境检测，回落英文 */
  language: Locale;
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

const DEFAULT_FONT = { family: DEFAULT_FONT_FAMILY, size: DEFAULT_FONT_SIZE };

/** 默认配置：字体取内置值；语言随环境检测，故按调用构造 */
function defaultConfig(env: NodeJS.ProcessEnv): UiConfig {
  return { font: { ...DEFAULT_FONT }, language: detectLocale(env) };
}

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
 * 警告文本随解析出的语言：language 键优先，缺失/非法时按环境检测（env 可注入以便测试）。
 */
export function parseConfigText(
  raw: string,
  env: NodeJS.ProcessEnv = process.env,
): LoadedConfig {
  let doc: unknown;
  try {
    doc = parseToml(raw);
  } catch (e) {
    return {
      config: defaultConfig(env),
      warnings: [
        messages(detectLocale(env)).config.tomlParseFailed(
          e instanceof Error ? e.message : String(e),
        ),
      ],
    };
  }
  const d = doc as Record<string, unknown>;

  // 先解析 language 以确定警告语言；无法匹配的值视为未设置（走环境检测链）并警告
  let configured: string | undefined;
  let languageIssue: { kind: "not-string" | "unsupported"; raw: unknown } | null = null;
  if ("language" in d) {
    if (typeof d.language === "string") {
      const v = d.language.trim();
      if (v) {
        if (matchLocale(v)) configured = v;
        else languageIssue = { kind: "unsupported", raw: d.language };
      }
      // 空串视为未设置，不算配置问题
    } else {
      languageIssue = { kind: "not-string", raw: d.language };
    }
  }
  const language = resolveLocale(configured, env);
  const m = messages(language);

  const warnings: string[] = [];
  if (languageIssue?.kind === "not-string") {
    warnings.push(m.config.languageNotString(typeof languageIssue.raw));
  } else if (languageIssue?.kind === "unsupported") {
    warnings.push(m.config.languageUnsupported(languageIssue.raw as string));
  }

  const config: UiConfig = { font: { ...DEFAULT_FONT }, language };
  if ("font_family" in d) {
    if (typeof d.font_family === "string") {
      config.font.family = resolveFontFamily(d.font_family);
    } else {
      warnings.push(m.config.fontFamilyNotString(typeof d.font_family));
    }
  }
  if ("font_size" in d) {
    if (typeof d.font_size === "number" && Number.isFinite(d.font_size) && d.font_size > 0) {
      config.font.size = d.font_size;
    } else {
      warnings.push(
        m.config.fontSizeNotPositive(JSON.stringify(d.font_size), DEFAULT_FONT_SIZE),
      );
    }
  }
  return { config, warnings };
}

/**
 * 带缓存的配置加载器：每次调用重新读文件（保存配置后窗口聚焦即生效，无需重启 CLI），
 * 内容未变则复用上次结果（引用相等，调用方据此只在变化时输出警告）。
 */
export function createConfigLoader(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): () => Promise<LoadedConfig> {
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
      raw == null ? { config: defaultConfig(env), warnings: [] } : parseConfigText(raw, env);
    lastRaw = raw;
    lastResult = result;
    return result;
  };
}
