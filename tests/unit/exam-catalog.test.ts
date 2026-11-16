import { test } from "node:test";
import assert from "node:assert/strict";
import { examCatalog, examCatalogEntry, examCatalogValidIds } from "../../src/lib/exam-catalog";
import { examImportSchema } from "../../src/lib/exam-import";

test("Iranian secondary-school catalog contains both 1404 and 1405 math and experimental konkur", () => {
  for (const year of [1404, 1405]) {
    for (const track of ["mathematics", "experimental"]) {
      const entry = examCatalogEntry(`konkur-${year}-${track}-general`);
      assert.ok(entry);
      assert.equal(entry?.year, year);
      assert.equal(entry?.track, track);
    }
  }
});
test("exam catalog covers first- and second-secondary stages and allowed tracks", () => {
  for (const grade of [7, 8, 9, 10, 11, 12]) {
    assert.ok(examCatalogEntry(`school-${grade}-end_first`));
    assert.ok(examCatalogEntry(`school-${grade}-end_second`));
  }
  for (const grade of [10, 11, 12]) {
    assert.ok(examCatalogEntry(`school-${grade}-mathematics`));
    assert.ok(examCatalogEntry(`school-${grade}-experimental`));
  }
  assert.equal(new Set(examCatalog.map((item) => item.id)).size, examCatalog.length);
});
test("server accepts tagged exam imports but rejects unknown and duplicate category ids", () => {
  const valid = {
    title: "آزمون ریاضی ۱۴۰۵", subject: "ریاضی",
    source: { family: "konkur", group: "mathematics" },
    categoryIds: ["konkur-1405-mathematics-general"],
  };
  assert.deepEqual(examImportSchema.parse(valid).categoryIds, valid.categoryIds);
  assert.deepEqual(examImportSchema.parse({ ...valid, categoryIds: undefined }).categoryIds, []);
  assert.equal(examImportSchema.safeParse({ ...valid, categoryIds: ["konkur-1405-humanities-general"] }).success, false);
  assert.equal(examImportSchema.safeParse({ ...valid, categoryIds: [...valid.categoryIds, ...valid.categoryIds] }).success, false);
  assert.equal(examCatalogValidIds(new Array(9).fill("school-7-end_first")), false);
});
