import { describe, expect, test } from "bun:test";
import { defaultLandingIndex, isLowValuePath } from "../web/src/fileRank";

describe("isLowValuePath", () => {
  test("锁文件按文件名识别，大小写不敏感", () => {
    expect(isLowValuePath("bun.lock")).toBe(true);
    expect(isLowValuePath("sub/dir/package-lock.json")).toBe(true);
    expect(isLowValuePath("Cargo.lock")).toBe(true);
    expect(isLowValuePath("Package.resolved")).toBe(true);
  });

  test("生成产物按文件名与目录特征识别", () => {
    expect(isLowValuePath("src/webassets.gen.ts")).toBe(true);
    expect(isLowValuePath("app/src/routeTree.gen.ts")).toBe(true);
    expect(isLowValuePath("types/api.d.ts")).toBe(true);
    expect(isLowValuePath("web/dist/assets/index.js")).toBe(true);
    expect(isLowValuePath("test/__snapshots__/a.snap")).toBe(true);
  });

  test("普通源码与配置不误判", () => {
    expect(isLowValuePath("src/server.ts")).toBe(false);
    expect(isLowValuePath("package.json")).toBe(false);
    expect(isLowValuePath("languages.json")).toBe(false);
    expect(isLowValuePath("distribution/notes.md")).toBe(false);
    expect(isLowValuePath("README.md")).toBe(false);
  });
});

describe("defaultLandingIndex", () => {
  const f = (path: string, signatureChanges = 0, unitCount = 0) => ({
    path,
    signatureChanges,
    unitCount,
  });

  test("首个含签名变更的文件优先", () => {
    const files = [f("bun.lock"), f("README.md"), f("src/a.ts", 0, 2), f("src/b.ts", 1, 1)];
    expect(defaultLandingIndex(files)).toBe(3);
  });

  test("无签名变更时取首个有声明级变更的文件", () => {
    const files = [f("bun.lock"), f("README.md"), f("src/a.ts", 0, 2)];
    expect(defaultLandingIndex(files)).toBe(2);
  });

  test("无声明级变更时跳过低价值文件", () => {
    expect(defaultLandingIndex([f("bun.lock"), f("README.md")])).toBe(1);
  });

  test("全是低价值文件或列表为空时落到第一个", () => {
    expect(defaultLandingIndex([f("bun.lock"), f("yarn.lock")])).toBe(0);
    expect(defaultLandingIndex([])).toBe(0);
  });

  test("低价值文件即使有签名变更也不作为落地", () => {
    const files = [f("src/x.gen.ts", 3, 3), f("src/y.ts", 0, 1)];
    expect(defaultLandingIndex(files)).toBe(1);
  });
});
