import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionSchema } from "../../src/server/domain";


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
test("shared presentation, practice and print paths include option images", () => {
  const paths = [
    "src/components/question-presentation.tsx",
    "src/features/practice/practice-screen.tsx",
    "src/features/content/public-question-bank.tsx",
  ];
  for (const path of paths) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /optionImages/);
    assert.match(source, /QuestionVisualView/);
  }
});
