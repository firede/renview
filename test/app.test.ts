import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app/server/app";
import { Auth, AuthStore } from "../app/server/auth";
import { Gate, SingleFlight, type Cache } from "../app/server/cache";
import { GitHub } from "../app/server/github";
import { boundedText } from "../app/server/http";
import { parsePullRequest } from "../app/pr";

class MemoryCache implements Cache {
  values = new Map<string, { value: unknown; expires: number }>();
  async get<T>(key: string): Promise<T | null> {
    const item = this.values.get(key);
    return item && item.expires > Date.now() ? (item.value as T) : null;
  }
  async set(key: string, value: unknown, seconds: number) {
    this.values.set(key, { value, expires: Date.now() + seconds * 1000 });
  }
  async take<T>(key: string) {
    const value = await this.get<T>(key);
    this.values.delete(key);
    return value;
  }
  async limit() {
    return true;
  }
}
const config = {
  origin: "https://renview.example",
  clientId: "id",
  clientSecret: "secret",
  encryptionKey: "ab".repeat(32),
  databasePath: ":memory:",
  redisUrl: "redis://localhost",
};

test("PR 输入拒绝任意源、凭据和伪装路径", () => {
  expect(parsePullRequest("https://github.com/Foo/Bar/pull/42/files#diff-a")).toEqual({
    owner: "foo",
    repo: "bar",
    number: 42,
  });
  for (const url of [
    "http://github.com/a/b/pull/1",
    "https://github.com.evil/a/b/pull/1",
    "https://a@github.com/a/b/pull/1",
    "https://github.com/a/b/pull/0",
    "https://github.com/a/b/issues/1",
    "https://github.com/a/b/pull/1evil",
  ])
    expect(() => parsePullRequest(url)).toThrow();
});

test("PR 子页面统一解析为所属 PR", () => {
  for (const suffix of [
    "/changes",
    "/files",
    "/commits/abcdef",
    "/checks/123?check_suite_focus=true",
    "/changes#diff-a",
  ]) {
    expect(parsePullRequest(`https://github.com/jdx/mise/pull/12735${suffix}`)).toEqual({
      owner: "jdx",
      repo: "mise",
      number: 12735,
    });
  }
});

test("会话仅接受原始随机令牌，退出后清理身份数据", () => {
  const store = new AuthStore(":memory:", config.encryptionKey);
  try {
    const { session } = store.create("123", "github-token", 60);
    const user = store.read(session)!;
    expect(user.token).toBe("github-token");
    expect(store.read("invalid")).toBeNull();
    store.remove(session);
    expect(store.read(session)).toBeNull();
    const expired = store.create("123", "expired", -1);
    expect(store.read(expired.session)).toBeNull();
  } finally {
    store.close();
  }
});

