import assert from "node:assert/strict";
import { test } from "node:test";
import { visibilityForAuthoredQuestion } from "../../src/server/publication-policy";

test("new and revised questions are always public in every environment", () => {
  for (const environment of ["production", "test", "development"]) {
    assert.equal(visibilityForAuthoredQuestion("public", "public", environment), "public");
    assert.equal(visibilityForAuthoredQuestion(undefined, "public", environment), "public");
    assert.equal(visibilityForAuthoredQuestion("private", "private", environment), "public");
  }
});
