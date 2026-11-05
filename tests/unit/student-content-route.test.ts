import assert from "node:assert/strict";
import test from "node:test";
import {
  parseStudentContentFilters,
  studentContentPath,
} from "../../src/lib/student-content-route";

test("student content filters survive a direct-link round trip", () => {
  const filters = {
    grade: "grade-12",
    track: "math",
    book: "calculus",
    chapter: "chapter-1",
    topic: "limits",
    content: "exams" as const,
  };

  const path = studentContentPath(filters);

  assert.deepEqual(
    parseStudentContentFilters(new URL(path, "https://example.test").search),
    filters,
  );
});

test("student content filters safely default an unknown content kind", () => {
  assert.equal(
    parseStudentContentFilters("?content=private").content,
    "questions",
  );
});
