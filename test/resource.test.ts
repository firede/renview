import { describe, expect, spyOn, test } from "bun:test";
import { createResourceLoader, type ResourceState } from "../web/src/resource";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

type Payload = { ok: boolean; value: string };

describe("资源请求", () => {
  test("慢文件 A 不覆盖快文件 B，切换时清除 A 的正文", async () => {
    const slow = deferred<Response>();
    const fetched = spyOn(globalThis, "fetch")
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(Response.json({ ok: true, value: "B" }))
      .mockResolvedValueOnce(Response.json({ ok: true, value: "A" }));
    const states: ResourceState<Payload>[] = [];
    const loader = createResourceLoader<Payload>((s) => states.push(s));
    try {
      const a = loader.load("/a");
      await loader.load("/b");
      expect(states.at(-1)?.data?.value).toBe("B");
      const count = states.length;
      slow.resolve(Response.json({ ok: true, value: "A" }));
      await a;
      expect(states).toHaveLength(count);
      expect(states.at(-1)?.loading).toBe(false);
      const next = loader.load("/a");
      expect(states.at(-1)?.data).toBeNull();
      await next;
    } finally {
      fetched.mockRestore();
    }
  });

  test("已开始解析 JSON 的旧响应也不能发布，卸载后不更新", async () => {
    const body = deferred<Payload>();
    const fetched = spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => body.promise,
    } as Response);
    const states: ResourceState<Payload>[] = [];
    const loader = createResourceLoader<Payload>((s) => states.push(s));
    try {
      const pending = loader.load("/a");
      await Promise.resolve();
      loader.cancel();
      body.resolve({ ok: true, value: "已取消" });
      await pending;
      expect(states).toHaveLength(1);
    } finally {
      fetched.mockRestore();
    }
  });

  test("HTTP、业务、网络错误可见，重试可以恢复", async () => {
    const fetched = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ ok: false, error: "文件不存在" }, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ ok: false, error: "分析失败" }))
      .mockRejectedValueOnce(new Error("离线"))
      .mockResolvedValueOnce(Response.json({ ok: true, value: "恢复" }));
    let state: ResourceState<Payload> | undefined;
    const loader = createResourceLoader<Payload>((s) => {
      state = s;
    });
    try {
      await loader.load("/a");
      expect(state?.error).toBe("文件不存在");
      expect(state?.unreachable).toBe(false);
      await loader.load("/a");
      expect(state?.error).toBe("分析失败");
      await loader.load("/a");
      expect(state?.unreachable).toBe(true);
      await loader.load("/a");
      expect(state?.data?.value).toBe("恢复");
      expect(state?.error).toBeNull();
      expect(state?.loading).toBe(false);
    } finally {
      fetched.mockRestore();
    }
  });

  test("旧请求的错误不覆盖新请求成功状态", async () => {
    const slow = deferred<Response>();
    const fetched = spyOn(globalThis, "fetch")
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(Response.json({ ok: true, value: "新" }));
    let state: ResourceState<Payload> | undefined;
    const loader = createResourceLoader<Payload>((s) => {
      state = s;
    });
    try {
      const old = loader.load("/a");
      await loader.load("/a");
      slow.reject(new Error("过期错误"));
      await old;
      expect(state?.data?.value).toBe("新");
      expect(state?.error).toBeNull();
    } finally {
      fetched.mockRestore();
    }
  });
});
