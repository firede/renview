import { cpSync, mkdirSync, rmSync } from "node:fs";

/** 单次命令内共享前置步骤；独立命令仍可从干净检出启动。 */
const completed = new Set<string>();
async function run(...args: string[]) {
  const child = Bun.spawn(args, { stdout: "inherit", stderr: "inherit", stdin: "inherit" });
  if (await child.exited) throw new Error(`执行失败：${args.join(" ")}`);
}
async function once(name: string, task: () => Promise<void>) {
  if (completed.has(name)) return;
  await task();
  completed.add(name);
}
const wasm = () => once("wasm", () => run("bun", "scripts/sync-wasm.ts"));
const web = () =>
  once("web", async () => {
    await run("bun", "--bun", "vite", "build");
    await run("bun", "scripts/gen-assets.ts");
  });
const app = () =>
  once("app", async () => {
    await wasm();
    await run("bun", "scripts/build-app.ts");
  });
async function test() {
  await wasm();
  await web();
  await run("bun", "test");
}
async function typecheck() {
  await web();
  await app();
  await run("bun", "x", "tsc", "--noEmit");
}
async function check() {
  await run("bun", "scripts/gen-languages.ts", "--check");
  await test();
  await typecheck();
  await run("bun", "run", "lint");
}
async function compile(args: string[]) {
  await wasm();
  await web();
  await run("bun", "scripts/build.ts", ...args);
}
function imageContext() {
  const root = "dist/app-image";
  rmSync(root, { recursive: true, force: true });
  mkdirSync(`${root}/app/app/server`, { recursive: true });
  cpSync("app/dist", `${root}/app/app/dist`, { recursive: true });
  for (const path of ["app/serve.ts", "app/server/config.ts"]) cpSync(path, `${root}/app/${path}`);
}
const [task, ...args] = process.argv.slice(2);
try {
  switch (task) {
    case "test":
      await test();
      break;
    case "typecheck":
      await typecheck();
      break;
    case "check":
      await check();
      break;
    case "app":
      await app();
      break;
    case "build":
      await compile(args);
      break;
    case "release":
      await check();
      await compile(args);
      await run("bun", "scripts/pack.ts");
      imageContext();
      break;
    default:
      throw new Error(`未知任务：${task}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
