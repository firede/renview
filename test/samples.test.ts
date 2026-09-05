import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse as parseToml } from "smol-toml";
import { analyzeEntry, loadChangeset } from "../scripts/samples";

/**
 * samples 健康测试：策展样例供 www 演示等场景复用，此处锁定每个样例文件
 * 经真实管线（scripts/samples.ts 的 analyzeEntry）产出的单元类型与关键折叠特征，
 * 防止演示叙事随实现演进静默漂移。目录约定见 scripts/samples.ts 头注释。
 */

describe("samples/demo 变更集", () => {
  const dir = "samples/demo";
  const entries = loadChangeset(dir);
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const manifest = parseToml(readFileSync(`${dir}/changeset.toml`, "utf8")) as unknown as {
    featured?: string;
    order?: string[];
  };

  test("清单：featured 存在，order 覆盖全部样例文件", () => {
    const paths = entries.map((e) => e.path);
    expect(manifest.featured).toBe("src/pricing.rs");
    expect(paths).toContain(manifest.featured!);
    expect([...(manifest.order ?? [])].sort()).toEqual([...paths].sort());
  });

  test("src/pricing.rs：签名 + 类型两个单元，简化视图有折叠", async () => {
    const a = await analyzeEntry(byPath.get("src/pricing.rs")!);
    const units = a.projection.units.map((u) => [u.name, u.change]);
    expect(units).toHaveLength(2);
    expect(units).toContainEqual(["total", "signature"]);
    expect(units).toContainEqual(["LineItem", "type-only"]);
    expect(a.simplified!.stats.folded).toBeGreaterThan(0);
    expect(a.simplified!.stats.visible).toBeGreaterThan(0);
  });

  test("src/notify.go：单个 body 单元，新增 if-err 折叠为单行标记", async () => {
    const a = await analyzeEntry(byPath.get("src/notify.go")!);
    expect(a.projection.units.map((u) => [u.name, u.change])).toEqual([
      ["SendOrderConfirmation", "body"],
    ]);
    const texts = a.simplified!.rows.map((r) => ("text" in r ? r.text : ""));
    expect(texts.some((t) => t.includes("if err: return"))).toBe(true);
  });

  test("src/gift.ts：整文件一个 added 单元，签名类型被擦除", async () => {
    const a = await analyzeEntry(byPath.get("src/gift.ts")!);
    expect(a.projection.units).toHaveLength(1);
    expect(a.projection.units[0]).toMatchObject({ name: "giftWrapFee", change: "added" });
    const rows = a.simplified!.rows;
    expect(rows.every((r) => r.kind === "add")).toBe(true);
    expect(rows[0] && "text" in rows[0] ? rows[0].text : "").toBe(
      "export function giftWrapFee(items) {",
    );
  });

  test("www 演示数据新鲜度：demo-data.gen.ts 与重生成一致", async () => {
    const { generateDemoModule } = await import("../scripts/gen-demo");
    expect(await generateDemoModule()).toBe(readFileSync("www/src/lib/demo-data.gen.ts", "utf8"));
  });
});
