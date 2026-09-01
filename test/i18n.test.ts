import { describe, expect, test } from "bun:test";
import { detectLocale, matchLocale, messages, resolveLocale } from "../src/i18n";

describe("matchLocale", () => {
  test("BCP 47 根语言匹配：忽略地区与文字", () => {
    expect(matchLocale("zh-CN")).toBe("zh-CN");
    expect(matchLocale("zh-TW")).toBe("zh-CN");
    expect(matchLocale("zh-Hans")).toBe("zh-CN");
    expect(matchLocale("en-US")).toBe("en");
    expect(matchLocale("en")).toBe("en");
  });

  test("归一化：编码后缀、修饰符与下划线", () => {
    expect(matchLocale("zh_CN.UTF-8")).toBe("zh-CN");
    expect(matchLocale("en_US.UTF-8@euro")).toBe("en");
  });

  test("不支持与非法输入返回 null", () => {
    expect(matchLocale("fr")).toBeNull();
    expect(matchLocale("fr-FR")).toBeNull();
    expect(matchLocale("C")).toBeNull();
    expect(matchLocale("POSIX")).toBeNull();
    expect(matchLocale("")).toBeNull();
    expect(matchLocale(undefined)).toBeNull();
  });
});

describe("detectLocale", () => {
  test("POSIX 优先级：LC_ALL > LC_MESSAGES > LANG", () => {
    expect(
      detectLocale({ LC_ALL: "zh_CN.UTF-8", LC_MESSAGES: "en_US.UTF-8", LANG: "en_US.UTF-8" }),
    ).toBe("zh-CN");
    expect(detectLocale({ LC_MESSAGES: "en_GB.UTF-8", LANG: "zh_CN.UTF-8" })).toBe("en");
    expect(detectLocale({ LANG: "zh_CN.UTF-8" })).toBe("zh-CN");
  });

  test("空值跳过，继续向下检测", () => {
    expect(detectLocale({ LC_ALL: "", LANG: "zh_CN.UTF-8" })).toBe("zh-CN");
  });

  test("环境变量不命中时用系统 locale，再不行回落英文", () => {
    expect(detectLocale({}, "zh-Hant-TW")).toBe("zh-CN");
    expect(detectLocale({}, "fr-FR")).toBe("en");
    expect(detectLocale({}, null)).toBe("en");
  });
});

describe("resolveLocale", () => {
  test("配置优先；无法匹配或未设置时走环境检测（含英文回落）", () => {
    expect(resolveLocale("zh-TW", {})).toBe("zh-CN");
    expect(resolveLocale("fr", { LANG: "en_US.UTF-8" })).toBe("en");
    expect(resolveLocale(undefined, { LANG: "zh_CN.UTF-8" })).toBe("zh-CN");
  });
});

describe("messages 目录", () => {
  test("分析层摘要串随语言切换", () => {
    expect(messages("zh-CN").analysis.nameList("a, b", 8)).toBe("a, b, …（共 8 个）");
    expect(messages("en").analysis.nameList("a, b", 8)).toBe("a, b, … (8 total)");
    expect(messages("zh-CN").analysis.importsFold("import", 2, ["fmt", "strings"], false)).toBe(
      "import × 2（fmt、strings）",
    );
    expect(messages("en").analysis.importsFold("import", 2, ["fmt", "strings"], false)).toBe(
      "2 imports (fmt, strings)",
    );
  });

  test("英文 imports 摘要的单复数与截断", () => {
    expect(messages("en").analysis.importsFold("import", 1, ["fmt"], false)).toBe("1 import (fmt)");
    expect(messages("en").analysis.importsFold("use", 6, ["a"], true)).toBe("6 uses (a, …)");
  });
});
