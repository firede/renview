import { resolve } from "node:path";

const build = Bun.spawn(["bun", "--bun", "vite", "build"], {
  cwd: resolve("app"),
  stdout: "inherit",
  stderr: "inherit",
});
if (await build.exited) process.exit(1);
const worker = await Bun.build({
  entrypoints: ["app/server/analysis-worker.ts"],
  outdir: "app/dist",
  target: "bun",
  minify: true,
});
if (!worker.success) {
  for (const log of worker.logs) console.error(log);
  process.exit(1);
}
