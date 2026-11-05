import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRecentMissions, learningNextStep, missionSuccessRate, type RecentLearningMission } from "../../src/features/analytics/learning-report-model";
const mission: RecentLearningMission = { assignmentId: "one", title: "تمرین ریاضی", state: "completed", total: 10, answered: 6, independent: 2, assisted: 1, incorrect: 2, pending: 1 };
test("success rate excludes unanswered and pending work", () => {
  assert.equal(missionSuccessRate(mission), 3 / 5);
  assert.equal(missionSuccessRate({ ...mission, independent: 0, assisted: 0, incorrect: 0 }), null);
});
test("mission filters combine title, review evidence, and completion state", () => {
  const another = { ...mission, assignmentId: "two", title: "علوم", state: "in_progress", incorrect: 0, pending: 0 };
  assert.deepEqual(filterRecentMissions([mission, another], "needs-review", "ریاضی").map((item) => item.assignmentId), ["one"]);
  assert.deepEqual(filterRecentMissions([mission, another], "finished", "").map((item) => item.assignmentId), ["one"]);
});
test("learning next step prioritizes observed review needs over unsupported weakness claims", () => {
  assert.match(learningNextStep([{ status: "needs_review", incorrect: 2, title: "کسرها" }]), /کسرها/);
  assert.match(learningNextStep([]), /اولین تمرین/);
});
