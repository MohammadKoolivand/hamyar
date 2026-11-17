import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeRoles } from "../../src/lib/access";
import {
  inferExpectedQuestionCount, countUniqueApprovedQuestions,
  calculateExamProgress, estimateLegacyQuestionCount,
} from "../../src/lib/exam-import-progress";

const numbers = (length: number) =>
  Array.from({ length }, (_, i) => ({ number: i + 1 }));
const key = (length: number) =>
  Array.from({ length }, (_, i) => ({ number: i + 1, option: (i % 4) + 1 }));

test("complete answer key establishes 150-question denominator with 130 actually entered", () => {
  const total = inferExpectedQuestionCount({ questions: numbers(130), answerEntries: key(150) });
  assert.deepEqual(total, { expectedQuestionCount: 150, expectedCountConfidence: "key_complete" });
  assert.deepEqual(calculateExamProgress({ ...total, approved: 130, extracted: 140 }), {
    approved: 130, extracted: 140, expectedQuestionCount: 150,
    expectedCountConfidence: "key_complete", percent: 87, status: "partial",
  });
});

test("full completion is automatic ONLY when validated key total equals approved", () => {
  const total = inferExpectedQuestionCount({ questions: numbers(150), answerEntries: key(150) });
  assert.equal(calculateExamProgress({ ...total, approved: 150, extracted: 150 }).status, "complete");
  assert.equal(calculateExamProgress({ ...total, approved: 149, extracted: 150 }).status, "partial");
  assert.equal(calculateExamProgress({ ...total, approved: 151, extracted: 151 }).status, "partial");
});

test("rejected, pending and duplicate source numbers never inflate imported count", () => {
  const items = [
    { _id: "a", state: "approved" as const, originalNumber: 1, questionVersionId: "v1" },
    { _id: "b", state: "approved" as const, originalNumber: 1, questionVersionId: "v2" },
    { _id: "c", state: "approved" as const, originalNumber: 2, questionVersionId: "v3" },
    { _id: "d", state: "pending" as const, originalNumber: 3, questionVersionId: null },
    { _id: "e", state: "rejected" as const, originalNumber: 4, questionVersionId: null },
    { _id: "f", state: "approved" as const, detectedNumber: 5, questionVersionId: "v5" },
    { _id: "g", state: "approved" as const, detectedNumber: 5, questionVersionId: "v6" },
    { _id: "h", state: "approved" as const, questionVersionId: "v7" },
    { _id: "i", state: "approved" as const, questionVersionId: "v8" },
    { _id: "j", state: "approved" as const, originalNumber: 9 },
  ];
  assert.equal(countUniqueApprovedQuestions(items), 5);
});

test("OCR numbering alone is an estimate, never automatically marked complete", () => {
  const source = [...numbers(100), { number: 150 }];
  const total = inferExpectedQuestionCount({ questions: source, answerEntries: [] });
  assert.deepEqual(total, { expectedQuestionCount: 150, expectedCountConfidence: "numbering_estimate" });
  assert.equal(calculateExamProgress({ ...total, approved: 150, extracted: 150 }).status, "partial");
});

test("incomplete or contradictory source remains unknown rather than faking a total", () => {
  assert.deepEqual(inferExpectedQuestionCount({ questions: [{ number: null }] }), {
    expectedQuestionCount: null, expectedCountConfidence: "unknown",
  });
  const total = inferExpectedQuestionCount({ questions: [{ number: 3 }], answerEntries: [{ number: 1, option: 1 }] });
  assert.equal(total.expectedQuestionCount, null);
  assert.equal(calculateExamProgress({ ...total, approved: 20, extracted: 20 }).percent, null);
});

test("duplicated OCR answer numbers or failed key pages cannot establish a confirmed total", () => {
  const duplicated = inferExpectedQuestionCount({ questions: numbers(100), answerEntries: [...key(130), key(1)[0]] });
  assert.notEqual(duplicated.expectedCountConfidence, "key_complete");
  const failed = inferExpectedQuestionCount({ questions: numbers(100), answerEntries: key(150), failedAnswerPages: 1 });
  assert.notEqual(failed.expectedCountConfidence, "key_complete");
});

test("a source with more numbered questions than the answer key is not falsely complete", () => {
  const total = inferExpectedQuestionCount({ questions: numbers(150), answerEntries: key(130) });
  assert.deepEqual(total, { expectedQuestionCount: 150, expectedCountConfidence: "numbering_estimate" });
});

test("old exam imports automatically recover a conservative estimated denominator from saved key count", () => {
  assert.deepEqual(estimateLegacyQuestionCount({
    keyEntries: 150, hasAnswerFile: true, failedAnswerPages: 0,
  }), { expectedQuestionCount: 150, expectedCountConfidence: "numbering_estimate" });
  assert.equal(estimateLegacyQuestionCount({
    keyEntries: 150, hasAnswerFile: false,
  }).expectedQuestionCount, null);
  assert.equal(estimateLegacyQuestionCount({
    keyEntries: 150, hasAnswerFile: true, failedAnswerPages: 1,
  }).expectedQuestionCount, null);
});

test("public exam progress endpoint is read-only and counts only verified published questions", () => {
  assert.equal(routeRoles("GET", "/api/exam-catalog/public-progress"), null);
  const server = readFileSync("src/server/modules/content.ts", "utf8");
  assert.match(server, /app\.get\("\/api\/exam-catalog\/public-progress"/);
  assert.match(server, /"current\.visibility": "public"/);
  assert.match(server, /"current\.verifiedAt": \{ \$exists: true \}/);
  assert.match(server, /"current\.sourceExamId": \{ \$type: "string" \}/);
  const screen = readFileSync("src/features/content/exam-catalog-page.tsx", "utf8");
  assert.match(screen, /publishedByCategory/);
  assert.match(screen, /entry\.expectedQuestionCount/);
  assert.match(screen, /role="progressbar"/);
});

test("exam import approval preserves detected original numbering", () => {
  const server = readFileSync("src/server/modules/exam-imports.ts", "utf8");
  assert.match(server, /approvedOriginalNumber = b\.originalNumber \?\? item!\.originalNumber \?\? item!\.extraction\?\.detectedNumber/);
  assert.match(server, /approvedKeys: \{/);
});
