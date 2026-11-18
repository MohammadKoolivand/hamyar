import assert from "node:assert/strict";
import { test } from "node:test";
import { homeBookName, homeQuestionTrack, homeQuestionYear, initialHomeFilters, matchesHomeQuestion, sortHomeQuestions } from "../../src/lib/home-question-filters";
import type { CatalogPublicQuestion } from "../../src/lib/exam-catalog-coverage";

function question(id: string, extra: Partial<CatalogPublicQuestion> = {}): CatalogPublicQuestion {
  return {
    _id: id, statement: "مساحت مستطیل چقدر است؟", type: "short", options: [],
    taxonomy: { level: "متوسطه دوم", grade: "دوازدهم", book: "ریاضی", chapter: "تابع", topic: "دامنه" },
    year: 1403, difficulty: "medium",
    source: { family: "konkur" }, ...extra,
  };
}

test("home cascaded taxonomy filters and inclusive Persian year ranges", () => {
  const q = question("one");
  const filters = { ...initialHomeFilters(), level: "متوسطه دوم", grade: "دوازدهم",
    book: "ریاضی", chapter: "تابع", topic: "دامنه", yearFrom: "1402", yearTo: "1404" };
  assert.equal(matchesHomeQuestion(q, filters), true);
  assert.equal(matchesHomeQuestion(q, { ...filters, yearTo: "1402" }), false);
  assert.equal(matchesHomeQuestion(q, { ...filters, topic: "مشتق" }), false);
  assert.equal(matchesHomeQuestion(q, { ...filters, category: "mock" }), false);
  const azad = question("azad", { source: { family: "konkur", sourceTitle: "کنکور دانشگاه آزاد" } });
  assert.equal(matchesHomeQuestion(azad, { ...initialHomeFilters(), category: "konkur-azad" }), true);
  assert.equal(matchesHomeQuestion(azad, { ...initialHomeFilters(), category: "konkur" }), false);
  assert.equal(matchesHomeQuestion(q, { ...initialHomeFilters(), category: "konkur" }), true);
  assert.equal(homeQuestionYear(question("persian", { year: undefined,
    source: { family: "mock", academicYear: "۱۴۰۲–۱۴۰۳" } })), 1402);
  assert.equal(matchesHomeQuestion(question("unknown", { year: undefined }), filters), false);
});

test("home sorting uses actual publication time, difficulty and recommendation votes without mutating input", () => {
  const entries = [
    question("one", { difficulty: "hard", recommendationCount: 3, publishedAt: "2025-01-01T00:00:00Z" }),
    question("two", { difficultyScore: 5, recommendationCount: 7, publishedAt: "2026-01-01T00:00:00Z" }),
    question("three", { difficulty: undefined, recommendationCount: 0, publishedAt: "2024-01-01T00:00:00Z" }),
  ];
  assert.deepEqual(sortHomeQuestions(entries, "newest").map((q) => q._id), ["two", "one", "three"]);
  assert.deepEqual(sortHomeQuestions(entries, "easiest").map((q) => q._id), ["two", "one", "three"]);
  assert.deepEqual(sortHomeQuestions(entries, "hardest").map((q) => q._id), ["one", "two", "three"]);
  assert.deepEqual(sortHomeQuestions(entries, "recommended").map((q) => q._id), ["two", "one", "three"]);
  assert.deepEqual(entries.map((q) => q._id), ["one", "two", "three"]);
});

test("lesson labels exclude redundant track names without removing actual lessons", () => {
  assert.equal(homeBookName("فیزیک - علوم تجربی"), "فیزیک");
  assert.equal(homeBookName("شیمی (علوم تجربی)"), "شیمی");
  assert.equal(homeBookName("حسابان (ریاضی فیزیک)"), "حسابان");
  assert.equal(homeBookName("فیزیک ریاضی"), "فیزیک");
  assert.equal(homeBookName("زیست‌شناسی علوم تجربی"), "زیست‌شناسی");
  assert.equal(homeBookName("ریاضی"), "ریاضی");
  assert.equal(homeBookName("علوم تجربی"), "علوم تجربی");
  assert.equal(matchesHomeQuestion(question("legacy", {
    taxonomy: { level: "متوسطه دوم", grade: "دوازدهم", book: "فیزیک - علوم تجربی", chapter: "حرکت", topic: "سرعت" },
    source: { family: "konkur", group: "experimental" },
  }), { ...initialHomeFilters(), track: "تجربی", book: "فیزیک" }), true);
});

