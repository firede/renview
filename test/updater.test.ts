import { afterAll, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import { join } from "node:path";
import { messages } from "../src/i18n";
import {
  checkForUpdate,
  compareVersions,
  detectInstallMethod,
  runScriptInstaller,
} from "../src/updater";

const tmpdirs: string[] = [];

function makeTmp(): string {
  const dir = fs.mkdtempSync(join(os.tmpdir(), "renview-updater-test-"));
  tmpdirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const d of tmpdirs) fs.rmSync(d, { recursive: true, force: true });
});

describe("compareVersions", () => {
  test("按 major/minor/patch 数字序比较", () => {
    expect(compareVersions("0.2.0", "0.1.9")).toBe(1);
    expect(compareVersions("1.0.0", "0.99.99")).toBe(1);
    expect(compareVersions("0.1.0", "0.1.1")).toBe(-1);
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBe(-1);
  });

  test("无法识别的版本不触发升级提示", () => {
    expect(compareVersions("abc", "0.1.0")).toBe(0);
    expect(compareVersions("0.1.0", "")).toBe(0);
  });
});

describe("detectInstallMethod", () => {
  test("~/.renview/bin 下为安装脚本（含 Windows 路径风格）", () => {
    expect(detectInstallMethod("/home/u/.renview/bin/renview", "/home/u")).toBe("script");
    expect(detectInstallMethod("C:\\Users\\u\\.renview\\bin\\renview.exe", "C:\\Users\\u")).toBe(
      "script",
    );
  });

  test("各包管理器全局目录按路径特征区分", () => {
    expect(
      detectInstallMethod(
        "/Users/u/.bun/install/global/node_modules/renview/bin/renview.exe",
        "/Users/u",
      ),
    ).toBe("bun");
    expect(
      detectInstallMethod(
        "/Users/u/Library/pnpm/global/5/node_modules/renview/bin/renview.exe",
        "/Users/u",
      ),
    ).toBe("pnpm");
    expect(
      detectInstallMethod(
        "/home/u/.config/yarn/global/node_modules/renview/bin/renview.exe",
        "/home/u",
      ),
    ).toBe("yarn");
    expect(
      detectInstallMethod("/usr/local/lib/node_modules/renview/bin/renview.exe", "/home/u"),
    ).toBe("npm");
  });

  test("非 renview 命名的二进制（源码/构建产物直跑）判为 unknown", () => {
    expect(detectInstallMethod("/opt/homebrew/bin/bun", "/Users/u")).toBe("unknown");
    expect(
      detectInstallMethod("/Users/u/Studio/renview/dist/renview-darwin-arm64", "/Users/u"),
    ).toBe("unknown");
  });
});

describe("checkForUpdate 被动提示", () => {
  async function captureLogs(fn: () => Promise<void>): Promise<string[]> {
    const orig = console.log;
    const lines: string[] = [];
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      await fn();
    } finally {
      console.log = orig;
    }
    return lines;
  }

  function freshCache(dir: string, latest: string): NodeJS.ProcessEnv {
    fs.mkdirSync(join(dir, "renview"), { recursive: true });
    fs.writeFileSync(
      join(dir, "renview", "update-check.json"),
      JSON.stringify({ lastCheck: Date.now(), latest }),
    );
    return { XDG_CONFIG_HOME: dir };
  }

  test("缓存里有更新版本时提示一行", async () => {
    const lines = await captureLogs(() =>
      checkForUpdate("0.1.0", messages("zh-CN"), freshCache(makeTmp(), "0.2.0")),
    );
    expect(lines).toEqual(["发现新版本 v0.2.0（当前 v0.1.0），运行 renview upgrade 升级"]);
  });

  test("缓存版本不高于当前时不提示", async () => {
    for (const latest of ["0.1.0", "0.0.9"]) {
      const lines = await captureLogs(() =>
        checkForUpdate("0.1.0", messages("en"), freshCache(makeTmp(), latest)),
      );
      expect(lines).toEqual([]);
    }
  });

  test("缓存损坏时静默跳过，不抛错不提示", async () => {
    const dir = makeTmp();
    fs.mkdirSync(join(dir, "renview"), { recursive: true });
    fs.writeFileSync(join(dir, "renview", "update-check.json"), "not json");
    // lastCheck 缺失会触发后台刷新；RENVIEW_REGISTRY 指向不可达地址确保 fetch 快速失败且静默
    const env = { XDG_CONFIG_HOME: dir, RENVIEW_REGISTRY: "http://127.0.0.1:1" };
    const lines = await captureLogs(() => checkForUpdate("0.1.0", messages("en"), env));
    expect(lines).toEqual([]);
  });
});

