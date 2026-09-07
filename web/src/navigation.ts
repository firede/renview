import type { SRow } from "../../src/analysis/types";

/** 行跳转请求（变更单元点击导航）：nonce 保证连续点同一单元也触发；newLn 优先，removed 单元只有 oldLn */
export interface LineJump {
  nonce: number;
  newLn?: number;
  oldLn?: number;
  oldRange?: [number, number];
  newRange?: [number, number];
  unitId?: string;
}

/** 行的定位行号：可见行取对应侧行号，折叠行取折叠段首行 */
function lineOf(r: SRow, side: "new" | "old"): number | null {
  if (r.kind === "ctx" || r.kind === "del" || r.kind === "add") {
    return (side === "new" ? r.newLn : r.oldLn) ?? null;
  }
  if (r.kind === "fold") {
    const lns = side === "new" ? r.newLns : r.oldLns;
    return lns && lns.length > 0 ? Math.min(...lns) : null;
  }
  return null;
}

/** 跳转目标行 → 行下标：首个不早于目标的行；目标晚于所有行时落最后一行 */
export function findRowIndex(rows: SRow[], jump: LineJump): number | null {
  const inside = (ln: number | undefined, range: [number, number] | undefined) =>
    ln != null && range != null && ln >= range[0] && ln <= range[1];
  if (jump.oldRange || jump.newRange) {
    const hit = (r: SRow) =>
      r.kind === "fold"
        ? r.oldLns?.some((ln) => inside(ln, jump.oldRange)) ||
          r.newLns?.some((ln) => inside(ln, jump.newRange))
        : inside(r.oldLn, jump.oldRange) || inside(r.newLn, jump.newRange);
    // 优先可见的实际增删，其次折叠的变更，最后才是声明内上下文。
    for (const predicate of [
      (r: SRow) => (r.kind === "add" || r.kind === "del") && r.text.trim() !== "",
      (r: SRow) => r.kind === "fold",
      (r: SRow) => r.kind === "ctx",
    ]) {
      const idx = rows.findIndex((r) => hit(r) && predicate(r));
      if (idx >= 0) return idx;
    }
    return null;
  }
  const side = jump.newLn != null ? "new" : "old";
  const target = jump.newLn ?? jump.oldLn;
  if (target == null) return null;
  let fallback: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const ln = lineOf(rows[i]!, side);
    if (ln == null) continue;
    const row = rows[i]!;
    if (row.kind === "fold") {
      const lns = side === "new" ? row.newLns : row.oldLns;
      if (lns?.includes(target)) return i;
    }
    if (ln >= target) return i;
    fallback = i;
  }
  return fallback;
}
