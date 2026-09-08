import { expect, test } from "bun:test";
import { Analyzer } from "../app/server/analysis";
import type { ViewerFile } from "../src/analysis/types";

test("独立 worker 正确加载 WASM 并复用共享查看器分析", async () => {
  const analyzer = new Analyzer();
  try {
    const file = await analyzer.run<ViewerFile>({
      kind: "file",
      path: "a.ts",
      source: "export function fee(n: number): number { return n * 2; }",
      locale: "zh-CN",
    });
    expect(file.degradedReason).toBeUndefined();
    expect(file.outline[0]?.name).toBe("fee");
    expect(file.simplified?.[0]).not.toContain(": number");
    const java = await analyzer.run<ViewerFile>({
      kind: "file",
      path: "Order.java",
      source: "public record Order(Money total) {}",
      locale: "zh-CN",
    });
    expect(java.degradedReason).toBeUndefined();
    expect(java.outline[0]?.name).toBe("Order");
    expect(java.simplified?.[0]).toBe("record Order(Money total) {}");
  } finally {
    analyzer.close();
  }
});
