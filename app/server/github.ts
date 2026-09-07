import { createHash } from "node:crypto";
import parseDiff from "parse-diff";
import type { ParsedFile } from "../../src/analysis/map";
import type { FileEntry } from "../../src/analysis/types";
import { Gate, SingleFlight, type Cache } from "./cache";
import { boundedText, HttpError } from "./http";
import { parsePullRequest, pullRequestUrl } from "../pr";

export const LIMITS = {
  files: 300,
  diffBytes: 2_000_000,
  sourceBytes: 500_000,
  treeEntries: 20_000,
};
const unavailable = "无法访问该公开 PR；私有仓库请使用本地 renview";
interface Repository {
  id: number;
  full_name: string;
  private: boolean;
  visibility?: string;
}
interface Pull {
  number: number;
  title: string;
  changed_files: number;
  base: { sha: string; repo: Repository };
  head: { sha: string; repo: Repository | null };
}
export interface Snapshot {
  id: string;
  url: string;
  title: string;
  repo: string;
  headRepo: string;
  repoId: number;
  headRepoId: number;
  base: string;
  head: string;
  mergeBase: string;
  diff: string;
  files: FileEntry[];
}
export interface Source {
  text: string | null;
  reason?: "too-large" | "binary";
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const repoPath = (repo: string) => repo.split("/").map(encodeURIComponent).join("/");

/** 合并请求的鉴权失败只属于实际提供令牌的用户。 */
export class GitHubTokenError extends HttpError {
  readonly fingerprint: string;
  constructor(token: string) {
    super(401, "GitHub 授权已失效，请重新登录");
    this.fingerprint = digest(token);
  }
  matches(token: string) {
    return this.fingerprint === digest(token);
  }
}

export class GitHub {
  private flight = new SingleFlight();
  private gate = new Gate(4);
  constructor(
    private cache: Cache,
    private request = fetch,
  ) {}
  private async get(path: string, token: string, raw = false, maximum = 4_000_000) {
    return this.gate.run(async () => {
      const cooldown = `cooldown:${digest(token)}`;
      if (await this.cache.get(cooldown))
        throw new HttpError(429, "GitHub 请求暂时受限，请稍后重试");
      if (!(await this.cache.limit("github", 300, 60)))
        throw new HttpError(429, "服务繁忙，请稍后重试");
      const response = await this.request(`https://api.github.com${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: raw ? "application/vnd.github.diff" : "application/vnd.github+json",
          "User-Agent": "renview",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(20_000),
        redirect: "error",
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401) throw new GitHubTokenError(token);
        if (response.status === 403 || response.status === 429) {
          const retry = Number(response.headers.get("retry-after"));
          const reset = Number(response.headers.get("x-ratelimit-reset")) - Date.now() / 1000;
          const seconds = Math.ceil(
            Math.min(3600, Math.max(60, retry || 0, Number.isFinite(reset) ? reset : 0)),
          );
          await this.cache.set(cooldown, true, seconds);
          throw new HttpError(429, "GitHub 请求暂时受限，请稍后重试");
        }
        if (response.status === 404) throw new HttpError(404, unavailable);
        throw new HttpError(502, "GitHub 暂时无法提供此内容，请稍后重试");
      }
      const text = await boundedText(response, maximum);
      return raw ? text : JSON.parse(text);
    });
  }
  private cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    return this.flight.run(key, async () => {
      const hit = await this.cache.get<T>(key);
      if (hit !== null) return hit;
      const value = await load();
      await this.cache.set(key, value, ttl);
      return value;
    });
  }
  async publicRepo(repo: string, token: string, expectedId?: number): Promise<Repository> {
    const result = await this.cached<Repository>(`public:${repo.toLowerCase()}`, 60, async () => {
      const data = (await this.get(`/repos/${repoPath(repo)}`, token)) as Repository;
      if (data.private !== false || (data.visibility && data.visibility !== "public"))
        throw new HttpError(404, unavailable);
      return { id: data.id, full_name: data.full_name, private: false, visibility: "public" };
    });
    if (expectedId !== undefined && expectedId !== result.id)
      throw new HttpError(409, "仓库已变化，请刷新 PR");
    return result;
  }
  async guard(snapshot: Snapshot, token: string) {
    await this.publicRepo(snapshot.repo, token, snapshot.repoId);
    if (snapshot.repo !== snapshot.headRepo)
      await this.publicRepo(snapshot.headRepo, token, snapshot.headRepoId);
  }
  async latest(input: string, token: string): Promise<Snapshot> {
    let address: ReturnType<typeof parsePullRequest>;
    try {
      address = parsePullRequest(input);
    } catch {
      throw new HttpError(400, "请输入有效的 GitHub PR 地址");
    }
    const repo = `${address.owner}/${address.repo}`;
    const visible = await this.publicRepo(repo, token);
    const snapshot = await this.cached<Snapshot>(
      `pr:${visible.id}:${address.number}`,
      60,
      async () => {
        const pr = (await this.get(
          `/repos/${repoPath(repo)}/pulls/${address.number}`,
          token,
        )) as Pull;
        if (pr.base.repo.private !== false || !pr.head.repo || pr.head.repo.private !== false)
          throw new HttpError(404, unavailable);
        if (pr.changed_files > LIMITS.files)
          throw new HttpError(
            413,
            `在线版支持最多 ${LIMITS.files} 个变更文件，请使用本地 renview 查看`,
          );
        if (!/^[a-f0-9]{40}$/.test(pr.base.sha) || !/^[a-f0-9]{40}$/.test(pr.head.sha))
          throw new HttpError(502, "GitHub 返回了无效版本");
        const baseRepo = pr.base.repo.full_name;
        const headRepo = pr.head.repo.full_name;
        const headRepoId = pr.head.repo.id;
        await this.publicRepo(headRepo, token, pr.head.repo.id);
        const key = `snapshot:${digest(`${pr.base.repo.id}:${pr.head.repo.id}:${address.number}:${pr.base.sha}:${pr.head.sha}`)}`;
        return this.cached(key, 3600, async () => {
          const comparison = `/repos/${repoPath(baseRepo)}/compare/${pr.base.sha}...${pr.head.sha}`;
          const meta = (await this.get(comparison, token)) as {
            merge_base_commit: { sha: string };
            files?: unknown[];
          };
          if (!/^[a-f0-9]{40}$/.test(meta.merge_base_commit?.sha ?? ""))
            throw new HttpError(502, "GitHub 返回了无效版本");
          const diff = (await this.get(comparison, token, true, LIMITS.diffBytes)) as string;
          const parsed = parseDiff(diff);
          if (parsed.length > LIMITS.files || (meta.files && parsed.length !== meta.files.length))
            throw new HttpError(413, "GitHub 未提供完整变更，请使用本地 renview 查看");
          const snapshot: Snapshot = {
            id: key.slice("snapshot:".length),
            url: pullRequestUrl(address),
            title: pr.title,
            repo: baseRepo,
            headRepo,
            repoId: pr.base.repo.id,
            headRepoId,
            base: pr.base.sha,
            head: pr.head.sha,
            mergeBase: meta.merge_base_commit.sha,
            diff,
            files: parsed.map((f) => {
              const oldPath = f.from === "/dev/null" ? null : (f.from ?? null);
              const newPath = f.to === "/dev/null" ? null : (f.to ?? null);
              return {
                oldPath,
                newPath,
                status: !oldPath
                  ? "add"
                  : !newPath
                    ? "delete"
                    : oldPath !== newPath
                      ? "rename"
                      : "modify",
                projection: null,
              };
            }),
          };
          return snapshot;
        });
      },
    );
    await this.guard(snapshot, token);
    // 热门 PR 可以持续命中元数据缓存；同时延长其快照可读取时间。
    await this.cache.set(`snapshot:${snapshot.id}`, snapshot, 3600);
    return snapshot;
  }
  async snapshot(id: string, token: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new HttpError(400, "无效的 PR 快照");
    const snapshot = await this.cache.get<Snapshot>(`snapshot:${id}`);
    if (!snapshot) throw new HttpError(410, "PR 缓存已过期，请刷新");
    await this.guard(snapshot, token);
    return snapshot;
  }
  file(snapshot: Snapshot, path: string): ParsedFile & { oldMode?: string; newMode?: string } {
    const file = parseDiff(snapshot.diff).find(
      (f) => (f.to === "/dev/null" ? f.from : f.to) === path,
    );
    if (!file) throw new HttpError(404, "文件不属于当前 PR");
    return file as unknown as ParsedFile;
  }
  async source(
    repo: string,
    repoId: number,
    sha: string,
    path: string,
    token: string,
  ): Promise<Source> {
    // 调用者须先验证快照及仓库公开状态；这里只接受 GitHub 返回的路径和固定 SHA。
    return this.cached(`source:${repoId}:${sha}:${digest(path)}`, 3600, async () => {
      const data = (await this.get(
        `/repos/${repoPath(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${sha}`,
        token,
        false,
        800_000,
      )) as { size: number; encoding: string; content?: string; type: string };
      if (data.size > LIMITS.sourceBytes) return { text: null, reason: "too-large" };
      if (data.type !== "file" || data.encoding !== "base64" || data.content === undefined)
        return { text: null, reason: "binary" };
      const bytes = Buffer.from(data.content, "base64");
      if (bytes.length > LIMITS.sourceBytes) return { text: null, reason: "too-large" };
      if (bytes.subarray(0, 8192).includes(0)) return { text: null, reason: "binary" };
      return { text: bytes.toString("utf8") };
    });
  }
  async files(snapshot: Snapshot, token: string): Promise<string[]> {
    return this.cached(`tree:${snapshot.headRepoId}:${snapshot.head}`, 3600, async () => {
      const tree = (await this.get(
        `/repos/${repoPath(snapshot.headRepo)}/git/trees/${snapshot.head}?recursive=1`,
        token,
        false,
        5_000_000,
      )) as { truncated: boolean; tree: Array<{ path: string; type: string; mode: string }> };
      if (tree.truncated || tree.tree.length > LIMITS.treeEntries)
        throw new HttpError(413, "仓库目录过大，请使用本地 renview 浏览");
      return tree.tree
        .filter((entry) => entry.type === "blob" && entry.mode !== "120000")
        .map((entry) => entry.path)
        .sort();
    });
  }
}