test("登录使用 PKCE，校验浏览器状态，消费回调后不可重放", async () => {
  const cache = new MemoryCache();
  const calls: string[] = [];
  const request = (async (url: string | URL | Request, options?: RequestInit) => {
    calls.push(String(url));
    if (String(url).includes("access_token")) {
      const data = JSON.parse(String(options?.body));
      expect(data.code_verifier).toHaveLength(43);
      expect(data.scope).toBeUndefined();
      return Response.json({ access_token: "token", expires_in: 3600 });
    }
    return Response.json({ id: 123 });
  }) as typeof fetch;
  const auth = new Auth(config, cache, request);
  try {
    const start = await auth.login(
      new Request(`${config.origin}/auth/login?pr=https://github.com/a/b/pull/1`),
    );
    const target = new URL(start.headers.get("location")!);
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(target.searchParams.has("scope")).toBe(false);
    const state = target.searchParams.get("state")!;
    const callback = `${config.origin}/auth/callback?code=code&state=${state}`;
    await expect(auth.callback(new Request(callback))).rejects.toThrow("登录已过期");
    expect(calls).toHaveLength(0);
    const req = new Request(callback, {
      headers: { cookie: start.headers.get("set-cookie")!.split(";")[0] },
    });
    const done = await auth.callback(req);
    expect(done.headers.get("location")).toBe("/gh/a/b/pull/1");
    expect(
      done.headers
        .getSetCookie()
        .some((cookie) => cookie.includes("HttpOnly") && cookie.includes("Secure")),
    ).toBe(true);
    await expect(auth.callback(req)).rejects.toThrow("登录未完成");
    expect(() =>
      auth.logout(
        new Request(`${config.origin}/auth/logout`, {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow();
  } finally {
    auth.store.close();
  }
});

const baseSha = "a".repeat(40),
  headSha = "b".repeat(40),
  mergeSha = "c".repeat(40);
const diff =
  "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-const a = 1;\n+const a = 2;\n";
function fixture() {
  let isPrivate = false;
  const calls: string[] = [];
  const cache = new MemoryCache();
  const request = (async (url: string | URL | Request, options?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push(String(url));
    if (path === "/repos/a/b")
      return Response.json({
        id: 1,
        full_name: "a/b",
        private: isPrivate,
        visibility: isPrivate ? "private" : "public",
      });
    if (path.endsWith("/pulls/1"))
      return Response.json({
        number: 1,
        title: "PR",
        changed_files: 1,
        base: { sha: baseSha, repo: { id: 1, full_name: "a/b", private: false } },
        head: { sha: headSha, repo: { id: 1, full_name: "a/b", private: false } },
      });
    if (path.includes("/compare/"))
      return new Headers(options?.headers).get("accept")?.includes("diff")
        ? new Response(diff)
        : Response.json({ merge_base_commit: { sha: mergeSha }, files: [{}] });
    if (path.includes("/contents/"))
      return Response.json({
        type: "file",
        size: 12,
        encoding: "base64",
        content: Buffer.from("const a = 2;").toString("base64"),
      });
    throw new Error(`未知测试请求 ${path}`);
  }) as typeof fetch;
  return {
    github: new GitHub(cache, request),
    request,
    cache,
    calls,
    makePrivate: () => {
      isPrivate = true;
      cache.values.delete("public:a/b");
    },
  };
}

test("PR 快照固定 merge-base 和 head；公共缓存跨用户复用", async () => {
  const { github, calls } = fixture();
  const snapshot = await github.latest("https://github.com/a/b/pull/1", "user-one");
  expect(snapshot.mergeBase).toBe(mergeSha);
  expect(snapshot.head).toBe(headSha);
  expect(snapshot.files).toHaveLength(1);
  const count = calls.length;
  expect((await github.latest("https://github.com/a/b/pull/1", "user-two")).id).toBe(snapshot.id);
  expect(calls).toHaveLength(count);
  await github.source(snapshot.repo, snapshot.repoId, snapshot.mergeBase, "a.ts", "token");
  expect(calls.at(-1)).toContain(`ref=${mergeSha}`);
});

test("仓库转私有后，已有快照也不返回", async () => {
  const { github, makePrivate } = fixture();
  const snapshot = await github.latest("https://github.com/a/b/pull/1", "token");
  makePrivate();
  await expect(github.snapshot(snapshot.id, "token")).rejects.toThrow("无法访问该公开 PR");
});

test("未知快照和非 PR 文件拒绝访问", async () => {
  const { github } = fixture();
  await expect(github.snapshot("../x", "token")).rejects.toThrow("无效");
  const snapshot = await github.latest("https://github.com/a/b/pull/1", "token");
  expect(() => github.file(snapshot, "secret.ts")).toThrow("不属于");
});

test("并发相同加载合并；过载队列不会无限增长", async () => {
  const flight = new SingleFlight();
  let calls = 0;
  const load = async () => {
    calls++;
    await Bun.sleep(5);
    return 42;
  };
  expect(await Promise.all([flight.run("x", load), flight.run("x", load)])).toEqual([42, 42]);
  expect(calls).toBe(1);
  const gate = new Gate(1, 0);
  const active = gate.run(load);
  await expect(gate.run(load)).rejects.toThrow("繁忙");
  await active;
});

test("无 Content-Length 的响应仍受大小限制", async () => {
  await expect(boundedText(new Response("12345"), 4)).rejects.toThrow("内容过大");
  expect(await boundedText(new Response("1234"), 4)).toBe("1234");
});

test("上游限流后进入冷却，不反复消耗 GitHub 请求", async () => {
  let calls = 0;
  const github = new GitHub(new MemoryCache(), (async (_input: string | URL | Request) => {
    calls++;
    return new Response("", { status: 429, headers: { "retry-after": "120" } });
  }) as typeof fetch);
  await expect(github.latest("https://github.com/a/b/pull/1", "token")).rejects.toThrow("受限");
  await expect(github.latest("https://github.com/a/b/pull/2", "token")).rejects.toThrow("受限");
  expect(calls).toBe(1);
});

test("超大 PR 在下载 diff 和源码前拒绝", async () => {
  let comparisons = 0;
  const github = new GitHub(new MemoryCache(), (async (input) => {
    const path = String(input);
    if (path.endsWith("/repos/a/b"))
      return Response.json({ id: 1, full_name: "a/b", private: false });
    if (path.includes("/compare/")) comparisons++;
    return Response.json({
      changed_files: 301,
      base: { repo: { private: false } },
      head: { repo: { private: false } },
    });
  }) as typeof fetch);
  await expect(github.latest("https://github.com/a/b/pull/1", "token")).rejects.toThrow("300");
  expect(comparisons).toBe(0);
});

test("HTTP 接口鉴权覆盖公共缓存，快照上下文不重复传输完整 diff", async () => {
  const directory = mkdtempSync(join(tmpdir(), "renview-app-"));
  const cfg = { ...config, databasePath: join(directory, "auth.sqlite") };
  const store = new AuthStore(cfg.databasePath, cfg.encryptionKey);
  const saved = store.create("123", "token", 3600);
  store.close();
  const { cache, request } = fixture();
  const app = createApp(cfg, cache, request);
  const headers = { cookie: `__Host-renview-session=${saved.session}` };
  try {
    const query = `${cfg.origin}/api/diff?pr=https://github.com/a/b/pull/1`;
    expect((await app.fetch(new Request(query))).status).toBe(401);
    const response = await app.fetch(new Request(query, { headers }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json();
    for (const endpoint of ["files", "file"]) {
      const disabled = await app.fetch(
        new Request(`${cfg.origin}/api/${endpoint}?snapshot=${payload.snapshot}&path=a.ts`, {
          headers,
        }),
      );
      expect(disabled.status).toBe(404);
    }
    const contextUrl = `${cfg.origin}/api/review-file?snapshot=${payload.snapshot}&path=a.ts`;
    const context = await (await app.fetch(new Request(contextUrl, { headers }))).json();
    expect(context.snapshot).toBe(payload.snapshot);
    expect(context.entry.simplified).toBeDefined();
    expect(context.diff).toBeUndefined();
    expect((await app.fetch(new Request(contextUrl))).status).toBe(401);
    const invalid = await app.fetch(new Request(`${cfg.origin}/api/diff?pr=invalid`, { headers }));
    expect(invalid.status).toBe(400);
  } finally {
    app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("取消或伪造的 OAuth 回调返回首页，不暴露授权参数", async () => {
  const app = createApp(config, new MemoryCache());
  try {
    const response = await app.fetch(
      new Request(`${config.origin}/auth/callback?code=sensitive&state=invalid`),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?login=failed");
    expect(await response.text()).not.toContain("sensitive");
  } finally {
    app.close();
  }
});
