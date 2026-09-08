import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "../src/cli-args";
import pkg from "../package.json";
import { messages } from "../src/i18n";

const m = messages("en");
const cli = resolve(import.meta.dir, "../src/cli.ts");

test("目录选项支持长短形式、等号和空格路径，保留 diff 参数", () => {
  for (const args of [["--cwd", "../my repo"], ["-C", "../my repo"], ["--cwd=../my repo"]]) {
    expect(parseArgs([...args, "--no-open", "diff", "main...HEAD", "--", "src/"], m)).toEqual({
      command: "diff",
      version: undefined,
      cwd: "../my repo",
      open: false,
      port: undefined,
      gitArgs: ["main...HEAD", "--", "src/"],
    });
  }
  expect(parseArgs([], m).cwd).toBeUndefined();
  expect(parseArgs(["diff", "--", "--cwd", "-C", "--help"], m).gitArgs).toEqual([
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
  const proc = Bun.spawn(
    [process.execPath, cli, "-C", "my repo/src", "--no-open", "diff", "main...HEAD"],
    {
      cwd: dir,
      env: { ...process.env, XDG_CONFIG_HOME: dir, RENVIEW_DISABLE_UPDATE_CHECK: "1" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
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

test("无效 diff 参数在启动服务前退出，终端保留 Git 错误且不输出堆栈", async () => {
  const dir = mkdtempSync(join(tmpdir(), "renview-cli-invalid-diff-"));
  Bun.spawnSync(["git", "init", "-q", "-b", "main", dir]);
  Bun.spawnSync([
    "git",
    "-C",
    dir,
    "-c",
    "user.name=测试",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--allow-empty",
    "-qm",
    "初始化",
  ]);
  try {
    for (const args of [["main...HE"], ["--not-a-real-diff-option"]]) {
      const proc = Bun.spawn([process.execPath, cli, "-C", dir, "--no-open", "diff", ...args], {
        env: {
          ...process.env,
          XDG_CONFIG_HOME: dir,
          RENVIEW_DISABLE_UPDATE_CHECK: "1",
          LC_ALL: "en_US.UTF-8",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const timer = setTimeout(() => proc.kill(), 3000);
      try {
        const [code, output, error] = await Promise.all([
          proc.exited,
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ]);
        expect(code).toBe(1);
        expect(output).not.toContain("http://");
        expect(error).toContain("git diff failed:");
        expect(error).not.toContain("at main");
      } finally {
        clearTimeout(timer);
        proc.kill();
        await proc.exited;
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 10000);

test("裸命令与显式 diff 相同，子命令后保留 Git 选项和同名分支", () => {
  expect(parseArgs([], m)).toEqual(parseArgs(["diff"], m));
  const args = ["-p", "upgrade", "--", "--no-open", "--help", "-C"];
  expect(parseArgs(["--port", "8080", "--no-open", "diff", ...args], m)).toEqual({
    command: "diff",
    version: undefined,
    port: 8080,
    open: false,
    cwd: undefined,
    gitArgs: args,
  });
  expect(parseArgs(["diff", "up"], m).gitArgs).toEqual(["up"]);
});

test("未知命令和旧写法不再作为 Git 参数，升级参数不被吞掉", () => {
  expect(() => parseArgs(["up"], m)).toThrow("Did you mean renview upgrade?");
  expect(() => parseArgs(["main...HEAD"], m)).toThrow("Unknown command");
  for (const args of [["--staged"], ["-p", "8080"], ["--", "src/"]]) {
    expect(() => parseArgs(args, m)).toThrow("Unknown option");
  }
  expect(parseArgs(["upgrade"], m).command).toBe("upgrade");
  expect(parseArgs(["upgrade", "0.0.11"], m).version).toBe("0.0.11");
  expect(() => parseArgs(["upgrade", "0.0.11", "extra"], m)).toThrow("Usage:");
});

test("仓库外的命令错误和帮助不触发 Git 检测或升级", async () => {
  const dir = mkdtempSync(join(tmpdir(), "renview-cli-commands-"));
  try {
    for (const [args, code, expected] of [
      [["up"], 1, "Did you mean renview upgrade?"],
      [["upgrade", "0.0.11", "extra"], 1, "Usage:"],
      [["upgrade", "--help"], 0, "Usage:"],
      [["--help"], 0, "diff [<git diff args>...]"],
      [["--version"], 0, pkg.version],
    ] as const) {
      const proc = Bun.spawn([process.execPath, cli, ...args], {
        cwd: dir,
        env: {
          ...process.env,
          XDG_CONFIG_HOME: dir,
          LC_ALL: "en_US.UTF-8",
          RENVIEW_DISABLE_UPDATE_CHECK: "1",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [actual, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      expect(actual).toBe(code);
      expect(stdout + stderr).toContain(expected);
      expect(stdout + stderr).not.toContain("Not inside a git repository");
      expect(stderr).not.toContain("at main");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
