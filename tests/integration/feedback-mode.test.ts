import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
test("teacher can defer student feedback until completion, including reports/dashboard/mastery and idempotent attempts", async () => {
  const f = await fixture();
  try {
    const students = (
      await f.request("/api/students", undefined, f.teacher)
    ).json();
    const mission = await f.post(
      "/api/missions",
      {
        title: "ارزیابی در پایان",
        studentId: students[0]._id,
        questionVersionIds: [f.question._id],
        policy: {
          maxAttempts: 2,
          maxHints: 0,
          independent: true,
          feedbackMode: "end",
        },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    const rows = (
      await f.request("/api/missions", undefined, f.student)
    ).json();
    const a = rows.find(
      (a: { missionId: string }) => a.missionId === mission._id,
    );
    const path = `/api/assignments/${a._id}`;
    const body = {
      questionId: f.question._id,
      answer: "2",
      expectedAttempt: 1,
    };
    const result = await f.post(
      path + "/attempts",
      body,
      f.student,
      "deferred-test-key",
    );
    assert.equal(result.evaluation, undefined);
    assert.equal(
      (await f.post(path + "/attempts", body, f.student, "deferred-test-key"))
        .evaluation,
      undefined,
    );
    assert.deepEqual(
      (await f.request(path, undefined, f.student)).json().evaluations,
      [],
    );
    assert.equal(
      (await f.request(path + "/report", undefined, f.student)).statusCode,
      409,
    );
    assert.equal(
      (await f.request(path + "/report", undefined, f.teacher)).statusCode,
      200,
    );
    const dashboard = (
      await f.request("/api/student/dashboard", undefined, f.student)
    ).json();
    assert.equal(dashboard.summary.correctIndependent, 0);
    const progress = (
      await f.request(
        `/api/students/${students[0]._id}/progress`,
        undefined,
        f.student,
      )
    ).json();
    assert.equal(JSON.stringify(progress).includes(a._id), false);
    await f.post(path + "/complete", {}, f.student);
    assert.equal(
      (await f.request(path, undefined, f.student)).json().evaluations[0]
        .result,
      "correct",
    );
    assert.equal(
      (await f.request(path + "/report", undefined, f.student)).json()
        .independent,
      1,
    );
  } finally {
    await f.close();
  }
});
