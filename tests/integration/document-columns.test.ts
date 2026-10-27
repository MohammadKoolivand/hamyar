import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { processDocument } from "../../src/server/imports/document-engine";
import { parseQuestions } from "../../src/server/imports/layout";
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
