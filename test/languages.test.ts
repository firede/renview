import { expect, test } from "bun:test";
import { languageSupport } from "../scripts/gen-languages";
import { shikiLangForPath } from "../web/src/langForPath";

const languages = languageSupport().languages;

test("支持清单区分同语言不同扩展名的简化能力", () => {
  const forExtension = (ext: string) => languages.find((l) => l.extensions.includes(ext));
  expect(forExtension(".swift")?.simplification).toBe(true);
  expect(forExtension(".swiftinterface")?.simplification).toBe(false);
  expect(forExtension(".py")?.simplification).toBe(true);
  expect(forExtension(".pyw")?.simplification).toBe(false);
  expect(forExtension(".js")?.simplification).toBe(true);
  expect(forExtension(".metal")?.highlighting).toBe("cpp");
});

test("清单中的扩展名、文件名与特殊匹配规则反映实际路径识别", () => {
  for (const language of languages) {
    for (const extension of language.extensions) {
      expect(shikiLangForPath(`file${extension}`)).toBe(language.highlighting);
    }
    for (const filename of language.filenames) {
      expect(shikiLangForPath(`src/${filename}`)).toBe(language.highlighting);
    }
  }
  const docker = languages.find((l) => l.highlighting === "docker")!;
  const matches = (name: string) =>
    docker.filenamePatterns.some(({ regex, flags }) => new RegExp(regex, flags).test(name));
  expect(matches("Dockerfile")).toBe(true);
  expect(matches("dockerfile.dev")).toBe(true);
  expect(matches("Dockerfile.")).toBe(false);
  expect(languages.find((l) => l.filenames.includes("Package.resolved"))?.highlighting).toBe(
    "json",
  );
});
