import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Tooltip } from "@base-ui-components/react/tooltip";
const App = lazy(() => import("../../web/src/App").then((m) => ({ default: m.App })));
import { ViewerSourceContext, type ViewerSource } from "../../web/src/viewerSource";
import { setLocale } from "../../web/src/i18n";
import { setThemeSetting } from "../../web/src/theme";
import { parsePullRequest, pullRequestUrl, pullRequestPath } from "../pr";

import { IconHome, IconLogout } from "../../web/src/icons";
import { Tooltip as Hint } from "../../web/src/Tooltip";

export default function AppPage() {
  const zh = navigator.language.toLowerCase().startsWith("zh");
  const locale = zh ? "zh-CN" : "en";
  const [input, setInput] = useState(
    () =>
      new URLSearchParams(location.search).get("pr") ??
      (location.pathname.startsWith("/gh/")
        ? `https://github.com/${location.pathname.slice(4)}`
        : ""),
  );
  const [pr, setPr] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState(() =>
    new URLSearchParams(location.search).get("login") === "failed"
      ? zh
        ? "登录未完成，请重试"
        : "Sign-in was not completed. Try again."
      : "",
  );
  useEffect(() => {
    setLocale(locale);
    setThemeSetting("auto");
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(zh ? "服务暂时不可用" : "Service unavailable");
        const session = await response.json();
        setAuthenticated(session.authenticated);
        if (input) {
          const canonical = pullRequestUrl(parsePullRequest(input));
          if (session.authenticated) {
            history.replaceState(null, "", pullRequestPath(parsePullRequest(canonical)));
            setPr(canonical);
          } else location.assign(`/auth/login?pr=${encodeURIComponent(canonical)}`);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  const source = useMemo<ViewerSource>(
    () => ({
      refreshOnFocus: false,
      allowBrowse: false,
      allowRefresh: false,
      url: (endpoint, parameters) =>
        `/api/${endpoint}?${new URLSearchParams({ pr: pr ?? "", locale, ...parameters })}`,
      errorActions: (
        <p>
          <a href="/">{zh ? "返回" : "Back"}</a>
          {" · "}
          <a href={`/auth/login?pr=${encodeURIComponent(pr ?? "")}`}>
            {zh ? "重新登录" : "Sign in again"}
          </a>
          {" · "}
          <a href="https://view.bandwidth.ren">{zh ? "本地 renview" : "Local renview"}</a>
        </p>
      ),
      header: (
        <span className="topbar-detail app-detail">
          <a href={pr ?? "#"} target="_blank" rel="noreferrer">
            {pr?.replace("https://github.com/", "")}
          </a>
        </span>
      ),
      headerStart: (
        <Hint content={zh ? "返回首页" : "Home"}>
          <button
            onClick={() => location.assign("/")}
            className="icon-btn"
            aria-label={zh ? "返回首页" : "Home"}
          >
            <IconHome />
          </button>
        </Hint>
      ),
      headerActions: (
        <Hint content={zh ? "退出" : "Sign out"}>
          <button
            className="icon-btn"
            aria-label={zh ? "退出" : "Sign out"}
            onClick={async () => {
              try {
                const response = await fetch("/auth/logout", { method: "POST" });
                if (!response.ok) throw new Error();
                location.assign("/");
              } catch {
                setPr(null);
                setError(zh ? "退出失败，请重试" : "Could not sign out. Try again.");
              }
            }}
          >
            <IconLogout />
          </button>
        </Hint>
      ),
    }),
    [pr, locale, zh],
  );
  if (pr)
    return (
      <Tooltip.Provider delay={150}>
        <ViewerSourceContext.Provider value={source}>
          <Suspense fallback={<div className="center-note">renview</div>}>
            <App key={pr} />
          </Suspense>
        </ViewerSourceContext.Provider>
      </Tooltip.Provider>
    );
  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const canonical = pullRequestUrl(parsePullRequest(input));
      setError("");
      if (!authenticated) location.assign(`/auth/login?pr=${encodeURIComponent(canonical)}`);
      else {
        history.replaceState(null, "", pullRequestPath(parsePullRequest(canonical)));
        setPr(canonical);
      }
    } catch {
      setError(zh ? "请输入有效的 GitHub PR 地址" : "Enter a valid GitHub PR URL");
    }
  }
  return (
    <main className="app-home">
      <h1>renview</h1>
      <form onSubmit={submit} className="pr-form">
        <label htmlFor="pr" className="pr-label">
          GitHub PR
        </label>
        <div className="pr-input">
          <svg
            className="pr-search-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            id="pr"
            name="pr"
            type="url"
            spellCheck={false}
            autoComplete="off"
            placeholder="https://github.com/owner/repo/pull/123"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
          />
          <button type="submit">{zh ? "查看" : "Open"}</button>
        </div>
      </form>
      {error && (
        <p role="alert" className="app-error">
          {error}
        </p>
      )}
      <p className="app-note">
        {zh ? "仅支持公开 PR。私有仓库请使用 " : "Public PRs only. For private repositories, use "}
        <a href="https://view.bandwidth.ren">{zh ? "本地 renview" : "renview locally"}</a>
        {zh ? "。" : "."}
      </p>
    </main>
  );
}
