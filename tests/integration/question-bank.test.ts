import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
test("question bank stores optional year/difficulty and free questions, validates metadata and isolates teacher data", async () => {
  const f = await fixture();
  try {
    const body = {
      classification: "free",
      statement: "حاصل دو به اضافه سه چیست؟",
      type: "numeric",
      reference: "5",
      difficulty: "medium",
      year: 1405,
    };
    const q = await f.post(
      "/api/questions",
      body,
      f.teacher,
      "free-question-intent",
    );
    assert.equal(q.topicId, undefined);
    assert.equal(q.difficulty, "medium");
    assert.equal(q.year, 1405);
    const list = (
      await f.request("/api/questions", undefined, f.teacher)
    ).json();
    assert.ok(
      list.some(
        (r: { _id: string; year: number }) =>
          r._id === q._id && r.year === 1405,
      ),
    );
    for (const invalid of [
      { ...body, year: 1405.5 },
      { ...body, year: 1200 },
      { ...body, difficulty: "very-hard" },
      { ...body, classification: "topic" },
      { ...body, topicId: f.question.topicId },
    ]) {
      assert.equal(
        (await f.request("/api/questions", invalid, f.teacher)).statusCode,
        400,
      );
    }
    assert.equal(
      (await f.request("/api/questions", body, f.student)).statusCode,
      403,
    );
    await f.post("/api/auth/register", {
      name: "Other Teacher",
      email: "bank-other@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "bank-other@test.dev",
      password: "StrongPass123!",
    });
    const other = "session=" + login.cookies[0].value;
    assert.deepEqual(
      (await f.request("/api/questions", undefined, other)).json(),
      [],
    );
    const students = (
      await f.request("/api/students", undefined, f.teacher)
    ).json();
    const mission = await f.post(
      "/api/missions",
      {
        title: "تمرین آزاد",
        studentId: students[0]._id,
        questionVersionIds: [q._id],
        policy: { maxHints: 0, maxAttempts: 2, independent: true },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    const assignment = await f
      .c("assignments")
      .findOne({ missionId: mission._id });
    const attempt = await f.request(
      `/api/assignments/${assignment!._id}/attempts`,
      { questionId: q._id, answer: "5" },
      f.student,
      "free-attempt",
    );
    assert.equal(attempt.statusCode, 200, attempt.body);
  } finally {
    await f.close();
  }
});
