import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_SOURCE_BYTES,
  readSourceFile,
  readSourceStream,
  SourceTooLargeError,
} from "../src/source";
import { getSideContent } from "../src/git";
import { handleFile, handleReviewFile } from "../src/server";

const dir = mkdtempSync(join(tmpdir(), "renview-source-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const git = (...args: string[]) => {
  const proc = Bun.spawnSync(["git", "-C", dir, ...args]);
  if (proc.exitCode) throw new Error(proc.stderr.toString());
};
git("init", "-q");
git("config", "user.email", "test@example.com");
git("config", "user.name", "测试");
const large = "x".repeat(MAX_SOURCE_BYTES + 1);
writeFileSync(join(dir, "large.ts"), large);
git("add", ".");
git("commit", "-qm", "大文件");

test("流读取按字节限制并取消上游，保留跨块 UTF-8", async () => {
  const bytes = new TextEncoder().encode("中文");
  const text = await readSourceStream(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1));
        controller.close();
      },
    }),
  );
  expect(text).toBe("中文");
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(100_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(readSourceStream(stream)).rejects.toBeInstanceOf(SourceTooLargeError);
  expect(cancelled).toBe(true);
});

test("工作区、暂存区与历史版本均拒绝超限全文", async () => {
  await expect(readSourceFile(join(dir, "large.ts"))).rejects.toBeInstanceOf(SourceTooLargeError);
  for (const side of [
    { type: "worktree" as const },
    { type: "index" as const },
    { type: "rev" as const, rev: "HEAD" },
  ]) {
    await expect(getSideContent(dir, side, "large.ts")).rejects.toBeInstanceOf(SourceTooLargeError);
  }
});

test("浏览与审阅上下文返回过大占位，不携带全文", async () => {
  const response = await handleFile(dir, "large.ts", "en");
  expect(response.status).toBe(200);
  expect((await response.json()).file).toMatchObject({ source: null, degradedReason: "too-large" });
  writeFileSync(join(dir, "large.ts"), "const small = 1;\n");
  try {
    const context = await (await handleReviewFile(dir, ["HEAD"], "large.ts", "en")).json();
    expect(context.oldFile).toMatchObject({ source: null, degradedReason: "too-large" });
    expect(context.newFile.source).toBe("const small = 1;\n");
  } finally {
    writeFileSync(join(dir, "large.ts"), large);
  }
});

test("缺失文件返回 JSON 错误", async () => {
  const response = await handleFile(dir, "missing.ts", "en");
  expect(response.status).toBe(404);
  expect((await response.json()).ok).toBe(false);
});
