import { expect, test } from "bun:test";
import parseDiff from "parse-diff";
import { analyzeFile, viewerFile } from "../src/analysis/service";
import type { ParsedFile } from "../src/analysis/map";

const diff =
  "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-export function fee(n: number): number { return n; }\n+export function fee(n: number): number { return n * 2; }\n";
test("共享分析入口从源码构建投影和上下文，无需仓库", async () => {
  const old = "export function fee(n: number): number { return n; }\n";
  const next = "export function fee(n: number): number { return n * 2; }\n";
  const entry = await analyzeFile(parseDiff(diff)[0] as unknown as ParsedFile, old, next, "zh-CN");
  expect(entry.projection?.units[0]?.name).toBe("fee");
  expect(entry.simplified?.rows.length).toBeGreaterThan(0);
  const file = await viewerFile("a.ts", next, "zh-CN");
  expect(file.source).toBe(next);
  expect(file.outline[0]?.name).toBe("fee");
});

test("共享全文分析保留二进制和超大文件降级", async () => {
  expect((await viewerFile("a.ts", "\0binary", "en")).source).toBeNull();
  expect((await viewerFile("a.ts", "x".repeat(500_001), "en")).degradedReason).toBe("too-large");
});

test("全文上限按 UTF-8 字节数生效，超限不保留源码", async () => {
  const file = await viewerFile("a.txt", "中".repeat(700_000), "en");
  expect(file.source).toBeNull();
  expect(file.degradedReason).toBe("too-large");
  const medium = "x".repeat(500_001);
  expect((await viewerFile("a.ts", medium, "en")).source).toBe(medium);
});
