import { $ } from "bun";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import parseDiff from "parse-diff";
import { profileForPath } from "../src/analysis/langs";
import type { LanguageProfile } from "../src/analysis/langs/types";
import { foldDescriber } from "../src/analysis/foldescribe";
import { changedLinesOf, type ParsedFile } from "../src/analysis/map";
import { analyzeParsed, withParsedSides } from "../src/analysis/project";
import {
  buildSimplifiedRows,
  simplifyTree,
  type SimplifiedViewData,
  type SimplifyResult,
} from "../src/analysis/simplify";
import type { FileProjection } from "../src/analysis/types";
import type { Locale } from "../src/i18n";

/**
 * samples/ 策展样例读取器：把变更集目录解析为各文件的真实管线产物
 * （投影 + 简化 diff 行）。test/samples.test.ts 与 scripts/gen-demo.ts 共用，
 * 保证"测试锁定的叙事"与"www 演示渲染的数据"同出一路。
 *
 * 目录约定：`*.base.<ext>` 与同名文件成对表示修改；仅 .base 表示删除；
 * 仅普通文件表示新增；changeset.toml 记 featured/order 叙事元数据。
 */

const BASE_INFIX = ".base.";

export interface SampleEntry {
  /** 展示路径（相对变更集根，去掉 .base 中缀） */
  path: string;
  baseFile?: string;
  currentFile?: string;
}

export function loadChangeset(dir: string): SampleEntry[] {
  const entries = new Map<string, SampleEntry>();
  for (const rel of readdirSync(dir, { recursive: true }) as string[]) {
    const full = join(dir, rel);
    if (!statSync(full).isFile() || rel.endsWith(".toml")) continue;
    const isBase = rel.includes(BASE_INFIX);
    const path = isBase ? rel.replace(BASE_INFIX, ".") : rel;
    const entry = entries.get(path) ?? { path };
    if (isBase) entry.baseFile = full;
    else entry.currentFile = full;
    entries.set(path, entry);
  }
  return [...entries.values()];
}

export interface AnalyzedEntry {
  entry: SampleEntry;
  profile: LanguageProfile;
  oldSrc: string | null;
  newSrc: string | null;
  diffFile: ParsedFile;
  projection: FileProjection;
  simplified: SimplifiedViewData | null;
  /** 每侧的简化结果（演示数据生成做行内高亮要对齐简化文本） */
  oldSimplified: SimplifyResult | null;
  newSimplified: SimplifyResult | null;
}

/** 用真实管线分析一个样例文件（与 server.ts 的单文件流程同构） */
export async function analyzeEntry(
  entry: SampleEntry,
  locale: Locale = "zh-CN",
): Promise<AnalyzedEntry> {
  const profile = profileForPath(entry.path);
  if (!profile) throw new Error(`样例无语言 profile：${entry.path}`);
  const oldSrc = entry.baseFile ? readFileSync(entry.baseFile, "utf8") : null;
  const newSrc = entry.currentFile ? readFileSync(entry.currentFile, "utf8") : null;
  if (oldSrc == null && newSrc == null) throw new Error(`样例两侧皆空：${entry.path}`);

  // 修改型对两文件 diff；新增/删除与 /dev/null diff，变更行集一律来自真实 diff
  const diff = await $`git diff --no-index -- ${entry.baseFile ?? "/dev/null"} ${
    entry.currentFile ?? "/dev/null"
  }`
    .quiet()
    .nothrow();
  const diffFile = (parseDiff(diff.stdout.toString()) as unknown as ParsedFile[])[0]!;
  const { oldLines, newLines } = changedLinesOf(diffFile);

  return withParsedSides(profile, oldSrc, newSrc, (oldSide, newSide) => {
    for (const side of [oldSide, newSide]) {
      if (side?.tree.rootNode.hasError) throw new Error(`样例解析出错：${entry.path}`);
    }
    const projection = analyzeParsed(profile, oldSide, newSide, oldLines, newLines, locale);
    const oldSimplified =
      oldSide && profile.simplify
        ? simplifyTree(oldSide.tree, oldSide.source, profile.simplify)
        : null;
    const newSimplified =
      newSide && profile.simplify
        ? simplifyTree(newSide.tree, newSide.source, profile.simplify)
        : null;
    const simplified = profile.simplify
      ? buildSimplifiedRows(
          diffFile,
          oldSimplified,
          newSimplified,
          foldDescriber(profile, oldSide, newSide, locale),
        )
      : null;
    return {
      entry,
      profile,
      oldSrc,
      newSrc,
      diffFile,
      projection,
      simplified,
      oldSimplified,
      newSimplified,
    };
  });
}
