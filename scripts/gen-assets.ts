import { Glob } from "bun";
import { statSync } from "node:fs";
import { join } from "node:path";

/** 扫描 web/dist，生成带 `with { type: "file" }` 静态导入的资源清单（编译期嵌入二进制） */

const DIST = "web/dist";
const OUT = "src/webassets.gen.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const files = [...new Glob("**/*").scanSync(DIST)]
  .filter((f) => statSync(join(DIST, f)).isFile())
  .sort();

if (files.length === 0) {
  console.error(`${DIST} 为空，请先运行 bun run build:web`);
  process.exit(1);
}

const lines: string[] = [
  "// 此文件由 scripts/gen-assets.ts 生成，请勿手改",
  "// @ts-nocheck  编译期由 Bun 以 type: \"file\" 处理这些导入，TS 无对应类型",
];
files.forEach((f, i) => {
  lines.push(`import f${i} from "../${DIST}/${f}" with { type: "file" };`);
});
lines.push("", "export const webAssets: Record<string, { file: string; type: string }> = {");
files.forEach((f, i) => {
  const ext = f.slice(f.lastIndexOf("."));
  lines.push(
    `  ${JSON.stringify(`/${f}`)}: { file: f${i}, type: ${JSON.stringify(MIME[ext] ?? "application/octet-stream")} },`,
  );
});
lines.push("};", "");

await Bun.write(OUT, lines.join("\n"));
console.log(`已生成 ${OUT}（${files.length} 个资源）`);
