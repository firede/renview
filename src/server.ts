import { resolve, sep } from "node:path";
import parseDiff from "parse-diff";
import { profileForPath } from "./analysis/langs";
import type { ParsedFile } from "./analysis/map";
import { analyzeFile, viewerFile } from "./analysis/service";
import { configPath, createConfigLoader, type LoadedConfig } from "./config";
import { getReviewDiff, getSideContent, listFiles, resolveDiffArgs, resolveSides } from "./git";
import { messages, type Locale } from "./i18n";
import { webAssets } from "./webassets.gen";
import { listenWithPort } from "./port";

export interface ServerOptions {
  port?: number;
}

export async function startServer(root: string, gitArgs: string[], opts: ServerOptions) {
  const diffArgs = await resolveDiffArgs(root, gitArgs);

  // 配置每请求重读（窗口聚焦刷新即生效）；引用相等判断只在内容变化时输出警告
  const cfgPath = configPath();
  const getConfig = createConfigLoader(cfgPath);
  let lastConfig: LoadedConfig = await getConfig();
  for (const w of lastConfig.warnings) {
    console.error(messages(lastConfig.config.language).cli.configWarning(cfgPath, w));
  }

  async function handleConfig(): Promise<Response> {
    const res = await getConfig();
    if (res !== lastConfig) {
      lastConfig = res;
      for (const w of res.warnings) {
        console.error(messages(res.config.language).cli.configWarning(cfgPath, w));
      }
    }
    return Response.json({ ok: true, path: cfgPath, config: res.config });
  }

  return listenWithPort(
    (port) =>
      Bun.serve({
        hostname: "127.0.0.1",
        port,
        async fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === "/api/config") return handleConfig();
          // 数据接口按当次配置解析语言（改 language 保存后聚焦即生效，无需重启）
          if (url.pathname.startsWith("/api/")) {
            const locale = (await getConfig()).config.language;
            if (url.pathname === "/api/diff") return handleDiff(root, diffArgs, locale);
            if (url.pathname === "/api/review-file")
              return handleReviewFile(root, diffArgs, url.searchParams.get("path"), locale);
            if (url.pathname === "/api/files") return handleFiles(root, locale);
            if (url.pathname === "/api/file") {
              return handleFile(root, url.searchParams.get("path"), locale);
            }
          }
          return serveStatic(url.pathname, lastConfig.config.language);
        },
      }),
    opts.port,
  );
}

async function handleDiff(root: string, diffArgs: string[], locale: Locale): Promise<Response> {
  try {
    const { diff: fullDiff, sides } = await getReviewDiff(root, diffArgs, locale);
    const files = await Promise.all(
      parseDiff(fullDiff).map((f) =>
        buildFileEntry(root, sides, f as unknown as ParsedFile, locale),
      ),
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

async function handleFiles(root: string, locale: Locale): Promise<Response> {
  try {
    return Response.json({ ok: true, files: await listFiles(root, locale) });
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
async function handleFile(root: string, path: string | null, locale: Locale): Promise<Response> {
  const m = messages(locale).api;
  if (!path) return Response.json({ ok: false, error: m.missingPath }, { status: 400 });
  const abs = safeRepoPath(root, path);
  if (!abs) return Response.json({ ok: false, error: m.invalidPath }, { status: 400 });

  const f = Bun.file(abs);
  if (!(await f.exists())) {
    return Response.json({ ok: false, error: m.fileNotFound }, { status: 404 });
  }

  const head = new Uint8Array(await f.slice(0, 8192).arrayBuffer());
  return Response.json({
    ok: true,
    file: await viewerFile(path, head.includes(0) ? "\0" : await f.text(), locale),
  });
}

/** 只读取当前 diff 中的路径和版本，避免接受任意 revision 参数。 */
export async function handleReviewFile(
  root: string,
  args: string[],
  path: string | null,
  locale: Locale,
): Promise<Response> {
  const m = messages(locale).api;
  if (!path || !safeRepoPath(root, path))
    return Response.json({ ok: false, error: m.invalidPath }, { status: 400 });
  try {
    const { diff, sides } = await getReviewDiff(root, args, locale);
    const f = parseDiff(diff).find((f) => (f.to === "/dev/null" ? f.from : f.to) === path);
    if (!f) return Response.json({ ok: false, error: m.fileNotFound }, { status: 404 });
    const read = async (path: string | undefined, side: typeof sides.oldSide) => {
      if (!path || path === "/dev/null") return null;
      const source = await getSideContent(root, side, path);
      return source == null ? null : viewerFile(path, source, locale);
    };
    const [oldFile, newFile] = await Promise.all([
      read(f.from, sides.oldSide),
      read(f.to, sides.newSide),
    ]);
    return Response.json({ ok: true, oldFile, newFile, diff });
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
  locale: Locale,
) {
  if (!profileForPath(f.to === "/dev/null" ? (f.from ?? "") : (f.to ?? "")))
    return analyzeFile(f, null, null, locale);
  const [oldSource, newSource] = await Promise.all([
    f.from && f.from !== "/dev/null" ? getSideContent(root, sides.oldSide, f.from) : null,
    f.to && f.to !== "/dev/null" ? getSideContent(root, sides.newSide, f.to) : null,
  ]);
  return analyzeFile(f, oldSource, newSource, locale);
}

function serveStatic(pathname: string, locale: Locale): Response {
  const entry =
    webAssets[pathname] ?? (/\.[^/]+$/.test(pathname) ? undefined : webAssets["/index.html"]);
  if (!entry) return new Response(messages(locale).api.notFound, { status: 404 });
  return new Response(Bun.file(entry.file), { headers: { "Content-Type": entry.type } });
}
