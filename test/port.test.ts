import { describe, expect, test } from "bun:test";
import { DEFAULT_PORT, listenWithPort } from "../src/port";

describe("服务端口选择", () => {
  const busy = () => Object.assign(new Error("端口已占用"), { code: "EADDRINUSE" });

  test("默认端口稳定，连续占用时递增，释放后回到默认端口", () => {
    const occupied = new Set<number>();
    const listen = (port: number) => {
      if (occupied.has(port)) throw busy();
      occupied.add(port);
      return port;
    };
    expect(listenWithPort(listen)).toBe(DEFAULT_PORT);
    expect(listenWithPort(listen)).toBe(DEFAULT_PORT + 1);
    expect(listenWithPort(listen)).toBe(DEFAULT_PORT + 2);
    occupied.delete(DEFAULT_PORT);
    expect(listenWithPort(listen)).toBe(DEFAULT_PORT);
  });

  test("显式端口占用时原样报错，不换端口", () => {
    const error = busy();
    const attempts: number[] = [];
    expect(() =>
      listenWithPort((port) => {
        attempts.push(port);
        throw error;
      }, 8123),
    ).toThrow(error);
    expect(attempts).toEqual([8123]);
  });

  test("非占用错误立即抛出", () => {
    const error = Object.assign(new Error("无权监听"), { code: "EACCES" });
    let attempts = 0;
    expect(() =>
      listenWithPort(() => {
        attempts++;
        throw error;
      }),
    ).toThrow(error);
    expect(attempts).toBe(1);
  });

  test("端口耗尽时停止，不越过有效范围", () => {
    let last = 0;
    expect(() =>
      listenWithPort((port) => {
        last = port;
        throw busy();
      }),
    ).toThrow();
    expect(last).toBe(65535);
  });
});
