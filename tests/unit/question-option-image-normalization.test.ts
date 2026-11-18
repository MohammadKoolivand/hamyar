import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeImageOnlyChoices } from "../../src/lib/question-option-images";

const image = { kind: "image", assetId: "asset" };

test("image-only option gets the established placeholder and retains the answer", () => {
  const result = normalizeImageOnlyChoices({
    options: ["", "ATGC"],
    optionImages: [image, null],
    reference: "",
  });
  assert.deepEqual(result.options, ["تصویر گزینه 1", "ATGC"]);
  assert.equal(result.reference, "تصویر گزینه 1");
});

test("text with an image is kept and text-only options are unchanged", () => {
  const result = normalizeImageOnlyChoices({
    options: ["A", "B"],
    optionImages: [image, null],
    reference: "B",
  });
  assert.deepEqual(result.options, ["A", "B"]);
  assert.equal(result.reference, "B");
});

test("empty options without images remain invalid for caller-side validation", () => {
  const result = normalizeImageOnlyChoices({
    options: ["", "B"],
    optionImages: [null, null],
    reference: "B",
  });
  assert.equal(result.options[0], "");
});

test("does not guess which of multiple empty image options is correct", () => {
  const result = normalizeImageOnlyChoices({
    options: ["", ""],
    optionImages: [image, image],
    reference: "",
  });
  assert.deepEqual(result.options, ["تصویر گزینه 1", "تصویر گزینه 2"]);
  assert.equal(result.reference, "");
});
