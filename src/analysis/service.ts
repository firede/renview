import { MAX_SOURCE_BYTES } from "../source";
import { foldDescriber } from "./foldescribe";
import { profileForPath } from "./langs";
import { changedLinesOf, type ParsedFile } from "./map";
import { analyzeParsed, outlineOf, withParsedSides } from "./project";
import { buildSimplifiedRows, simplifyTree } from "./simplify";
import { buildViewRows } from "./view";
import type { FileEntry, FileStatus, ViewerFile } from "./types";
import type { Locale } from "../i18n";

/** 文件过大时保留原始视图，避免昂贵的语法分析。 */
export const MAX_ANALYZE_BYTES = 500_000;

/** 全文不可用时保留路径与降级原因，前端不渲染空白或截断源码。 */
export function unavailableViewerFile(
  path: string,
  degradedReason: "too-large" | "binary",
): ViewerFile {
  return {
    path,
    language: profileForPath(path)?.id ?? null,
    source: null,
    simplified: null,
    view: null,
    outline: [],
    degradedReason,
  };
}

/** 查看器与审阅上下文共用同一套源码分析。 */
export async function viewerFile(
  path: string,
  source: string,
  locale: Locale,
): Promise<ViewerFile> {
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES)
    return unavailableViewerFile(path, "too-large");
  const profile = profileForPath(path);
  const file: ViewerFile = {
    path,
    language: profile?.id ?? null,
    source: null,
    simplified: null,
    view: null,
    outline: [],
  };
  if (source.slice(0, 8192).includes("\0")) {
    file.degradedReason = "binary";
    return file;
  }
  file.source = source;
  if (!profile) {
    file.degradedReason = "no-profile";
    return file;
  }
  if (source.length > MAX_ANALYZE_BYTES) {
    file.degradedReason = "too-large";
    return file;
  }
  try {
    await withParsedSides(profile, null, source, (_, side) => {
      if (side!.tree.rootNode.hasError) throw new Error("解析失败");
      file.outline = outlineOf(profile, side!.tree, locale);
      if (profile.simplify) {
        const r = simplifyTree(side!.tree, source, profile.simplify);
        file.simplified = r.lines;
        file.view = buildViewRows(profile, side!.tree, source, r.lines, locale, r.erasures);
      }
    });
  } catch {
    file.degradedReason = "parse-error";
  }
  return file;
}

export async function analyzeFile(
  f: ParsedFile,
  oldSource: string | null,
  newSource: string | null,
  locale: Locale,
): Promise<FileEntry> {
  const oldPath = f.from === "/dev/null" ? null : f.from;
  const newPath = f.to === "/dev/null" ? null : f.to;
  const status: FileStatus = !oldPath
    ? "add"
    : !newPath
      ? "delete"
      : oldPath !== newPath
        ? "rename"
        : "modify";
  const entry: FileEntry = { oldPath, newPath, status, projection: null };

  const profile = profileForPath(newPath ?? oldPath ?? "");
  if (!profile) {
    entry.degradedReason = "no-profile";
    return entry;
  }

  try {
    if (oldSource == null && newSource == null) {
      entry.degradedReason = "no-source";
      return entry;
    }
    if (
      (oldSource?.length ?? 0) > MAX_ANALYZE_BYTES ||
      (newSource?.length ?? 0) > MAX_ANALYZE_BYTES
    ) {
      entry.degradedReason = "too-large";
      return entry;
    }
    const { oldLines, newLines } = changedLinesOf(f);
    // 每侧只 parse 一次：投影与简化共用同一棵 CST
    await withParsedSides(profile, oldSource, newSource, (oldSide, newSide) => {
      entry.projection = analyzeParsed(profile, oldSide, newSide, oldLines, newLines, locale);
      if (profile.simplify) {
        entry.simplified = buildSimplifiedRows(
          f,
          oldSide ? simplifyTree(oldSide.tree, oldSide.source, profile.simplify) : null,
          newSide ? simplifyTree(newSide.tree, newSide.source, profile.simplify) : null,
          foldDescriber(profile, oldSide, newSide, locale),
        );
      }
    });
  } catch {
    entry.degradedReason = "parse-error";
  }
  return entry;
}