test("source order groups exams, sorts original numbers numerically, and isolates finals", () => {
  const source = { family: "konkur" as const, group: "experimental" as const,
    academicYear: "۱۴۰۵", sourceTitle: "کنکور سراسری ۱۴۰۵", session: "نوبت اول" };
  const finalSource = { family: "school" as const, administration: "final" as const,
    sourceTitle: "امتحان نهایی ۱۴۰۵", academicYear: "۱۴۰۵", subject: "فیزیک" };
  const rows = [
    question("e10", { source: { ...source, questionNumber: 10 }, publishedAt: "2026-01-01" }),
    question("final2", { source: { ...finalSource, questionNumber: 2 }, publishedAt: "2025-01-01" }),
    question("e2", { source: { ...source, subject: "شیمی", questionNumber: 2 }, publishedAt: "2026-01-01" }),
    question("final1", { source: { ...finalSource, questionNumber: 1 }, publishedAt: "2025-01-01" }),
    question("eMissing", { source: { ...source }, publishedAt: "2026-01-01" }),
    question("e1", { source: { ...source, subject: "زیست‌شناسی", questionNumber: 1 }, publishedAt: "2026-01-01" }),
  ];
  const result = sortHomeQuestions(rows, "source_order");
  assert.deepEqual(result.map((q) => q._id),
    ["e1", "e2", "e10", "eMissing", "final1", "final2"]);
  assert.deepEqual(rows.map((q) => q._id),
    ["e10", "final2", "e2", "final1", "eMissing", "e1"]);
});

test("different exam sessions and final subjects are never interleaved", () => {
  const base = { family: "konkur" as const, group: "mathematics" as const,
    sourceTitle: "کنکور سراسری ۱۴۰۵", academicYear: "۱۴۰۵" };
  const rows = [
    question("first10", { source: { ...base, session: "اول", questionNumber: 10 }, publishedAt: "2026-04-01" }),
    question("second2", { source: { ...base, session: "دوم", questionNumber: 2 }, publishedAt: "2026-05-01" }),
    question("first2", { source: { ...base, session: "اول", questionNumber: 2 }, publishedAt: "2026-04-01" }),
    question("second1", { source: { ...base, session: "دوم", questionNumber: 1 }, publishedAt: "2026-05-01" }),
  ];
  assert.deepEqual(sortHomeQuestions(rows, "source_order").map((q) => q._id),
    ["second1", "second2", "first2", "first10"]);
  const finals = [
    question("chem2", { source: { family: "school", administration: "final",
      sourceTitle: "نهایی خرداد", subject: "شیمی", academicYear: "۱۴۰۵", questionNumber: 2 } }),
    question("physics1", { source: { family: "school", administration: "final",
      sourceTitle: "نهایی خرداد", subject: "فیزیک", academicYear: "۱۴۰۵", questionNumber: 1 } }),
    question("chem1", { source: { family: "school", administration: "final",
      sourceTitle: "نهایی خرداد", subject: "شیمی", academicYear: "۱۴۰۵", questionNumber: 1 } }),
  ];
  const sorted = sortHomeQuestions(finals, "source_order").map((q) => q._id);
  assert.equal(Math.abs(sorted.indexOf("chem1") - sorted.indexOf("chem2")), 1);
  assert.ok(sorted.indexOf("chem1") < sorted.indexOf("chem2"));
});

