import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processDocument } from "../src/server/imports/document-engine";
import {
  parseQuestions,
  parseAnswerKey,
  matchKey,
  normalized,
} from "../src/server/imports/layout";
const expected = [
  { number: 12, options: ["چهار", "شش", "پنج", "هفت"], correctOption: 3 },
  { number: 19, options: ["دو", "سه", "چهار", "پنج"], correctOption: 1 },
];
const reference =
  "آزمون تمرین ساختگی و آزاد سؤال 12. حاصل جمع دو و سه چند است؟ 1) چهار 2) شش 3) پنج 4) هفت سؤال 19. حاصل جمع یک و یک چند است؟ 1) دو 2) سه 3) چهار 4) پنج";
function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(
        row[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    prev = row;
  }
  return prev[b.length];
}
const rows = [];
const docs = new Map();
for (const file of [
  "text-fa",
  "scan-fa",
  "mixed-fa",
  "science",
  "key-table",
  "key-image",
  "key-partial",
]) {
  const temp = await mkdtemp(join(tmpdir(), "hodhod-bench-"));
  try {
    const pages = await processDocument(
      `tests/fixtures/exams/${file}.pdf`,
      temp,
    );
    const lines = pages.flatMap((p) => p.lines);
    docs.set(file, { pages, lines });
    const sizes = Object.fromEntries(
      pages.map((p) => [p.page, { width: p.width, height: p.height }]),
    );
    const qs = parseQuestions(lines, sizes);
    const keys = parseAnswerKey(lines);
    const labels =
      file === "science"
        ? [
            {
              number: 31,
              options: ["سه", "چهار", "پنج", "شش"],
              correctOption: 3,
            },
          ]
        : expected;
    const isQuestion = !file.startsWith("key");
    const predicted = qs.filter((q) => q.number !== null);
    const detected = new Set(
      predicted
        .filter((q) => labels.some((e) => q.number === e.number))
        .map((q) => q.number),
    ).size;
    const falsePositive = predicted.length - detected;
    const falseNegative = labels.length - detected;
    const optionsCorrect = labels.reduce(
      (total, e) =>
        total +
        (qs
          .find((q) => q.number === e.number)
          ?.options.filter(
            (o, i) => normalized(o) === normalized(e.options[i] ?? ""),
          ).length ?? 0),
      0,
    );
    rows.push({
      fixture: file,
      pages: pages.length,
      methods: pages.map((p) => p.method),
      millisecondsPerPage:
        pages.reduce((n, p) => n + p.milliseconds, 0) / pages.length,
      questionDetectionRecall: isQuestion ? detected / labels.length : null,
      questionDetectionPrecision: isQuestion
        ? detected / Math.max(1, predicted.length)
        : null,
      falsePositive: isQuestion ? falsePositive : null,
      falseNegative: isQuestion ? falseNegative : null,
      unnumberedReviewRegions: qs.filter((q) => q.number === null).length,
      optionExtractionAccuracy: isQuestion
        ? optionsCorrect / (labels.length * 4)
        : null,
      keyAccuracy:
        file === "key-table" || file === "key-image"
          ? keys.entries.filter((k) =>
              expected.some(
                (e) => e.number === k.number && e.correctOption === k.option,
              ),
            ).length / Math.max(1, keys.entries.length)
          : null,
      keyRecall:
        file === "key-table" || file === "key-image"
          ? keys.entries.filter((k) =>
              expected.some(
                (e) => e.number === k.number && e.correctOption === k.option,
              ),
            ).length / 2
          : null,
      ocrCharacterErrorRate:
        file === "scan-fa"
          ? distance(
              normalized(reference),
              normalized(lines.map((l) => l.text).join(" ")),
            ) / normalized(reference).length
          : null,
      questions: qs.map((q) => q.number),
      keyEntries: keys.entries.length,
      reviewWarnings:
        qs.reduce((n, q) => n + q.warnings.length, 0) + keys.warnings.length,
    });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
const qdoc = docs.get("text-fa");
const q = parseQuestions(
  qdoc.lines,
  Object.fromEntries(
    qdoc.pages.map((p: { page: number; width: number; height: number }) => [
      p.page,
      { width: p.width, height: p.height },
    ]),
  ),
);
const key = parseAnswerKey(docs.get("key-table").lines);
const matching =
  q.filter((question) => {
    const m = matchKey(question, key.entries);
    return expected.some(
      (e) => e.number === question.number && m.option === e.correctOption,
    );
  }).length / 2;
const output = {
  measuredAt: new Date().toISOString(),
  dataset:
    "Seven original synthetic PDF fixtures; 2 Persian arithmetic questions, 1 science question, text/scan/hybrid and table/image/conflicting keys. Not representative of national exams.",
  definitions: {
    questionDetectionRecall:
      "correctly detected labeled question numbers / expected questions",
    questionDetectionPrecision:
      "unique correct labeled numbers / all numbered predictions; duplicate anchors count as false positives",
    falsePositive: "numbered predictions not matched one-to-one to a label",
    falseNegative: "labeled question numbers not detected",
    optionExtractionAccuracy:
      "exact normalized option text at correct question and option index / labeled options",
    keyAccuracy:
      "correct extracted number-option pairs / extracted pairs (precision)",
    keyRecall: "correct extracted number-option pairs / expected pairs",
    matchingAccuracy:
      "correct automatic matches by real question number / labeled questions",
    ocrCharacterErrorRate:
      "Levenshtein distance of normalized full scanned-page text to manually authored reference / reference characters; includes punctuation and reading order",
    millisecondsPerPage: "wall clock local extraction+render+OCR / page count",
  },
  matchingAccuracy: matching,
  generalExamAccuracy: "Not measured",
  rows,
  versions: JSON.parse(await readFile("config/ocr-models.lock.json", "utf8")),
};
await writeFile(
  "docs/EXAM_EXTRACTION_METRICS.json",
  JSON.stringify(output, null, 2) + "\n",
);
console.log(JSON.stringify(output, null, 2));
