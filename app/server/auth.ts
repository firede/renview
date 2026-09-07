import { Database } from "bun:sqlite";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Cache } from "./cache";
import type { AppConfig } from "./config";
import { boundedText, HttpError } from "./http";
import { parsePullRequest, pullRequestPath } from "../pr";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const random = () => randomBytes(32).toString("base64url");
const MAX_SESSION_SECONDS = 8 * 3600;

export class AuthStore {
  private db: Database;
  private key: Buffer;
  constructor(path: string, encryptionKey: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.key = Buffer.from(encryptionKey, "hex");
    this.db = new Database(path, { create: true });
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 3000;
      CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS account (
        user_id INTEGER PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
        github_id TEXT NOT NULL UNIQUE,
        token TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS session_expiry ON session(expires_at);
    `);
  }
  private encrypt(token: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    return Buffer.concat([iv, cipher.update(token), cipher.final(), cipher.getAuthTag()]).toString(
      "base64",
    );
  }
  private decrypt(value: string) {
    const data = Buffer.from(value, "base64");
    const cipher = createDecipheriv("aes-256-gcm", this.key, data.subarray(0, 12));
    cipher.setAuthTag(data.subarray(-16));
    return Buffer.concat([cipher.update(data.subarray(12, -16)), cipher.final()]).toString();
  }
  create(githubId: string, token: string, seconds: number) {
    const session = random();
    const expires = Date.now() + Math.min(seconds, MAX_SESSION_SECONDS) * 1000;
    this.db.transaction(() => {
      const existing = this.db
        .query("SELECT user_id FROM account WHERE github_id = ?")
        .get(githubId) as { user_id: number } | null;
      const id =
        existing?.user_id ??
        Number(this.db.query("INSERT INTO user DEFAULT VALUES").run().lastInsertRowid);
      this.db
        .query(
          "INSERT INTO account VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token, expires_at=excluded.expires_at",
        )
        .run(id, githubId, this.encrypt(token), expires);
      this.db.query("INSERT INTO session VALUES (?, ?, ?)").run(hash(session), id, expires);
    })();
    return { session, expires };
  }
  read(session: string | null): { id: number; token: string } | null {
    if (!session || !/^[A-Za-z0-9_-]{43}$/.test(session)) return null;
    const row = this.db
      .query(
        "SELECT account.user_id AS id, account.token FROM session JOIN account ON session.user_id=account.user_id WHERE session.id=? AND session.expires_at>? AND account.expires_at>?",
      )
      .get(hash(session), Date.now(), Date.now()) as { id: number; token: string } | null;
    return row ? { id: row.id, token: this.decrypt(row.token) } : null;
  }
  remove(session: string) {
    this.db.query("DELETE FROM session WHERE id=?").run(hash(session));
    this.cleanup();
  }
  invalidate(userId: number) {
    this.db.query("DELETE FROM user WHERE id=?").run(userId);
  }
  cleanup() {
    this.db.transaction(() => {
      this.db.query("DELETE FROM session WHERE expires_at<=?").run(Date.now());
      this.db.query("DELETE FROM user WHERE id NOT IN (SELECT user_id FROM session)").run();
    })();
  }
  close() {
    this.db.close();
  }
}

function cookieValue(req: Request, name: string) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}
interface PendingLogin {
  verifier: string;
  target: string;
}

/** 登录只申请公开身份，令牌与会话同时过期，不保存 refresh token。 */
export class Auth {
  readonly store: AuthStore;
  private sessionName: string;
  private flowName: string;
  constructor(
    private config: AppConfig,
    private cache: Cache,
    private request = fetch,
  ) {
    this.store = new AuthStore(config.databasePath, config.encryptionKey);
    this.sessionName = config.origin.startsWith("https:")
      ? "__Host-renview-session"
      : "renview-session";
    this.flowName = config.origin.startsWith("https:") ? "__Host-renview-oauth" : "renview-oauth";
  }
  private cookie(name: string, value: string, seconds: number) {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${this.config.origin.startsWith("https:") ? "; Secure" : ""}`;
  }
  user(req: Request) {
    return this.store.read(cookieValue(req, this.sessionName));
  }
  async login(req: Request) {
    if (!(await this.cache.limit("login", 60, 60)))
      throw new HttpError(429, "登录请求过多，请稍后重试");
    const pr = new URL(req.url).searchParams.get("pr");
    let target = "/";
    if (pr) {
      try {
        target = pullRequestPath(parsePullRequest(pr));
      } catch {
        throw new HttpError(400, "请输入有效的 GitHub PR 地址");
      }
    }
    const state = random();
    const verifier = random();
    await this.cache.set(`oauth:${hash(state)}`, { verifier, target }, 600);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: `${this.config.origin}/auth/callback`,
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return new Response(null, {
      status: 302,
      headers: { Location: url.href, "Set-Cookie": this.cookie(this.flowName, state, 600) },
    });
  }
  async callback(req: Request) {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const cookie = cookieValue(req, this.flowName);
    if (
      !state ||
      !cookie ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      !/^[A-Za-z0-9_-]{43}$/.test(cookie) ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))
    )
      throw new HttpError(400, "登录已过期，请重新登录");
    const pending = await this.cache.take<PendingLogin>(`oauth:${hash(state)}`);
    const code = url.searchParams.get("code");
    if (!pending || !code || url.searchParams.has("error"))
      throw new HttpError(400, "登录未完成，请重新登录");
    const response = await this.request("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        code_verifier: pending.verifier,
        redirect_uri: `${this.config.origin}/auth/callback`,
      }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    const token = JSON.parse(await boundedText(response, 16_384)) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!response.ok || !token.access_token) throw new HttpError(401, "GitHub 登录失败，请重试");
    const identity = await this.request("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "renview",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    const user = JSON.parse(await boundedText(identity, 65_536)) as { id?: number };
    if (!identity.ok || !Number.isSafeInteger(user.id))
      throw new HttpError(401, "无法验证 GitHub 身份");
    const seconds = Math.min(MAX_SESSION_SECONDS, token.expires_in ?? MAX_SESSION_SECONDS);
    if (!Number.isFinite(seconds) || seconds < 1) throw new HttpError(401, "GitHub 授权已过期");
    const saved = this.store.create(String(user.id), token.access_token, seconds);
    const headers = new Headers({ Location: pending.target });
    headers.append("Set-Cookie", this.cookie(this.sessionName, saved.session, Math.floor(seconds)));
    headers.append("Set-Cookie", this.cookie(this.flowName, "", 0));
    return new Response(null, { status: 302, headers });
  }
  logout(req: Request) {
    if (req.method !== "POST" || req.headers.get("origin") !== this.config.origin)
      throw new HttpError(403, "请求来源无效");
    const session = cookieValue(req, this.sessionName);
    if (session) this.store.remove(session);
    return new Response(null, {
      status: 303,
      headers: { Location: "/", "Set-Cookie": this.cookie(this.sessionName, "", 0) },
    });
  }
}
