import { test } from "node:test";
import assert from "node:assert/strict";
import { cropFromDrag, percentPointFromPointer, selectableMathCrop } from "../../src/lib/math-ocr-crop";

test("Math OCR crop percent mapping stays accurate on displayed/scaled PDF", () => {
  const box = { left: 100, top: 20, width: 400, height: 800 };
  assert.deepEqual(percentPointFromPointer(220, 420, box), { x: 30, y: 50 });
  assert.deepEqual(percentPointFromPointer(20, 900, box), { x: 0, y: 100 });
});
test("crop selection works dragging right-to-left, clamps bounds and rejects tiny crops", () => {
  const crop = cropFromDrag({ x: 80, y: 60 }, { x: 25, y: 35 });
  assert.deepEqual(crop, { x: 25, y: 35, width: 55, height: 25 });
  assert.equal(selectableMathCrop(crop), true);
  assert.equal(selectableMathCrop(cropFromDrag({ x: 10, y: 20 }, { x: 11, y: 20.5 })), false);
  assert.equal(selectableMathCrop({ x: 50, y: 60, width: 60, height: 20 }), false);
  assert.equal(selectableMathCrop({ x: 0, y: 0, width: 100, height: 100 }), false);
});
