import parseDiff from "parse-diff";
import { profileForPath } from "./analysis/langs";
import { changedLinesOf, type ParsedFile } from "./analysis/map";
import { analyzeParsed, parseSide } from "./analysis/project";
import { buildSimplifiedRows, simplifyTree } from "./analysis/simplify";
import type { FileEntry, FileStatus } from "./analysis/types";
import {
  extractPathspecs,
  getDiff,
  getSideContent,
  getUntrackedDiff,
  resolveDiffArgs,
  resolveSides,
} from "./git";
import { webAssets } from "./webassets.gen";

export interface ServerOptions {
  port?: number;
}

/** 超过该大小的文件不做投影分析，直接退回原始 diff */
const MAX_ANALYZE_BYTES = 500_000;

export async function startServer(root: string, gitArgs: string[], opts: ServerOptions) {
  const diffArgs = await resolveDiffArgs(root, gitArgs);
  return Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/diff") return handleDiff(root, diffArgs);
      return serveStatic(url.pathname);
    },
  });
}

async function handleDiff(root: string, diffArgs: string[]): Promise<Response> {
  try {
    const pathspecs = extractPathspecs(diffArgs);
    const [diff, untracked, sides] = await Promise.all([
      getDiff(root, diffArgs),
      getUntrackedDiff(root, pathspecs),
      resolveSides(root, diffArgs),
    ]);
    const fullDiff = diff + untracked;
    const files = await Promise.all(
      parseDiff(fullDiff).map((f) => buildFileEntry(root, sides, f as unknown as ParsedFile)),
    );
    return Response.json({
      ok: true,
      repoRoot: root,
      diffArgs,
      diff: fullDiff,
      files,
      generatedAt: Date.now(),
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

async function buildFileEntry(
  root: string,
  sides: Awaited<ReturnType<typeof resolveSides>>,
  f: ParsedFile,
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
    const [oldSource, newSource] = await Promise.all([
      oldPath ? getSideContent(root, sides.oldSide, oldPath) : null,
      newPath ? getSideContent(root, sides.newSide, newPath) : null,
    ]);
    if (oldSource == null && newSource == null) {
      entry.degradedReason = "no-source";
      return entry;
    }
    if ((oldSource?.length ?? 0) > MAX_ANALYZE_BYTES || (newSource?.length ?? 0) > MAX_ANALYZE_BYTES) {
      entry.degradedReason = "too-large";
      return entry;
    }
    const { oldLines, newLines } = changedLinesOf(f);
    // 每侧只 parse 一次：投影与简化共用同一棵 CST
    const [oldSide, newSide] = await Promise.all([
      oldSource != null ? parseSide(profile, oldSource) : null,
      newSource != null ? parseSide(profile, newSource) : null,
    ]);
    entry.projection = analyzeParsed(profile, oldSide, newSide, oldLines, newLines);
    if (profile.simplify) {
      entry.simplified = buildSimplifiedRows(
        f,
        oldSide ? simplifyTree(oldSide.tree, oldSide.source, profile.simplify) : null,
        newSide ? simplifyTree(newSide.tree, newSide.source, profile.simplify) : null,
      );
    }
  } catch {
    entry.degradedReason = "parse-error";
  }
  return entry;
}

function serveStatic(pathname: string): Response {
  const entry =
    webAssets[pathname] ?? (/\.[^/]+$/.test(pathname) ? undefined : webAssets["/index.html"]);
  if (!entry) return new Response("Not Found", { status: 404 });
  return new Response(Bun.file(entry.file), { headers: { "Content-Type": entry.type } });
}
