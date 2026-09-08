import { afterAll, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSideContent } from "../src/git";
import { InvalidRepoPathError, readRepoSource, safeRepoPath } from "../src/repo-path";
import { handleFile, handleReviewFile } from "../src/server";

const dir = mkdtempSync(join(tmpdir(), "renview-path-"));
const root = join(dir, "repo");
mkdirSync(root);
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const git = (...args: string[]) => {
  const p = Bun.spawnSync(["git", "-C", root, ...args]);
  if (p.exitCode) throw new Error(p.stderr.toString());
};
git("init", "-q");
git("config", "user.email", "test@example.com");
git("config", "user.name", "测试");
writeFileSync(join(dir, "outside"), "仓外内容不得读取");
writeFileSync(join(root, "normal.ts"), "const n = 1;\n");
writeFileSync(join(root, "removed.ts"), "const removed = true;\n");
symlinkSync("../outside", join(root, "linked.ts"));
symlinkSync(".git/config", join(root, "config-link"));
symlinkSync(".git", join(root, "git-alias"));
symlinkSync("..", join(root, "outside-dir"));
git("add", "normal.ts", "removed.ts", "linked.ts");
git("commit", "-qm", "文件与链接");
rmSync(join(root, "normal.ts"));
symlinkSync("../outside", join(root, "normal.ts"));
rmSync(join(root, "removed.ts"));
rmSync(join(root, "linked.ts"));
symlinkSync("normal.ts", join(root, "linked.ts"));

test("拒绝路径穿越、绝对路径及 Git 管理目录变体", async () => {
  for (const path of [
    "../outside",
    "/outside",
    "C:\\outside",
    "\\\\server\\share",
    ".git/config",
    ".GIT/config",
    "nested/.Git/config",
    "x\0.ts",
  ]) {
    expect(safeRepoPath(root, path)).toBeNull();
    expect(await getSideContent(root, { type: "worktree" }, path)).toBeNull();
  }
  for (const path of ["outside-dir/outside", "git-alias/config"]) {
    await expect(readRepoSource(root, path)).rejects.toBeInstanceOf(InvalidRepoPathError);
    expect((await handleFile(root, path, "en")).status).toBe(400);
    expect(await getSideContent(root, { type: "worktree" }, path)).toBeNull();
  }
});

test("最终链接及链接链只返回链接文本，不读取目标", async () => {
  for (const [path, value] of [
    ["normal.ts", "../outside"],
    ["linked.ts", "normal.ts"],
    ["config-link", ".git/config"],
  ]) {
    expect(await readRepoSource(root, path!)).toBe(value!);
    expect(await getSideContent(root, { type: "worktree" }, path!)).toBe(value!);
    const response = await handleFile(root, path!, "en");
    expect((await response.json()).file.source).toBe(value!);
  }
  const response = await handleReviewFile(root, ["HEAD"], "linked.ts", "en");
  const body = await response.json();
  expect(body.oldFile.source).toBe("../outside");
  expect(body.newFile.source).toBe("normal.ts");
});

test("历史和暂存内容不受工作区链接或文件删除影响", async () => {
  for (const side of [{ type: "rev" as const, rev: "HEAD" }, { type: "index" as const }]) {
    expect(await getSideContent(root, side, "linked.ts")).toBe("../outside");
    expect(await getSideContent(root, side, "normal.ts")).toBe("const n = 1;\n");
    expect(await getSideContent(root, side, "removed.ts")).toBe("const removed = true;\n");
  }
});

test("仓库根别名和合法特殊文件名正常读取，不二次解码百分号", async () => {
  const alias = join(dir, "alias");
  symlinkSync(root, alias);
  for (const path of [
    "中文 文件.ts",
    "with\ttab.ts",
    "with\nnewline.ts",
    "%2e%2e",
    "ordinary.ts",
  ]) {
    writeFileSync(join(root, path), "const n = 2;\n");
    expect(await readRepoSource(alias, path)).toBe("const n = 2;\n");
  }
});

test("校验后父目录被替换为仓外链接时拒绝读取", async () => {
  const parent = join(root, "race-dir");
  const outside = join(dir, "outside-race");
  mkdirSync(parent);
  mkdirSync(outside);
  writeFileSync(join(parent, "file.ts"), "const safe = true;");
  writeFileSync(join(outside, "file.ts"), "仓外内容不得读取");
  const originalOpen = fsp.open;
  const mock = spyOn(fsp, "open").mockImplementationOnce(
    async (...args: Parameters<typeof fsp.open>) => {
      await fsp.rename(parent, parent + "-saved");
      await fsp.symlink(outside, parent);
      return originalOpen(...args);
    },
  );
  try {
    await expect(readRepoSource(root, "race-dir/file.ts")).rejects.toBeInstanceOf(
      InvalidRepoPathError,
    );
  } finally {
    mock.mockRestore();
  }
});
