import { resolve, sep } from "node:path";
import parseDiff from "parse-diff";
import { profileForPath } from "./analysis/langs";
import { changedLinesOf, type ParsedFile } from "./analysis/map";
import { analyzeParsed, outlineOf, parseSide } from "./analysis/project";
import { buildSimplifiedRows, simplifyTree } from "./analysis/simplify";
import { buildViewRows } from "./analysis/view";
import type { FileEntry, FileStatus, ViewerFile } from "./analysis/types";
import { configPath, createConfigLoader, type LoadedConfig } from "./config";
import {
  extractPathspecs,
  getDiff,
  getSideContent,
  getUntrackedDiff,
  listFiles,
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

  // 配置每请求重读（窗口聚焦刷新即生效）；引用相等判断只在内容变化时输出警告
  const cfgPath = configPath();
  const getConfig = createConfigLoader(cfgPath);
  let lastConfig: LoadedConfig = await getConfig();
  for (const w of lastConfig.warnings) console.error(`配置 ${cfgPath}: ${w}`);

  async function handleConfig(): Promise<Response> {
    const res = await getConfig();
    if (res !== lastConfig) {
      lastConfig = res;
      for (const w of res.warnings) console.error(`配置 ${cfgPath}: ${w}`);
    }
    return Response.json({ ok: true, path: cfgPath, config: res.config });
  }

  return Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port ?? 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/config") return handleConfig();
      if (url.pathname === "/api/diff") return handleDiff(root, diffArgs);
      if (url.pathname === "/api/files") return handleFiles(root);
      if (url.pathname === "/api/file") return handleFile(root, url.searchParams.get("path"));
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

async function handleFiles(root: string): Promise<Response> {
  try {
    return Response.json({ ok: true, files: await listFiles(root) });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** 查看器路径安全检查：拒绝绝对路径、.. 穿越与 .git，必须落在仓库内 */
function safeRepoPath(root: string, path: string): string | null {
  const parts = path.split(/[\\/]/);
  if (
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    parts.some((p) => p === ".." || p === ".git")
  ) {
    return null;
  }
  const abs = resolve(root, path);
  return abs.startsWith(root + sep) ? abs : null;
}

/** 查看器单文件：worktree 内容 + 一次 parse 产出大纲与简化行 */
async function handleFile(root: string, path: string | null): Promise<Response> {
  if (!path) return Response.json({ ok: false, error: "缺少 path 参数" }, { status: 400 });
  const abs = safeRepoPath(root, path);
  if (!abs) return Response.json({ ok: false, error: "非法路径" }, { status: 400 });

  const f = Bun.file(abs);
  if (!(await f.exists())) {
    return Response.json({ ok: false, error: "文件不存在" }, { status: 404 });
  }

  const file: ViewerFile = {
    path,
    language: null,
    source: null,
    simplified: null,
    view: null,
    outline: [],
  };
  const profile = profileForPath(path);
  file.language = profile?.id ?? null;

  // 头部含 NUL 即视为二进制，不返回内容
  const head = new Uint8Array(await f.slice(0, 8192).arrayBuffer());
  if (head.includes(0)) {
    file.degradedReason = "binary";
    return Response.json({ ok: true, file });
  }

  const source = await f.text();
  file.source = source;
  if (!profile) {
    file.degradedReason = "no-profile";
    return Response.json({ ok: true, file });
  }
  if (source.length > MAX_ANALYZE_BYTES) {
    file.degradedReason = "too-large";
    return Response.json({ ok: true, file });
  }
  try {
    const side = await parseSide(profile, source);
    file.outline = outlineOf(profile, side.tree);
    if (profile.simplify) {
      file.simplified = simplifyTree(side.tree, source, profile.simplify);
      file.view = buildViewRows(profile, side.tree, source, file.simplified);
    }
  } catch {
    file.degradedReason = "parse-error";
  }
  return Response.json({ ok: true, file });
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
