// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import pkg from "./package.json" with { type: "json" };

// https://astro.build/config
export default defineConfig({
  site: pkg.homepage,
  adapter: cloudflare(),
});
