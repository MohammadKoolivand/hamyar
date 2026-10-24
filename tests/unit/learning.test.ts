import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mastery,
  mistake,
  summarize,
  type Evidence,
} from "../../src/server/learning/model";
const make = (patch: Partial<Evidence> = {}): Evidence => ({
  _id: "a1",
  assignmentId: "m1",
  studentId: "s1",
  teacherId: "t1",
  questionVersionId: "v1",
  questionId: "q1",
  skillIds: ["skill1"],
  evaluationId: "e1",
  result: "incorrect",
  method: "deterministic",
  sequence: 1,
  hintsUsed: 0,
  createdAt: "2026-10-24T00:00:00.000Z",
  verified: true,
  ...patch,
});
test("assisted correction does not inflate first-attempt independent success or resolve a mistake", () => {
  const wrong = make(),
    assisted = make({
      _id: "a2",
      sequence: 2,
      result: "correct",
      hintsUsed: 1,
      createdAt: "2026-10-24T01:00:00.000Z",
    }),
    summary = summarize([wrong, assisted]);
  assert.equal(summary.independentSuccessRate, 0);
  assert.equal(summary.assisted, 1);
  assert.equal(mistake(wrong, [wrong, assisted]).status, "needs_practice");
  assert.equal(mastery([assisted]).status, "insufficient_evidence");
});
test("mastery requires varied independent evidence; repeated same-question practice is insufficient", () => {
  const good = [1, 2, 3].map((n) =>
    make({
      _id: "a" + n,
      questionId: "q" + n,
      questionVersionId: "v" + n,
      result: "correct",
    }),
  );
  assert.equal(mastery(good).status, "proficient");
  assert.equal(
    mastery(good.map((e) => ({ ...e, questionId: "same" }))).status,
    "insufficient_evidence",
  );
  assert.equal(mastery([]).status, "not_started");
});
test("mistake resolution needs two independent, distinct followups in the same relationship", () => {
  const wrong = make(),
    one = make({
      _id: "f1",
      questionId: "q2",
      result: "correct",
      createdAt: "2026-10-24T01:00:00.000Z",
    }),
    two = make({
      ...one,
      _id: "f2",
      questionId: "q3",
      createdAt: "2026-10-24T02:00:00.000Z",
    });
  assert.equal(mistake(wrong, [wrong, one]).status, "improvement_observed");
  assert.equal(mistake(wrong, [wrong, one, two]).status, "resolved");
  assert.equal(
    mistake(wrong, [
      { ...one, teacherId: "other" },
      { ...two, hintsUsed: 1 },
    ]).status,
    "needs_practice",
  );
  assert.equal(
    mistake({ ...wrong, result: "correct", method: "teacher_verified" }, [])
      .status,
    "corrected_by_review",
  );
});
