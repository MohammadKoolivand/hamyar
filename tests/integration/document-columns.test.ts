import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { processDocument } from "../../src/server/imports/document-engine";
import { parseQuestions } from "../../src/server/imports/layout";
test("school sections with mirrored parentheses and local columns keep eleven real headings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hodhod-school-regression-"));
  try {
    const pages = await processDocument(
      "tests/fixtures/school-mixed-sections.pdf",
      directory,
    );
    const sizes = Object.fromEntries(
      pages.map((p) => [p.page, { width: p.width, height: p.height }]),
    );
    const questions = parseQuestions(
      pages.flatMap((p) => p.lines),
      sizes,
    );
    assert.deepEqual(
      questions.map((q) => q.number),
      Array.from({ length: 11 }, (_, i) => i + 1),
    );
    assert.match(questions[0].statement, /درستی/);
    assert.match(questions[1].statement, /جاهای خالی/);
    assert.match(questions[2].statement, /انتخاب کنید/);
    assert.match(questions[2].statement, /کیسه/); // Nested item 4 is still inside section 3.
    assert.ok(!questions[0].statement.includes("جاهای خالی"));
    assert.ok(questions[0].regions[0].x >= pages[0].width / 2);
    assert.equal(questions[1].regions[0].x, 0);
    assert.ok(questions[1].regions[0].width <= pages[0].width / 2);
    assert.ok(questions[3].regions[0].y > questions[2].regions[0].y);
    assert.ok(questions.every((q) => q.warnings.length > 0));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("OCR-014/OCR-030: genuine two-page two-column PDF keeps eight headings; corrupt and password PDF fail closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hodhod-column-regression-"));
  try {
    const pages = await processDocument(
      "tests/fixtures/uat-closure/columns.pdf",
      directory,
    );
    assert.deepEqual(
      pages.map((p) => p.page),
      [1, 2],
    );
    const sizes = Object.fromEntries(
      pages.map((p) => [p.page, { width: p.width, height: p.height }]),
    );
    assert.deepEqual(
      parseQuestions(
        pages.flatMap((p) => p.lines),
        sizes,
      ).map((q) => q.number),
      [12, 19, 24, 31, 42, 49, 54, 61],
    );
    await assert.rejects(
      processDocument("tests/fixtures/uat-closure/encrypted.pdf", directory),
    );
    await writeFile(join(directory, "corrupt.pdf"), "%PDF-1.7 broken");
    await assert.rejects(
      processDocument(join(directory, "corrupt.pdf"), directory),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
