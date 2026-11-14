import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { questionSchema } from "../../src/server/domain";
import { QuestionPresentation } from "../../src/components/question-presentation";

const image = {
  kind: "image" as const,
  assetId: "00000000-0000-4000-8000-000000000022",
  caption: "رشته DNA گزینه نخست",
  width: 800,
  height: 160,
};
const choice = {
  classification: "free" as const,
  statement: "کدام رشته درست است؟",
  type: "choice" as const,
  reference: "تصویر گزینه 1",
  options: ["تصویر گزینه 1", "ATGC"],
};
test("image-only choice and legacy text-only questions both validate", () => {
  assert.equal(questionSchema.safeParse(choice).success, true);
  assert.equal(questionSchema.safeParse({
    ...choice, optionImages: [image, null],
  }).success, true);
  assert.equal(questionSchema.safeParse({
    ...choice, optionImages: [image],
  }).success, false);
  assert.equal(questionSchema.safeParse({
    ...choice, optionImages: [{ ...image, kind: "chart" }, null],
  }).success, false);
});
test("renders option image under its own answer and keeps other choices text-only", () => {
  const html = renderToStaticMarkup(createElement(QuestionPresentation, {
    statement: choice.statement,
    options: choice.options,
    optionImages: [image, null],
  }));
  assert.match(html, /\/api\/question-assets\/00000000-0000-4000-8000-000000000022/);
  assert.match(html, /ATGC/);
  assert.ok(!html.includes(">تصویر گزینه 1<"));
});
