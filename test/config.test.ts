import { afterAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import { join } from "node:path";
import {
  configPath,
  createConfigLoader,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  parseConfigText,
} from "../src/config";

const tmpdirs: string[] = [];

function makeTmp(): string {
  const dir = fs.mkdtempSync(join(os.tmpdir(), "renview-config-test-"));
  tmpdirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const d of tmpdirs) fs.rmSync(d, { recursive: true, force: true });
});

describe("parseConfigText", () => {
  test("空配置返回全默认值且无警告", () => {
    const { config, warnings } = parseConfigText("");
    expect(config.font.family).toBe(DEFAULT_FONT_FAMILY);
    expect(config.font.size).toBe(DEFAULT_FONT_SIZE);
    expect(config.updateCheck).toBe(true);
    expect(config.theme).toBe("auto");
    expect(warnings).toEqual([]);
  });

  test("update_check = false 关闭更新提示", () => {
    const { config, warnings } = parseConfigText(`update_check = false`);
    expect(config.updateCheck).toBe(false);
    expect(warnings).toEqual([]);
  });

  test("update_check 非布尔回退默认并警告", () => {
    const { config, warnings } = parseConfigText(`update_check = "no"`);
    expect(config.updateCheck).toBe(true);
    expect(warnings).toHaveLength(1);
  });

  test("font_family 加引号后拼在内置系统栈前", () => {
    const { config, warnings } = parseConfigText(`font_family = "JetBrains Mono"`);
    expect(config.font.family).toBe(`"JetBrains Mono", ${DEFAULT_FONT_FAMILY}`);
    expect(warnings).toEqual([]);
  });

  test("font_family 支持逗号分隔的字体列表", () => {
    const { config } = parseConfigText(`font_family = "JetBrains Mono, Sarasa Mono SC"`);
    expect(config.font.family).toBe(`"JetBrains Mono", "Sarasa Mono SC", ${DEFAULT_FONT_FAMILY}`);
  });

  test("font_family 剥离引号与反斜杠，防 CSS 注入", () => {
    const { config } = parseConfigText(`font_family = 'Bad"Name\\\\x'`);
    expect(config.font.family).toBe(`"BadNamex", ${DEFAULT_FONT_FAMILY}`);
  });

  test("font_size 生效", () => {
    const { config, warnings } = parseConfigText(`font_size = 14`);
    expect(config.font.size).toBe(14);
    expect(warnings).toEqual([]);
  });

  test("键类型错误回退默认并产生警告", () => {
    const { config, warnings } = parseConfigText(`font_family = 42\nfont_size = "大"`);
    expect(config.font.family).toBe(DEFAULT_FONT_FAMILY);
    expect(config.font.size).toBe(DEFAULT_FONT_SIZE);
    expect(warnings).toHaveLength(2);
  });

  test("font_size 非正数回退默认并警告", () => {
    const { config, warnings } = parseConfigText(`font_size = 0`);
    expect(config.font.size).toBe(DEFAULT_FONT_SIZE);
    expect(warnings).toHaveLength(1);
  });

  test("TOML 语法错误整体回退默认并警告", () => {
    const { config, warnings } = parseConfigText(`font_family = "未闭合`);
    expect(config.font.family).toBe(DEFAULT_FONT_FAMILY);
    expect(warnings).toHaveLength(1);
  });

  test("未知键静默忽略（新旧版本互读不报错）", () => {
    const { config, warnings } = parseConfigText(`appearance = "light"\n[llm]\nprovider = "kimi"`);
    expect(config.font.size).toBe(DEFAULT_FONT_SIZE);
    expect(warnings).toEqual([]);
  });

  test("theme 生效：dark / light", () => {
    expect(parseConfigText(`theme = "dark"`).config.theme).toBe("dark");
    expect(parseConfigText(`theme = "light"`).config.theme).toBe("light");
  });

  test("theme 非法值回退 auto 并警告", () => {
    for (const raw of [`theme = "night"`, `theme = 42`]) {
      const { config, warnings } = parseConfigText(raw);
      expect(config.theme).toBe("auto");
      expect(warnings).toHaveLength(1);
    }
  });
});

describe("language 配置", () => {
  test("language 配置接入语言匹配", () => {
    const { config, warnings } = parseConfigText(`language = "en-US"`, {});
    expect(config.language).toBe("en");
    expect(warnings).toEqual([]);
  });

  test("未设置时按环境检测", () => {
    expect(parseConfigText("", { LANG: "zh_CN.UTF-8" }).config.language).toBe("zh-CN");
    expect(parseConfigText("", { LANG: "en_US.UTF-8" }).config.language).toBe("en");
  });

  test("无法匹配的值视为未设置：警告并走环境检测链", () => {
    const { config, warnings } = parseConfigText(`language = "fr"`, { LANG: "zh_CN.UTF-8" });
    expect(config.language).toBe("zh-CN");
    expect(warnings).toHaveLength(1);
  });

  test("非字符串类型回退检测链并警告", () => {
    const { config, warnings } = parseConfigText(`language = 42`, { LANG: "en_US.UTF-8" });
    expect(config.language).toBe("en");
    expect(warnings).toHaveLength(1);
  });

  test("空串视为未设置，不产生警告", () => {
    const { warnings } = parseConfigText(`language = ""`, { LANG: "en_US.UTF-8" });
    expect(warnings).toEqual([]);
  });
});

describe("createConfigLoader", () => {
  test("配置文件不存在时返回全默认且无警告", async () => {
    const load = createConfigLoader(join(makeTmp(), "nope.toml"));
    const { config, warnings } = await load();
    expect(config.font.size).toBe(DEFAULT_FONT_SIZE);
    expect(warnings).toEqual([]);
  });

  test("内容未变时复用上次结果（引用相等），变化后重新解析", async () => {
    const path = join(makeTmp(), "config.toml");
    fs.writeFileSync(path, `font_size = 13`);
    const load = createConfigLoader(path);

    const first = await load();
    expect(first.config.font.size).toBe(13);
    expect(await load()).toBe(first);

    fs.writeFileSync(path, `font_size = 15`);
    const second = await load();
    expect(second).not.toBe(first);
    expect(second.config.font.size).toBe(15);
  });
});

describe("configPath", () => {
  test("尊重 XDG_CONFIG_HOME", () => {
    expect(configPath({ XDG_CONFIG_HOME: "/tmp/xdg" })).toBe(
      join("/tmp/xdg", "renview", "config.toml"),
    );
  });

  test("默认落 ~/.config/renview/config.toml", () => {
    expect(configPath({})).toBe(join(os.homedir(), ".config", "renview", "config.toml"));
  });
});
