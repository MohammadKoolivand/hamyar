import { processDocument } from "../../src/server/imports/document-engine";
import {
  parseQuestions,
  parseAnswerKey,
  matchKey,
} from "../../src/server/imports/layout";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
const root = "/private/tmp/hodhodeh-uat-real-exam";
const source = await processDocument(root + "/source-2.pdf", root + "/source");
const key = await processDocument(root + "/key-1.pdf", root + "/key");
await writeFile(root + "/source-lines.json", JSON.stringify(source.flatMap(p => p.lines)));
const questions = parseQuestions(
  source.flatMap((p) => p.lines),
  Object.fromEntries(
    source.map((p) => [p.page, { width: p.width, height: p.height }]),
  ),
);
const entries = parseAnswerKey(key.flatMap((p) => p.lines));
console.log(
  JSON.stringify(
    {
      source:
        "Existing owner-provided Konkur1405 source.pdf page 2; key.pdf page 1, extracted locally without database writes",
      reference:
        "Six numbered questions per existing markers, not independently re-annotated truth",
      expectedNumbers: [1, 2, 3, 4, 5, 6],
      detectedNumbers: questions.map((q) => q.number),
      keyEntries: entries.entries.length,
      keyWarnings: entries.warnings,
      sourceMethods: source.map((p) => p.method),
      sourceRendered: await Promise.all(
        source.map(
          async (p) => !!(await stat(root + "/source/" + p.imageFile)).size,
        ),
      ),
      sourceSha256: createHash("sha256")
        .update(await readFile(root + "/source-2.pdf"))
        .digest("hex"),
      questions: questions.map((q) => ({
        number: q.number,
        optionCount: q.options.length,
        warnings: q.warnings,
        keyMatch: matchKey(q, entries.entries).status,
      })),
      textScientificAccuracy: "MANUAL_REQUIRED",
      formulasAndOptions:
        "Source raster retained; no claim of exact mathematical OCR",
      published: 0,
    },
    null,
    2,
  ),
);
