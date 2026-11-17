import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

test("public MVP home contains only filtering, selected questions and PDF export", () => {
  const home = read("src/app/page.tsx");
  const screen = read("src/features/content/simple-question-home.tsx");
  assert.match(home, /SimpleQuestionHome/);
  assert.doesNotMatch(home, /^import HamyarApp/m);
  assert.match(screen, /\/questions\/public/);
  assert.match(screen, /printQuestions\(/);
  assert.match(screen, /type="checkbox"/);
  assert.match(screen, /sourceCategory\(/);
  assert.match(screen, /href="\/exam-catalog"/);
  assert.doesNotMatch(screen, /catalogOpen|hodhod-exam-catalog/);
  assert.match(screen, /new URLSearchParams\(window.location.search\).get\("exam"\)/);
  assert.match(screen, /publicQuestionCatalogIds\(q\)/);
  assert.doesNotMatch(screen, /\/auth\/me|AuthScreen|\/auth\/login|\/student\/library/);
});

test("all previous deep-link routes redirect to public home without deleting implementation", () => {
  const route = read("src/app/[section]/page.tsx");
  const legacy = read("src/components/hamyar-app.tsx");
  assert.match(route, /redirect\("\/"\)/);
  assert.match(route, /\/\/ import HamyarApp/);
  assert.match(legacy, /AuthScreen/);
  assert.match(legacy, /MissionsScreen/);
  assert.match(legacy, /ContentScreen/);
});


test("dedicated exam catalog is a real standalone page with year-specific categorized items", () => {
  const page = read("src/app/exam-catalog/page.tsx");
  const catalog = read("src/features/content/exam-catalog-page.tsx");
  assert.match(page, /ExamCatalogPage/);
  assert.match(catalog, /detailedExamCatalog/);
  assert.match(catalog, /examYears/);
  assert.match(catalog, /mockExamProviders/);
  assert.match(catalog, /publicExamEvents/);
  assert.match(catalog, /aria-label="راهنمای وضعیت موجودی"/);
});
