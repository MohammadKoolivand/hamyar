import { test } from "node:test";
import assert from "node:assert/strict";
import { groupDuplicateQuestions } from "../../src/server/modules/duplicate-management";
import { questionFingerprint } from "../../src/server/question-duplicates";

function example(questionId: string, statement: string, options = ["۲", "۳"]) {
  const input = { statement, type: "choice", options, visuals: [], optionImages: [] };
  return {
    questionId, versionId: questionId, ownerId: "owner",
    ...input, fingerprint: questionFingerprint(input),
  };
}

test("duplicate management groups exact copies and preserves original question ids", () => {
  const a = example("a", "حاصل دو بعلاوه دو چیست؟");
  const b = example("b", "حاصل دو بعلاوه دو چیست؟");
  const c = example("c", "یک سؤال کاملا متفاوت");
  const groups = groupDuplicateQuestions([a, b, c]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "exact");
  assert.deepEqual(groups[0].questions.map((q) => q.questionId), ["a", "b"]);
});

test("same statement with a different answer option is similar, never exact", () => {
  const a = example("a", "حاصل دو بعلاوه دو چیست؟", ["۴", "۵"]);
  const b = example("b", "حاصل دو بعلاوه دو چیست؟", ["۴", "۶"]);
  const groups = groupDuplicateQuestions([a, b]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "similar");
  assert.equal(groups[0].score, 1);
});
