import { expect, test } from "bun:test";
import { mapConcurrent } from "../src/concurrency";

test("并发受限，乱序完成仍保持输入顺序", async () => {
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const task = mapConcurrent([0, 1, 2, 3], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await new Promise<void>((resolve) => {
      releases[value] = resolve;
    });
    active--;
    return value * 2;
  });
  expect(active).toBe(2);
  releases[1]!();
  await Bun.sleep(0);
  expect(releases[2]).toBeDefined();
  releases[2]!();
  await Bun.sleep(0);
  releases[3]!();
  releases[0]!();
  expect(await task).toEqual([0, 2, 4, 6]);
  expect(peak).toBe(2);
});

test("失败后停止调度剩余任务", async () => {
  const started: number[] = [];
  await expect(
    mapConcurrent([0, 1, 2], 1, async (value) => {
      started.push(value);
      throw new Error("失败");
    }),
  ).rejects.toThrow("失败");
  expect(started).toEqual([0]);
});
