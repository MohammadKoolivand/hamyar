import assert from "node:assert/strict";
import test from "node:test";
import {
  difficultyBucket,
  empiricalDifficultyScore,
} from "../../src/lib/difficulty";

test("exam difficulty score is unset without student responses", () => {
  assert.equal(empiricalDifficultyScore(0, 0), null);
});

test("exam difficulty score measures the percentage of incorrect responses", () => {
  assert.equal(empiricalDifficultyScore(10, 0), 0);
  assert.equal(empiricalDifficultyScore(0, 10), 100);
  assert.equal(empiricalDifficultyScore(7, 3), 30);
  assert.equal(empiricalDifficultyScore(2, 1), 33);
});

test("empirical score maps to legacy selection buckets", () => {
  assert.equal(difficultyBucket(33), "easy");
  assert.equal(difficultyBucket(34), "medium");
  assert.equal(difficultyBucket(66), "medium");
  assert.equal(difficultyBucket(67), "hard");
});
