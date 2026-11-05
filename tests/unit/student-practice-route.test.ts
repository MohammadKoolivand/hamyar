import assert from "node:assert/strict";
import test from "node:test";
import { defaultPracticeFilters, parsePracticeFilters, practiceFiltersPath } from "../../src/lib/student-practice-route";

test("practice filters survive a shareable URL round-trip", () => {
  const filters = { ...defaultPracticeFilters, query: "حد", kind: "final", course: "course-1", chapter: "ch-1", topic: "topic-1", year: "1404", minDifficulty: 27, maxDifficulty: 83, sort: "hardest" };
  assert.deepEqual(parsePracticeFilters(new URL(practiceFiltersPath(filters), "https://example.test").search), filters);
});

test("invalid practice parameters are safely normalized", () => {
  const parsed = parsePracticeFilters("?kind=invalid&difficulty=bad&minDifficulty=-2&maxDifficulty=1000&sort=unknown");
  assert.equal(parsed.kind, "all");
  assert.equal(parsed.difficulty, "all");
  assert.equal(parsed.sort, "priority");
  assert.equal(parsed.minDifficulty, 0);
  assert.equal(parsed.maxDifficulty, 100);
});

test("min difficulty cannot exceed max on restore", () => {
  assert.deepEqual([parsePracticeFilters("?minDifficulty=90&maxDifficulty=30").minDifficulty, parsePracticeFilters("?minDifficulty=90&maxDifficulty=30").maxDifficulty], [90, 90]);
});
