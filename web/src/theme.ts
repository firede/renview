import { useSyncExternalStore } from "react";
import type { ThemeSetting } from "../../src/config";

export type { ThemeSetting } from "../../src/config";
export type ResolvedTheme = "dark" | "light";

/**
 * 主题状态：配置项 theme（auto/dark/light）经 matchMedia 解析为具体主题，
 * 写入 <html data-theme>（CSS token 据此切换）；auto 时跟随系统实时切换。
 * shiki 高亮按 resolved 主题选色，经 useTheme 订阅重算。
 */
const mq = window.matchMedia("(prefers-color-scheme: light)");
let setting: ThemeSetting = "auto";
let resolved: ResolvedTheme = mq.matches ? "light" : "dark";
const listeners = new Set<() => void>();

function apply(): void {
  resolved = setting === "auto" ? (mq.matches ? "light" : "dark") : setting;
  document.documentElement.dataset.theme = resolved;
  for (const l of listeners) l();
}

mq.addEventListener("change", () => {
  if (setting === "auto") apply();
});

/** 应用配置的主题项（/api/config 到达或聚焦刷新时调用） */
export function setThemeSetting(s: ThemeSetting): void {
  setting = s;
  apply();
}

/** 订阅当前解析后的主题（高亮等按主题取数的场景） */
export function useTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => resolved,
  );
}
