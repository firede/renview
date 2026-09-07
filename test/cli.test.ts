import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "../src/cli";
import { messages } from "../src/i18n";

const m = messages("en");
const cli = resolve(import.meta.dir, "../src/cli.ts");

test("目录选项支持长短形式、等号和空格路径，保留 diff 参数", () => {
  for (const args of [["--cwd", "../my repo"], ["-C", "../my repo"], ["--cwd=../my repo"]]) {
    expect(parseArgs([...args, "--no-open", "main...HEAD", "--", "src/"], m)).toEqual({
      cwd: "../my repo",
      open: false,
      port: undefined,
      gitArgs: ["main...HEAD", "--", "src/"],
    });
  }
  expect(parseArgs([], m).cwd).toBeUndefined();
  expect(parseArgs(["--", "--cwd", "-C", "--help"], m).gitArgs).toEqual([
    "--",
    "--cwd",
    "-C",
    "--help",
  ]);
});

test("缺失目录、无效目录与非仓库目录明确失败", async () => {
  const dir = mkdtempSync(join(tmpdir(), "renview-cli-"));
  writeFileSync(join(dir, "file"), "");
  try {
    for (const args of [
      ["--cwd"],
      ["-C", "--no-open"],
      ["--cwd="],
      ["-C", join(dir, "missing")],
      ["-C", join(dir, "file")],
      ["-C", dir],
    ]) {
      const proc = Bun.spawn([process.execPath, cli, ...args], {
        env: {
          ...process.env,
          XDG_CONFIG_HOME: dir,
          RENVIEW_DISABLE_UPDATE_CHECK: "1",
          LC_ALL: "en_US.UTF-8",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [code, error] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
      expect(code).toBe(1);
      expect(error).toMatch(
        /requires a directory path|Cannot access directory|Not inside a git repository/,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("从仓库外以相对子目录启动，API 使用目标仓库和区间", async () => {
  const dir = mkdtempSync(join(tmpdir(), "renview-cli-"));
  const repo = join(dir, "my repo");
  mkdirSync(join(repo, "src"), { recursive: true });
  Bun.spawnSync(["git", "init", "-q", "-b", "main", repo]);
  Bun.spawnSync([
    "git",
    "-C",
    repo,
    "-c",
    "user.name=测试",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "初始化",
  ]);
  const proc = Bun.spawn([process.execPath, cli, "-C", "my repo/src", "--no-open", "main...HEAD"], {
    cwd: dir,
    env: { ...process.env, XDG_CONFIG_HOME: dir, RENVIEW_DISABLE_UPDATE_CHECK: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => proc.kill(), 5000);
  try {
    let output = "";
    for await (const chunk of proc.stdout) {
      output += new TextDecoder().decode(chunk);
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (!url) continue;
      const response = await fetch(url + "/api/diff");
      const data = (await response.json()) as { ok: boolean; repoRoot: string; diffArgs: string[] };
      expect(data.ok).toBe(true);
      expect(data.repoRoot).toBe(realpathSync(repo));
      expect(data.diffArgs).toEqual(["main...HEAD"]);
      return;
    }
    throw new Error("CLI 未成功启动：" + output + (await new Response(proc.stderr).text()));
  } finally {
    clearTimeout(timer);
    proc.kill();
    await proc.exited;
    rmSync(dir, { recursive: true, force: true });
  }
}, 10000);
