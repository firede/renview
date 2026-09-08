/** 样例经产品分析入口生成静态接口数据，官网只接入共用查看器，不再生成另一套行/图标模型。 */
import { readFileSync, writeFileSync } from "node:fs";
import { $ } from "bun";
import parseDiff from "parse-diff";
import { parse as parseToml } from "smol-toml";
import { loadChangeset } from "./samples";
import { analyzeFile, viewerFile } from "../src/analysis/service";
import type { ParsedFile } from "../src/analysis/map";
import type { DemoChangeset } from "../web/src/demo-data";
import type { Locale } from "../src/i18n";

const DIR = "samples/demo";
const OUTPUT = "www/src/lib/demo-data.gen.ts";

export async function generateDemoData(): Promise<Record<Locale, DemoChangeset>> {
  const manifest = parseToml(readFileSync(`${DIR}/changeset.toml`, "utf8")) as {
    order: string[];
    featured: string;
  };
  const entries = loadChangeset(DIR).sort(
    (a, b) => manifest.order.indexOf(a.path) - manifest.order.indexOf(b.path),
  );
  const samples = await Promise.all(
    entries.map(async (entry) => {
      const result =
        await $`git diff --no-index -- ${entry.baseFile ?? "/dev/null"} ${entry.currentFile ?? "/dev/null"}`
          .quiet()
          .nothrow();
      if (result.exitCode > 1) throw new Error(`样例 diff 失败：${entry.path}`);
      // 只规范文件头；正文与 hunk 保留 Git 的原始输出。
      const raw = result.stdout.toString();
      const diff = raw
        .split("\n")
        .map((line) =>
          line.startsWith("diff --git ")
            ? `diff --git a/${entry.path} b/${entry.path}`
            : line.startsWith("--- ")
              ? `--- ${entry.baseFile ? `a/${entry.path}` : "/dev/null"}`
              : line.startsWith("+++ ")
                ? `+++ ${entry.currentFile ? `b/${entry.path}` : "/dev/null"}`
                : line,
        )
        .join("\n");
      return {
        path: entry.path,
        diff,
        parsed: (parseDiff(diff) as unknown as ParsedFile[])[0],
        oldSource: entry.baseFile ? readFileSync(entry.baseFile, "utf8") : null,
        newSource: entry.currentFile ? readFileSync(entry.currentFile, "utf8") : null,
      };
    }),
  );
  const diff = samples.map((s) => s.diff).join("");
  const result = {} as Record<Locale, DemoChangeset>;
  for (const locale of ["zh-CN", "en"] as const) {
    const reviews: DemoChangeset["reviews"] = {};
    for (const sample of samples) {
      const entry = await analyzeFile(sample.parsed, sample.oldSource, sample.newSource, locale);
      if (entry.degradedReason) throw new Error(`样例分析退化：${sample.path}`);
      reviews[sample.path] = {
        ok: true,
        diff,
        snapshot: "demo",
        entry,
        oldFile:
          sample.oldSource === null
            ? null
            : await viewerFile(sample.path, sample.oldSource, locale),
        newFile:
          sample.newSource === null
            ? null
            : await viewerFile(sample.path, sample.newSource, locale),
      };
    }
    result[locale] = {
      diff: {
        ok: true,
        diff,
        snapshot: "demo",
        repoRoot: "samples/demo",
        diffArgs: [],
        files: samples.map((s) => reviews[s.path].entry),
      },
      reviews,
    };
  }
  return result;
}

export async function generateDemoModule(): Promise<string> {
  return `// 由 bun run gen:demo 生成；test/samples.test.ts 校验与产品分析结果一致。\nimport type { DemoChangeset } from "../../../web/src/demo-data";\n\nexport const demoData: Record<"zh-CN" | "en", DemoChangeset> = ${JSON.stringify(await generateDemoData(), null, 2)};\n`;
}

if (import.meta.main) {
  writeFileSync(OUTPUT, await generateDemoModule());
  console.log(`已生成 ${OUTPUT}`);
}