describe("升级脚本生命周期", () => {
  function mockDownload(run: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>) {
    return spyOn(globalThis, "fetch").mockImplementation(run as typeof fetch);
  }

  test("并发运行使用不同私有目录，保留参数并在结束后清理", async () => {
    const dir = makeTmp();
    let release: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const download = mockDownload(async () => {
      if (++calls === 2) release!();
      await ready;
      const folders = fs.readdirSync(dir);
      expect(folders).toHaveLength(2);
      if (process.platform !== "win32") {
        for (const folder of folders)
          expect(fs.statSync(join(dir, folder)).mode & 0o777).toBe(0o700);
      }
      return new Response(
        '[ "$1" = "--version" ] && [ "$2" = "1.2.3" ] && [ "$3" = "--no-modify-path" ]',
      );
    });
    try {
      expect(
        await Promise.all([runScriptInstaller("1.2.3", dir), runScriptInstaller("1.2.3", dir)]),
      ).toEqual([0, 0]);
      expect(fs.readdirSync(dir)).toEqual([]);
    } finally {
      download.mockRestore();
    }
  });

  test("HTTP、下载、响应体失败均清理临时目录", async () => {
    for (const failure of ["http", "fetch", "body"]) {
      const dir = makeTmp();
      const download = mockDownload(async () => {
        if (failure === "fetch") throw new Error("下载失败");
        if (failure === "http") return new Response(null, { status: 503 });
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("响应体失败"));
            },
          }),
        );
      });
      try {
        await expect(runScriptInstaller("1.2.3", dir)).rejects.toThrow();
        expect(fs.readdirSync(dir)).toEqual([]);
      } finally {
        download.mockRestore();
      }
    }
  });

  test("写入与启动失败清理目录，子进程非零退出保留退出码", async () => {
    const dir = makeTmp();
    const download = mockDownload(async () => new Response("exit 7"));
    try {
      const write = spyOn(Bun, "write").mockRejectedValueOnce(new Error("写入失败"));
      try {
        await expect(runScriptInstaller("1.2.3", dir)).rejects.toThrow("写入失败");
      } finally {
        write.mockRestore();
      }
      expect(fs.readdirSync(dir)).toEqual([]);
      const spawn = spyOn(Bun, "spawn").mockImplementationOnce(() => {
        throw new Error("启动失败");
      });
      try {
        await expect(runScriptInstaller("1.2.3", dir)).rejects.toThrow("启动失败");
      } finally {
        spawn.mockRestore();
      }
      expect(fs.readdirSync(dir)).toEqual([]);
      expect(await runScriptInstaller("1.2.3", dir)).toBe(7);
      expect(fs.readdirSync(dir)).toEqual([]);
    } finally {
      download.mockRestore();
    }
  });

  test("下载超时覆盖响应体读取，取消后清理目录", async () => {
    const dir = makeTmp();
    let bodyStarted = false;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        return new Response(
          new ReadableStream({
            start(controller) {
              bodyStarted = true;
              controller.enqueue(new TextEncoder().encode("# 尚未传完"));
            },
          }),
        );
      },
    });
    const fetchOriginal = globalThis.fetch;
    const timeoutOriginal = AbortSignal.timeout;
    const signal = timeoutOriginal(100);
    const timeout = spyOn(AbortSignal, "timeout").mockImplementationOnce(() => signal);
    const download = mockDownload((_url, options) =>
      fetchOriginal(`http://127.0.0.1:${server.port}`, options),
    );
    try {
      await expect(runScriptInstaller("1.2.3", dir)).rejects.toThrow();
      expect(bodyStarted).toBe(true);
      expect(signal.aborted).toBe(true);
      expect(timeout).toHaveBeenCalledWith(15_000);
      expect(fs.readdirSync(dir)).toEqual([]);
    } finally {
      download.mockRestore();
      timeout.mockRestore();
      server.stop(true);
    }
  });
});
