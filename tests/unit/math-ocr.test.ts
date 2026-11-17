import { test } from "node:test";
import assert from "node:assert/strict";
import { mathCropPixels, parseMathOcrOutput } from "../../src/server/imports/math-ocr";

test("Math OCR crop uses image pixel coordinates and rejects full-page/invalid selections", () => {
  assert.deepEqual(
    mathCropPixels({ x: 20, y: 30, width: 40, height: 15 }, 1000, 1400),
    { left: 200, top: 420, width: 400, height: 210 },
  );
  assert.throws(() => mathCropPixels({ x: 0, y: 0, width: 100, height: 100 }, 1000, 1400));
  assert.throws(() => mathCropPixels({ x: 90, y: 10, width: 30, height: 20 }, 1000, 1400));
  assert.throws(() => mathCropPixels({ x: 5, y: 5, width: 3, height: 2 }, 100, 100));
});
test("Math OCR outputs renderable TeX but never assume scientific correctness", () => {
  const latex = String.raw`\\frac{30\\,\\mathrm{cm}}{2}+x^2`;
  assert.equal(parseMathOcrOutput("MATH_OCR_RESULT:" + JSON.stringify(latex)), latex);
  assert.equal(parseMathOcrOutput("status\nMATH_OCR_RESULT:" + JSON.stringify("$x^{2}$")), "x^{2}");
  assert.throws(() => parseMathOcrOutput("noise"));
  assert.throws(() => parseMathOcrOutput("MATH_OCR_RESULT:" + JSON.stringify(String.raw`\\href{https://bad.invalid}{x}`)));
  assert.throws(() => parseMathOcrOutput("MATH_OCR_RESULT:" + JSON.stringify("")));
});
