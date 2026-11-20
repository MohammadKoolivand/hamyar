import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sourceCategory,
  konkurExamKey,
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

test("national Konkur organizer is provenance, not a separate exam identity", () => {
  const base = { family: "konkur" as const, group: "experimental" as const,
    location: "domestic" as const, session: "نوبت اول" };
  const withOrganizer = { ...base, organizer: "سازمان سنجش" };
  assert.equal(konkurExamKey(base, 1405), konkurExamKey(withOrganizer, 1405));
  assert.equal(sourceSummary(base), sourceSummary(withOrganizer));
  assert.notEqual(konkurExamKey(base, 1405),
    konkurExamKey({ ...base, session: "نوبت دوم" }, 1405));
  assert.notEqual(konkurExamKey(base, 1405),
    konkurExamKey({ ...base, location: "international" }, 1405));
  assert.equal(konkurExamKey(base, 1405),
    konkurExamKey({ ...base, academicYear: "۱۴۰۵" }, undefined));
  assert.equal(konkurExamKey({ family: "konkur", group: "experimental" }, 1405), undefined);
  const input = { classification: "free" as const,
    statement: "این سؤال برای آزمون تجربی است", type: "short" as const, reference: "بله",
    year: 1405, source: withOrganizer };
  const saved = questionSchema.parse(input);
  assert.equal(saved.source?.examKey, konkurExamKey(base, 1405));
  const changed = questionSchema.parse({ ...saved, source: { ...saved.source, session: "نوبت دوم" } });
  assert.notEqual(changed.source?.examKey, saved.source?.examKey);
});
