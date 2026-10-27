import test from "node:test";
import assert from "node:assert/strict";
import { splitColumnRows } from "../../src/server/imports/text-columns";
import type { TextLine } from "../../src/server/imports/layout";
const line = (text: string, x: number, y: number): TextLine => ({
  text,
  x,
  y,
  width: 240,
  height: 14,
  page: 1,
  method: "text",
  confidence: null,
});
test("OCR-014: repeated headings on both halves survive same-baseline joining; options alone do not split a page", () => {
  const rows = [
    [line("12. Right top?", 330, 20), line("24. Left top?", 40, 20)],
    [line("1) Right option", 330, 50), line("1) Left option", 40, 50)],
    [line("19. Right bottom?", 330, 250), line("31. Left bottom?", 40, 250)],
  ];
  assert.equal(splitColumnRows(rows, 612).length, 6);
  assert.deepEqual(splitColumnRows([rows[1]], 612), [rows[1]]);
});
