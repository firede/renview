// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import pkg from "./package.json" with { type: "json" };

// https://astro.build/config
export default defineConfig({
  site: pkg.homepage,
  adapter: cloudflare(),
  // 演示入口直接编译仓库内共享查看器。
  vite: { server: { fs: { allow: [".."] } } },
});
