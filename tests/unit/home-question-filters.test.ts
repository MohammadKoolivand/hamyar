import assert from "node:assert/strict";
import { test } from "node:test";
import { homeBookName, homeQuestionYear, initialHomeFilters, matchesHomeQuestion, sortHomeQuestions } from "../../src/lib/home-question-filters";
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
