import { test } from "node:test";
import assert from "node:assert/strict";
import { isIndependentLibraryPractice } from "../../src/lib/independent-practice";

test("independent practice detects legacy synthetic courses and explicit mode", () => {
  const q = "11111111-1111-4111-8111-111111111111";
  assert.equal(isIndependentLibraryPractice({ courseId: q, libraryQuestionId: q }), true);
  assert.equal(isIndependentLibraryPractice({ practiceMode: "self" }), true);
  assert.equal(isIndependentLibraryPractice({
    courseId: "22222222-2222-4222-8222-222222222222",
    libraryQuestionId: q,
  }), false);
  assert.equal(isIndependentLibraryPractice({ courseId: q }), false);
});