test("explicit experimental Konkur group overrides a math lesson or conflicting track text", () => {
  const experimental = question("tajrobi-46", {
    taxonomy: { level: "متوسطه دوم", grade: "دوازدهم", book: "ریاضی", chapter: "موج", topic: "طول موج" },
    source: { family: "konkur", group: "experimental", track: "ریاضی", questionNumber: 46 },
  });
  assert.equal(homeQuestionTrack(experimental), "تجربی");
  assert.equal(matchesHomeQuestion(experimental, { ...initialHomeFilters(), track: "ریاضی" }), false);
  assert.equal(matchesHomeQuestion(experimental, { ...initialHomeFilters(), track: "تجربی" }), true);

  const mathematics = question("riazi-46", {
    taxonomy: { level: "متوسطه دوم", grade: "دوازدهم", book: "فیزیک - علوم تجربی", chapter: "موج", topic: "نور" },
    source: { family: "konkur", group: "mathematics", questionNumber: 46 },
  });
  assert.equal(homeQuestionTrack(mathematics), "ریاضی");
  assert.equal(matchesHomeQuestion(mathematics, { ...initialHomeFilters(), track: "تجربی" }), false);
  assert.equal(matchesHomeQuestion(mathematics, { ...initialHomeFilters(), track: "ریاضی" }), true);
});

test("generic math lessons never establish a math Konkur track without an explicit source", () => {
  const generic = question("generic", { source: { family: "konkur" } });
  assert.equal(homeQuestionTrack(generic), "");
  assert.equal(matchesHomeQuestion(generic, { ...initialHomeFilters(), track: "ریاضی" }), false);
  const legacy = question("legacy", { source: { family: "konkur", track: "علوم تجربی" } });
  assert.equal(homeQuestionTrack(legacy), "تجربی");
});

test("newly published science question 31 follows original questions without exam identity", () => {
  const science = (number: number, recent = false) => question(`science-${number}`, {
    year: 1405,
    taxonomy: { level: "ابتدایی", grade: "ششم", book: "علوم", chapter: "انرژی", topic: "آزمایش" },
    source: { family: "practice", practice: "textbook", questionNumber: number },
    publishedAt: recent ? "2026-11-18T13:00:00Z" : "2026-10-01T13:00:00Z",
  });
  const rows = [science(31, true), science(2), science(1), science(30)];
  const sorted = sortHomeQuestions(rows, "source_order").map((q) => q._id);
  assert.deepEqual(sorted, ["science-1", "science-2", "science-30", "science-31"]);
  assert.deepEqual(rows.map((q) => q._id), ["science-31", "science-2", "science-1", "science-30"]);
  assert.equal(sortHomeQuestions(rows, "newest")[0]._id, "science-31");
});

test("reference ordering stays scoped to lesson and grade", () => {
  const base = { family: "practice" as const, practice: "textbook" as const };
  const science = (id: string, num: number, book: string, grade: string) =>
    question(id, {
      year: 1405,
      source: { ...base, questionNumber: num },
      taxonomy: { level: "ابتدایی", grade, book, chapter: "", topic: "" },
      publishedAt: "2026-10-01",
    });
  const rows = [
    science("science31", 31, "علوم", "ششم"),
    science("math2", 2, "ریاضی", "ششم"),
    science("science1", 1, "علوم", "ششم"),
    science("science5", 5, "علوم", "پنجم"),
    science("math1", 1, "ریاضی", "ششم"),
  ];
  const sorted = sortHomeQuestions(rows, "source_order").map((q) => q._id);
  assert.ok(sorted.indexOf("science1") < sorted.indexOf("science31"));
  assert.equal(Math.abs(sorted.indexOf("math1") - sorted.indexOf("math2")), 1);
  assert.ok(sorted.indexOf("math1") < sorted.indexOf("math2"));
  assert.notEqual(sorted.indexOf("science5"), sorted.indexOf("science1"));
});

test("optional organizer and track do not split the same titled sitting when question 31 is added", () => {
  const base = { family: "school" as const, administration: "internal" as const,
    sourceTitle: "آزمون علوم ششم", academicYear: "۱۴۰۵", subject: "علوم" };
  const rows = [
    question("new31", { source: { ...base, questionNumber: 31, organizer: "مدرسه جدید", track: "علوم" }, publishedAt: "2026-11-18" }),
    question("first1", { source: { ...base, questionNumber: 1, organizer: "مدرسه قبلی" }, publishedAt: "2026-09-01" }),
    question("first30", { source: { ...base, questionNumber: 30 }, publishedAt: "2026-09-01" }),
  ];
  assert.deepEqual(sortHomeQuestions(rows, "source_order").map((q) => q._id),
    ["first1", "first30", "new31"]);
});
