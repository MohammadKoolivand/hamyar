import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDuplicateText, questionFingerprint, lexicalScore, duplicateInputFromStoredQuestion,
} from "../../src/server/question-duplicates";

test("duplicate fingerprint normalizes Persian and Arabic yeh/kaf, numbers and whitespace", () => {
  const first = { statement: "كدام گزینه ۳ + ۲ است؟", type: "choice", options: ["الف", "۵"] };
  const second = { statement: "کدام   گزینه 3 + 2 است؟", type: "choice", options: ["الف", "٥"] };
  assert.equal(questionFingerprint(first), questionFingerprint(second));
  assert.equal(normalizeDuplicateText(" كیف ۲‌ سطر "), "کیف 2 سطر");
});

test("option order, math signs, powers, differing values, and diagrams remain distinguishable", () => {
  const q = { statement: "x² + ۲ = ۶", type: "choice", options: ["۲", "۳"] };
  assert.notEqual(questionFingerprint(q), questionFingerprint({ ...q, options: ["۳", "۲"] }));
  assert.notEqual(questionFingerprint(q), questionFingerprint({ ...q, statement: "x² - ۲ = ۶" }));
  assert.notEqual(questionFingerprint(q), questionFingerprint({ ...q, statement: "x2 + ۲ = ۶" }));
  assert.notEqual(questionFingerprint(q), questionFingerprint({
    ...q, visuals: [{ kind: "image", assetId: "11111111-1111-4111-8111-111111111111" }],
  }));
  assert.notEqual(questionFingerprint(q), questionFingerprint({
    ...q, visuals: [{ kind: "image", assetId: "22222222-2222-4222-8222-222222222222" }],
  }));
});

test("text similarity is only a suggestion, not an exact duplicate decision", () => {
  assert.ok(lexicalScore("پایتخت کشور ایران کدام شهر است", "پایتخت ایران کدام شهر است") >= 0.65);
  assert.ok(lexicalScore("۳x + ۲ = ۱۱", "۳x + ۵ = ۱۴") > 0);
});


test("stored MongoDB question is validated before matching or fingerprinting", () => {
  const source = {
    _id: "11111111-1111-4111-8111-111111111111",
    statement: "اندازه زاویه چقدر است؟",
    type: "choice", options: ["۳۰", "۶۰"],
    reference: "۶۰", visibility: "private",
  };
  assert.deepEqual(duplicateInputFromStoredQuestion(source), {
    statement: source.statement, type: source.type, options: source.options,
  });
  assert.throws(() => duplicateInputFromStoredQuestion({ _id: source._id, type: "choice" }));
});
