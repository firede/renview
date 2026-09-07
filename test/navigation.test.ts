import { expect, test } from "bun:test";
import { findRowIndex } from "../web/src/navigation";
import type { SRow } from "../src/analysis/types";

test("函数开头不在 diff 中时定位实际新增行，而非 hunk 上下文", () => {
  const rows: SRow[] = [
    { kind: "ctx", text: "root.add_child(wave_progress)", oldLn: 222, newLn: 207 },
    { kind: "add", text: "for i in range(ITEMS.size()):", newLn: 210 },
  ];
  expect(
    findRowIndex(rows, { nonce: 1, newLn: 180, newRange: [180, 350], oldRange: [195, 365] }),
  ).toBe(1);
});

test("函数仅删除实现时使用旧侧，且不越界定位其他函数", () => {
  const rows: SRow[] = [
    { kind: "ctx", text: "func f():", oldLn: 10, newLn: 10 },
    { kind: "del", text: "  removed()", oldLn: 11 },
    { kind: "add", text: "func other():", newLn: 20 },
  ];
  expect(findRowIndex(rows, { nonce: 1, newRange: [10, 12], oldRange: [10, 13] })).toBe(1);
  expect(findRowIndex(rows, { nonce: 2, newRange: [30, 40] })).toBeNull();
});

test("隐藏变更定位其折叠摘要，范围内空行不会抢占目标", () => {
  const rows: SRow[] = [
    { kind: "add", text: "", newLn: 2 },
    {
      kind: "fold",
      count: 2,
      oldLines: ["type A = number"],
      newLines: ["type A = string"],
      oldLns: [3],
      newLns: [3],
    },
  ];
  expect(findRowIndex(rows, { nonce: 1, newRange: [1, 4] })).toBe(1);
});
