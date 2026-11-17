import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalogStatuses,
  publicQuestionCatalogIds,
  type CatalogPublicQuestion,
} from "../../src/lib/exam-catalog-coverage";
import { routeRoles } from "../../src/lib/access";

const question = (id: string, props: Partial<CatalogPublicQuestion> = {}): CatalogPublicQuestion => ({
  _id: id,
  statement: "سؤال تستی نمونه",
  type: "choice",
  options: ["گزینه اول", "گزینه دوم"],
  taxonomy: { level: "متوسطه دوم", grade: "دوازدهم", book: "ریاضی", chapter: "", topic: "" },
  ...props,
});

test("exam catalog status is empty, partial or certified complete, never full from mere presence", () => {
  const id = "konkur-1405-mathematics-general";
  const row = question("q1", { catalogIds: [id] });
  assert.deepEqual(catalogStatuses([], [{ categoryId: id, expectedQuestionCount: 1 }]).get(id), { count: 0, status: "empty" });
  assert.deepEqual(catalogStatuses([row]).get(id), { count: 1, status: "partial" });
  assert.deepEqual(catalogStatuses([row], [{ categoryId: id, expectedQuestionCount: 2 }]).get(id), { count: 1, status: "partial" });
  assert.deepEqual(catalogStatuses([row], [{ categoryId: id, expectedQuestionCount: 1 }]).get(id), { count: 1, status: "complete" });
  assert.deepEqual(catalogStatuses([row, row], [{ categoryId: id, expectedQuestionCount: 2 }]).get(id), { count: 1, status: "partial" });
});

test("older public questions fall back only to source-supported exam categories", () => {
  const first = question("q2", {
    year: 1404,
    source: { family: "konkur", group: "mathematics", session: "نوبت اول", location: "domestic" },
  });
  const ids = publicQuestionCatalogIds(first);
  assert.ok(ids.includes("konkur-1404-mathematics-general"));
  assert.ok(ids.includes("konkur-1404-mathematics-first"));
  assert.ok(ids.includes("konkur-1404-mathematics-domestic"));
  assert.ok(!ids.includes("konkur-1404-experimental-general"));
  assert.ok(!ids.includes("konkur-1405-mathematics-general"));
  assert.deepEqual(publicQuestionCatalogIds(question("q3", { source: undefined })), []);
});

test("explicit catalog ids are respected; unknown or private-only labels do not imply availability", () => {
  const id = "school-9-end_second";
  const row = question("q4", { catalogIds: [id, "not-a-valid-category"] });
  assert.deepEqual(publicQuestionCatalogIds(row), [id]);
  assert.equal(catalogStatuses([row]).get(id)?.status, "partial");
});

test("public coverage remains anonymous; only super-admin may certify completion", () => {
  assert.equal(routeRoles("GET", "/api/exam-catalog/coverage"), null);
  assert.deepEqual(routeRoles("POST", "/api/admin/exam-catalog/coverage"), ["super_admin"]);
});

test("public exam file links are anonymous while publishing is super-admin-only", () => {
  assert.equal(routeRoles("GET", "/api/exam-catalog/public-progress"), null);
  assert.deepEqual(routeRoles("POST", "/api/admin/exam-imports/:eid/public-files"), ["super_admin"]);
  assert.equal(routeRoles("GET", "/api/pdf-library/:pid/file"), null);
});
