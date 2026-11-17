import assert from "node:assert/strict";
import { test } from "node:test";
import {
  examCatalog, examCatalogEntry, examCatalogValidIds,
  konkurYears, doubleSessionKonkurYears, independentAzadYears,
  detailedExamCatalog,
} from "../../src/lib/exam-catalog";
import { catalogStatuses, publicQuestionCatalogIds, type CatalogPublicQuestion } from "../../src/lib/exam-catalog-coverage";

const question = (
  id: string, year: number, source: CatalogPublicQuestion["source"],
  catalogIds?: string[],
): CatalogPublicQuestion => ({
  _id: id, year, source, ...(catalogIds ? { catalogIds } : {}),
  statement: "سؤال نمونه", type: "choice", options: ["اول", "دوم"],
  taxonomy: { level: "متوسطه دوم", grade: "دوازدهم", book: "ریاضی", chapter: "", topic: "" },
});

test("national Konkur catalog covers every year 1390 through 1405, math and experimental", () => {
  assert.deepEqual(konkurYears, Array.from({ length: 16 }, (_, index) => 1405 - index));
  for (const year of konkurYears) for (const track of ["mathematics", "experimental"] as const) {
    for (const type of ["general", "domestic", "international", "booklet-specific"]) {
      const item = examCatalogEntry(`konkur-${year}-${track}-${type}`);
      assert.ok(item, `${year} ${track} ${type}`);
      assert.equal(item?.year, year);
    }
    assert.equal(Boolean(examCatalogEntry(`konkur-${year}-${track}-booklet-general`)), year <= 1401);
    for (const phase of ["first", "second"]) {
      const expected = doubleSessionKonkurYears.includes(year as 1402 | 1403 | 1404);
      assert.equal(Boolean(examCatalogEntry(`konkur-${year}-${track}-${phase}`)), expected);
      assert.equal(Boolean(examCatalogEntry(`konkur-${year}-${track}-${phase}-domestic`)), expected);
      assert.equal(Boolean(examCatalogEntry(`konkur-${year}-${track}-${phase}-international`)), expected);
    }
    for (const system of ["old", "new"]) {
      assert.equal(Boolean(examCatalogEntry(`konkur-${year}-${track}-${system}`)), year === 1398 || year === 1399);
    }
  }
  assert.equal(new Set(examCatalog.map((row) => row.id)).size, examCatalog.length);
  assert.equal(new Set(detailedExamCatalog.map((row) => row.id)).size, detailedExamCatalog.length);
});

test("Azad undergraduate exam is independent only in 1390 and 1391", () => {
  assert.deepEqual(independentAzadYears, [1390, 1391]);
  for (const year of konkurYears) for (const track of ["mathematics", "experimental"]) {
    const independent = examCatalogEntry(`konkur-azad-${year}-${track}-general`);
    const shared = examCatalogEntry(`konkur-azad-${year}-${track}-shared`);
    if (year <= 1391) {
      assert.ok(independent);
      assert.equal(shared, undefined);
      assert.ok(examCatalogEntry(`konkur-azad-${year}-${track}-morning`));
    } else {
      assert.equal(independent, undefined);
      assert.equal(shared?.linkedCatalogId, `konkur-${year}-${track}-general`);
      assert.match(shared?.label ?? "", /مشترک با سراسری/);
    }
  }
  assert.equal(examCatalogValidIds(["konkur-1391-mathematics-general", "konkur-azad-1391-mathematics-general"]), false);
});

test("legacy national and Azad questions from 1391 retain their distinct provenance", () => {
  const national = question("sarsari", 1391, {
    family: "konkur", group: "mathematics", organizer: "سازمان سنجش", location: "domestic",
  });
  const azad = question("azad", 1391, {
    family: "konkur", group: "mathematics", organizer: "دانشگاه آزاد", session: "صبح",
  });
  assert.ok(publicQuestionCatalogIds(national).includes("konkur-1391-mathematics-domestic"));
  assert.ok(!publicQuestionCatalogIds(national).includes("konkur-azad-1391-mathematics-general"));
  assert.ok(publicQuestionCatalogIds(azad).includes("konkur-azad-1391-mathematics-general"));
  assert.ok(publicQuestionCatalogIds(azad).includes("konkur-azad-1391-mathematics-morning"));
  assert.ok(!publicQuestionCatalogIds(azad).includes("konkur-1391-mathematics-general"));
});

