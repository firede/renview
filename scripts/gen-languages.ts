import { format } from "oxfmt";
import { languageProfiles, profileForPath } from "../src/analysis/langs";
import { EXT_LANG, FILENAME_LANG, FILENAME_PATTERNS } from "../web/src/langForPath";
import { LANG_LOADERS } from "../web/src/highlight-core";

interface LanguageSupport {
  language: string;
  simplification: boolean;
  highlighting: string | null;
  extensions: string[];
  filenames: string[];
  filenamePatterns: Array<{ regex: string; flags: string }>;
}

/** 按实际高亮语法和简化能力分组，避免将仅高亮的扩展名误报为支持简化。 */
export function languageSupport() {
  const groups = new Map<string, LanguageSupport>();
  const groupFor = (highlighting: string | null, simplification: boolean, language: string) => {
    if (highlighting && !LANG_LOADERS[highlighting]) {
      throw new Error(`缺少高亮加载器：${highlighting}`);
    }
    const key = `${language}/${simplification}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        language,
        simplification,
        highlighting,
        extensions: [],
        filenames: [],
        filenamePatterns: [],
      };
      groups.set(key, group);
    }
    return group;
  };
  const extensions = new Set([
    ...Object.keys(EXT_LANG),
    ...languageProfiles.flatMap((profile) => profile.extensions),
  ]);
  for (const extension of [...extensions].sort()) {
    const profile = profileForPath(`file.${extension}`);
    const highlighting = EXT_LANG[extension] ?? null;
    groupFor(highlighting, !!profile?.simplify, highlighting ?? profile!.id).extensions.push(
      `.${extension}`,
    );
  }
  for (const filename of Object.keys(FILENAME_LANG).sort()) {
    const highlighting = FILENAME_LANG[filename]!;
    groupFor(highlighting, !!profileForPath(filename)?.simplify, highlighting).filenames.push(
      filename,
    );
  }
  for (const { pattern, language } of FILENAME_PATTERNS) {
    groupFor(language, false, language).filenamePatterns.push({
      regex: pattern.source,
      flags: pattern.flags,
    });
  }
  return {
    generatedBy: "bun run gen:languages",
    languages: [...groups.values()].sort((a, b) =>
      a.language < b.language
        ? -1
        : a.language > b.language
          ? 1
          : Number(b.simplification) - Number(a.simplification),
    ),
  };
}

if (import.meta.main) {
  const file = Bun.file(new URL("../languages.json", import.meta.url));
  const formatted = await format("languages.json", JSON.stringify(languageSupport()));
  if (formatted.errors.length) throw new Error("languages.json 格式化失败");
  const output = formatted.code;
  if (process.argv.includes("--check")) {
    if (!(await file.exists()) || (await file.text()) !== output) {
      console.error("languages.json 与语言注册信息不同步，请运行 bun run gen:languages");
      process.exitCode = 1;
    } else {
      console.log("languages.json 与语言注册信息一致");
    }
  } else {
    await Bun.write(file, output);
    console.log("已生成 languages.json");
  }
}
