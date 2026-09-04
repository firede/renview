import { describe, expect, test } from "bun:test";
import { decorateLine } from "../web/src/lineDecor";

/** 取零宽删除点段（mark） */
function markSeg(text: string, col: number) {
  const segs = decorateLine(text, null, { erases: [{ start: col, end: col, original: ": T" }] });
  return segs.find((s) => s.erasure?.kind === "mark");
}

describe("decorateLine 擦除锚定", () => {
  test("删除点锚定前侧紧邻标识符", () => {
    const segs = decorateLine("const x = a;", null, {
      erases: [{ start: 7, end: 7, original: ": number" }],
    });
    const adj = segs.find((s) => s.erasure?.kind === "adj");
    expect(adj?.text).toBe("x");
    expect(adj?.erasure?.original).toBe(": number");
  });

  test("替换段覆盖替换文本", () => {
    const segs = decorateLine("a?.b;", null, {
      erases: [{ start: 1, end: 3, original: "?." }],
    });
    const repl = segs.find((s) => s.erasure?.kind === "repl");
    expect(repl?.text).toBe("?.");
  });

  test("tick 居中到空白间隙：落点偏左（`)" + " `后）右移，偏右（` {`前）左移", () => {
    // "f(items) {"：`)"=7，间隙空格=8，`{`=9
    expect(markSeg("f(items) {", 8)?.erasure?.offsetCh).toBe(0.5);
    expect(markSeg("f(items) {", 9)?.erasure?.offsetCh).toBe(-0.5);
  });

  test("已在间隙中央不产生偏移", () => {
    expect(markSeg("a  b", 2)?.erasure?.offsetCh).toBeUndefined();
  });

  test("两侧无空白不偏移", () => {
    expect(markSeg("ab", 1)?.erasure?.offsetCh).toBeUndefined();
  });

  test("宽间隙居中到正中央", () => {
    // ")   {"：mark 在 1，间隙 3 空格 → +1.5
    expect(markSeg(")   {", 1)?.erasure?.offsetCh).toBe(1.5);
  });
});
