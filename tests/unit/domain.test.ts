import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, normalize, questionSchema } from "../../src/server/domain";
const base = {
  topicId: "9386225f-12d4-4d4d-bc19-dbe7b27d1196",
  skillIds: [],
  statement: "پاسخ را بنویسید",
  type: "numeric" as const,
  reference: "2.5",
  options: [],
  tolerance: 0.01,
  hints: [],
};
test("Persian numeric answers normalize and tolerance is respected", () => {
  assert.equal(normalize(" ۲٫۵ "), "2.5");
  assert.equal(evaluate(base, "۲٫۵").result, "correct");
  assert.equal(evaluate(base, "2.6").result, "incorrect");
  assert.equal(evaluate(base, "Infinity").result, "incorrect");
});
test("essay is never automatically marked correct", () =>
  assert.equal(
    evaluate({ ...base, type: "essay" }, "2.5").result,
    "pending_review",
  ));
test("invalid numeric and multiple choice references are rejected", () => {
  assert.equal(
    questionSchema.safeParse({ ...base, reference: "NaN" }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({
      ...base,
      type: "choice",
      options: ["A", "B"],
      reference: "C",
    }).success,
    false,
  );
});
