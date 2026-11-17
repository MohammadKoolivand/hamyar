import assert from "node:assert/strict";
import { test } from "node:test";
import { detailedExamCatalog, examCatalogValidIds, examYears, mockExamProviders, validExamCoverageId } from "../../src/lib/exam-catalog";
import { catalogStatuses, publicExamEvents, publicQuestionCatalogIds, type CatalogPublicQuestion } from "../../src/lib/exam-catalog-coverage";
import { routeRoles } from "../../src/lib/access";

function publicMock(id: string): CatalogPublicQuestion {
  return {
    _id: id,
    statement: "آزمون موردی نمونه",
    type: "choice",
    options: ["اول", "دوم"],
    taxonomy: { level: "متوسطه دوم", grade: "دوازدهم", book: "شیمی", chapter: "", topic: "" },
    year: 1404,
    source: {
      family: "mock", organizer: "قلم چی", track: "علوم تجربی", grade: "12",
      academicYear: "1404–1405", stage: "مرحله ۳",
      sourceTitle: "آزمون ۱۵ آبان", examDate: "1404/08/15",
    },
  };
}

test("all mock organizers have separate year, grade and track upload records", () => {
  const mock = detailedExamCatalog.filter((entry) => entry.section === "mock");
  const combinationsPerYear = mockExamProviders.reduce((total, provider) =>
    total + (["zistaz", "zistpishrafte"].includes(provider.id) ? 1 : 2), 0);
  assert.equal(mock.length, combinationsPerYear * examYears.length * 3);
  assert.equal(new Set(mock.map((entry) => entry.id)).size, mock.length);
  assert.ok(mock.every((entry) => entry.year && entry.grade && entry.track && entry.provider));
  for (const provider of mockExamProviders) for (const year of examYears) {
    for (const grade of [10, 11, 12]) for (const track of ["experimental", "mathematics"]) {
      if (["zistaz", "zistpishrafte"].includes(provider.id) && track === "mathematics") continue;
      const item = mock.find((entry) => entry.id === `mock-${provider.id}-${year}-${grade}-${track}`);
      assert.ok(item);
      assert.equal(examCatalogValidIds([item.id]), true);
    }
  }
});

test("all public catalog entries have an explicit year, including school and admission categories", () => {
  assert.ok(detailedExamCatalog.length > 500);
  assert.ok(detailedExamCatalog.every((entry) => typeof entry.year === "number"));
  assert.ok(detailedExamCatalog.some((entry) => entry.label.includes("۱۴۰۵") && entry.section === "mock"));
});

test("published mock questions show the precise annual record and distinct dated event", () => {
  const q = publicMock("q1");
  const annual = "mock-ghalamchi-1404-12-experimental";
  assert.ok(publicQuestionCatalogIds(q).includes(annual));
  const events = publicExamEvents([q]);
  assert.equal(events.length, 1);
  assert.equal(events[0].parentId, annual);
  assert.equal(events[0].questionIds.length, 1);
  assert.ok(events[0].label.includes("1404/08/15"));
  assert.equal(validExamCoverageId(events[0].id), true);
  assert.equal(catalogStatuses([q]).get(annual)?.status, "partial");
  assert.equal(catalogStatuses([q], [{ categoryId: annual, expectedQuestionCount: 1 }]).get(annual)?.status, "complete");
});

test("year-specific admin certifications can be revoked without public write access", () => {
  assert.deepEqual(routeRoles("DELETE", "/api/admin/exam-catalog/coverage/:categoryId"), ["super_admin"]);
  assert.deepEqual(routeRoles("POST", "/api/admin/exam-catalog/coverage"), ["super_admin"]);
  assert.equal(routeRoles("GET", "/api/exam-catalog/coverage"), null);
});
