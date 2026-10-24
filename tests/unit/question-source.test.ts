import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sourceCategory,
  initialSource,
  sourceSummary,
  questionSourceSchema,
  sourceCategories,
} from "../../src/lib/question-source";
import { questionSchema } from "../../src/server/domain";
test("eight UI source views keep final separate from coordinated national exams; reject unrelated dimensions", () => {
  assert.equal(sourceCategories.length, 8);
  for (const c of sourceCategories) {
    const s = initialSource(c.id);
    assert.ok(questionSourceSchema.safeParse(s).success, c.id);
    assert.equal(sourceCategory(s), c.id);
  }
  assert.equal(
    sourceCategory({ family: "school", administration: "national" }),
    "coordinated",
  );
  assert.equal(
    sourceCategory({ family: "school", administration: "final" }),
    "final",
  );
  assert.equal(sourceCategory(), "unknown");
  for (const s of [
    { family: "practice", group: "art" },
    { family: "school" },
    { family: "school", administration: "final", schoolStage: "mid_first" },
    { family: "konkur", admission: "sampad7" },
    { family: "mock", practice: "ai" },
    { family: "practice", sourceUrl: "javascript:alert(1)" },
  ])
    assert.equal(questionSourceSchema.safeParse(s).success, false);
  assert.equal(
    sourceSummary({
      family: "school",
      administration: "internal",
      schoolStage: "end_second",
    }),
    "امتحان مدرسه‌ای · پایان‌نوبت دوم",
  );
  assert.ok(
    sourceSummary({
      family: "konkur",
      group: "art",
      location: "international",
    }).includes("هنر"),
  );
  const q = {
    classification: "free",
    statement: "حاصل یک و یک؟",
    type: "numeric",
    reference: "2",
  };
  assert.ok(questionSchema.safeParse(q).success);
  assert.ok(
    questionSchema.safeParse({
      ...q,
      source: { family: "olympiad", subject: "فیزیک", stage: "مرحله اختصاصی" },
    }).success,
  );
});