test("merged Azad admissions since 1392 share national questions instead of inventing a second paper", () => {
  const q = question("national-1392", 1392, {
    family: "konkur", group: "experimental", organizer: "سازمان سنجش",
  });
  const ids = publicQuestionCatalogIds(q);
  assert.ok(ids.includes("konkur-1392-experimental-general"));
  assert.ok(ids.includes("konkur-azad-1392-experimental-shared"));
  assert.equal(catalogStatuses([q]).get("konkur-azad-1392-experimental-shared")?.status, "partial");
});

test("historical source matching handles 1398/1399 systems, 1402 first session and 1405 single sitting", () => {
  const old = question("old", 1399, {
    family: "konkur", group: "experimental", stage: "نظام قدیم", location: "domestic",
  });
  const first = question("first", 1402, {
    family: "konkur", group: "mathematics", session: "نوبت اول", location: "international",
  });
  const one = question("one", 1405, {
    family: "konkur", group: "experimental", location: "domestic",
  });
  assert.ok(publicQuestionCatalogIds(old).includes("konkur-1399-experimental-old-domestic"));
  assert.ok(publicQuestionCatalogIds(first).includes("konkur-1402-mathematics-first-international"));
  assert.ok(publicQuestionCatalogIds(one).includes("konkur-1405-experimental-general"));
  assert.ok(!publicQuestionCatalogIds(one).includes("konkur-1405-experimental-first"));
});

test("explicit historic tags preserve aggregate categories without guessing a conflicting year", () => {
  const exact = question("t", 1390,
    { family: "konkur", group: "mathematics", organizer: "دانشگاه آزاد" },
    ["konkur-azad-1390-mathematics-afternoon"]);
  const ids = publicQuestionCatalogIds(exact);
  assert.ok(ids.includes("konkur-azad-1390-mathematics-general"));
  assert.ok(ids.includes("konkur-azad-1390-mathematics-afternoon"));
  assert.ok(!ids.includes("konkur-1390-mathematics-general"));
});

test("separate student-teacher entrance exam editions exist only 1403–1405", () => {
  for (const year of konkurYears) for (const track of ["mathematics", "experimental"]) {
    const annual = examCatalogEntry(`konkur-farhangian-${year}-${track}-general`);
    const booklet = examCatalogEntry(`konkur-farhangian-${year}-${track}-booklet`);
    assert.equal(Boolean(annual), year >= 1403);
    assert.equal(Boolean(booklet), year >= 1403);
  }
  const teacher = question("t1", 1404, {
    family: "konkur", group: "experimental",
    organizer: "سازمان سنجش (فرهنگیان)", bookletCode: "دفترچه اختصاصی فرهنگیان",
  });
  const ids = publicQuestionCatalogIds(teacher);
  assert.ok(ids.includes("konkur-farhangian-1404-experimental-general"));
  assert.ok(ids.includes("konkur-farhangian-1404-experimental-booklet"));
  assert.ok(!ids.includes("konkur-1404-experimental-general"));
});

test("import checklist rejects mixing incompatible Konkur sittings, systems and places", () => {
  assert.equal(examCatalogValidIds([
    "konkur-1403-mathematics-first", "konkur-1403-mathematics-second",
  ]), false);
  assert.equal(examCatalogValidIds([
    "konkur-1398-experimental-old", "konkur-1398-experimental-new",
  ]), false);
  assert.equal(examCatalogValidIds([
    "konkur-1402-experimental-first-domestic",
    "konkur-1402-experimental-first-international",
  ]), false);
  assert.equal(examCatalogValidIds([
    "konkur-1402-experimental-general",
    "konkur-1402-experimental-first",
    "konkur-1402-experimental-first-domestic",
  ]), true);
});
