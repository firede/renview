import type { FileEntry, ReviewContext } from "../../src/analysis/types";
import type { Locale } from "../../src/i18n";
import { Analyzer } from "./analysis";
import { Auth } from "./auth";
import { RedisCache, SingleFlight, type Cache } from "./cache";
import { readConfig, type AppConfig } from "./config";
import { GitHub, GitHubTokenError, type Source } from "./github";
import { HttpError } from "./http";

/** 分析契约与发布修订共同隔离缓存，部署后不会混用旧投影。 */
const ANALYSIS_VERSION = `1:${process.env.APP_REVISION ?? "dev"}`;
export function createApp(
  config: AppConfig,
  cache: Cache = new RedisCache(config.redisUrl),
  request = fetch,
) {
  const auth = new Auth(config, cache, request);
  const github = new GitHub(cache, request);
  const analyzer = new Analyzer();
  const flight = new SingleFlight();
  auth.store.cleanup();
  const cleanup = setInterval(() => auth.store.cleanup(), 3600_000);
  cleanup.unref();
  async function analyzeCached<T>(key: string, load: () => Promise<T>): Promise<T> {
    return flight.run(key, async () => {
      const hit = await cache.get<T>(key);
      if (hit !== null) return hit;
      const result = await load();
      // 大结果仅返回给本次请求，避免单文件占满缓存。
      if (JSON.stringify(result).length <= 2_000_000) await cache.set(key, result, 3600);
      return result;
    });
  }
  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/healthz") {
      await cache.get("health");
      return Response.json({ ok: true });
    }
    if (req.method === "GET" && url.pathname === "/auth/login") return auth.login(req);
    if (req.method === "GET" && url.pathname === "/auth/callback") return auth.callback(req);
    if (url.pathname === "/auth/logout") return auth.logout(req);
    if (req.method !== "GET") throw new HttpError(405, "不支持此请求方法");
    const user = auth.user(req);
    if (url.pathname === "/api/session") return Response.json({ ok: true, authenticated: !!user });
    if (!user) throw new HttpError(401, "请通过 GitHub 登录后查看");
    if (!(await cache.limit(`user:${user.id}`, 120, 60)))
      throw new HttpError(429, "请求过于频繁，请稍后重试");
    const locale: Locale = url.searchParams.get("locale") === "zh-CN" ? "zh-CN" : "en";
    try {
      if (url.pathname === "/api/diff") {
        const snapshot = await github.latest(url.searchParams.get("pr") ?? "", user.token);
        return Response.json({
          ok: true,
          snapshot: snapshot.id,
          diff: snapshot.diff,
          files: snapshot.files,
          repoRoot: snapshot.repo,
          title: snapshot.title,
          prUrl: snapshot.url,
          generatedAt: Date.now(),
        });
      }
      if (url.pathname !== "/api/review-file") throw new HttpError(404, "接口不存在");
      const snapshot = await github.snapshot(url.searchParams.get("snapshot") ?? "", user.token);
      const path = url.searchParams.get("path");
      if (!path || path.length > 4096) throw new HttpError(400, "文件路径无效");
      const file = github.file(snapshot, path);
      const result = await analyzeCached<Omit<ReviewContext, "diff"> & { entry: FileEntry }>(
        `analysis:${ANALYSIS_VERSION}:${snapshot.id}:${locale}:${encodeURIComponent(path)}`,
        async () => {
          if (
            [file.oldMode, file.newMode].some((mode) => mode === "120000" || mode === "160000") ||
            file.chunks.length === 0
          ) {
            const entry = snapshot.files.find((f) => (f.newPath ?? f.oldPath) === path)!;
            return {
              entry: { ...entry, degradedReason: "no-source" },
              oldFile: null,
              newFile: null,
            };
          }
          const absent: Source = { text: null };
          const [old, next] = await Promise.all([
            file.from && file.from !== "/dev/null"
              ? github.source(
                  snapshot.repo,
                  snapshot.repoId,
                  snapshot.mergeBase,
                  file.from,
                  user.token,
                )
              : absent,
            file.to && file.to !== "/dev/null"
              ? github.source(
                  snapshot.headRepo,
                  snapshot.headRepoId,
                  snapshot.head,
                  file.to,
                  user.token,
                )
              : absent,
          ]);
          if (old.reason || next.reason) {
            const entry = snapshot.files.find((f) => (f.newPath ?? f.oldPath) === path)!;
            return {
              entry: {
                ...entry,
                degradedReason:
                  old.reason === "too-large" || next.reason === "too-large"
                    ? "too-large"
                    : "no-source",
              },
              oldFile: null,
              newFile: null,
            };
          }
          return analyzer.run({
            kind: "review",
            file,
            oldSource: old.text,
            newSource: next.text,
            locale,
          });
        },
      );
      return Response.json({ ok: true, ...result, snapshot: snapshot.id });
    } catch (error) {
      if (error instanceof GitHubTokenError && error.matches(user.token))
        auth.store.invalidate(user.id);
      throw error;
    }
  }
  return {
    async fetch(req: Request) {
      let response: Response;
      try {
        response = await handle(req);
      } catch (error) {
        if (new URL(req.url).pathname === "/auth/callback") {
          return new Response(null, {
            status: 303,
            headers: {
              Location: "/?login=failed",
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
            },
          });
        }
        response = Response.json(
          {
            ok: false,
            error: error instanceof HttpError ? error.message : "服务暂时不可用，请稍后重试",
          },
          { status: error instanceof HttpError ? error.status : 503 },
        );
      }
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    },
    close() {
      clearInterval(cleanup);
      analyzer.close();
      auth.store.close();
    },
  };
}
let app: ReturnType<typeof createApp> | null = null;
export function handleAppRequest(req: Request) {
  app ??= createApp(readConfig());
  return app.fetch(req);
}
