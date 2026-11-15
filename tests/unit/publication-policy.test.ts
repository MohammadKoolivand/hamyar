import assert from "node:assert/strict";
import { test } from "node:test";
import { visibilityForAuthoredQuestion } from "../../src/server/publication-policy";

test("production never directly publishes a new or revised question", () => {
  assert.equal(visibilityForAuthoredQuestion("public", "public", "production"), "private");
  assert.equal(visibilityForAuthoredQuestion(undefined, "public", "production"), "private");
  assert.equal(visibilityForAuthoredQuestion("private", "private", "production"), "private");
});

test("development and test preserve old flows until public moderation rollout", () => {
  assert.equal(visibilityForAuthoredQuestion("public", "private", "test"), "public");
  assert.equal(visibilityForAuthoredQuestion(undefined, "public", "test"), "public");
  assert.equal(visibilityForAuthoredQuestion("private", "public", "test"), "private");
});
