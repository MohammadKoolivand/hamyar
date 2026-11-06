import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fixture } from "../helpers/fixture";

const secrets = {
  reference: "PRIVATE_ANSWER_KEY_7391",
  solution: "PRIVATE_FULL_SOLUTION_7391",
};

function excludesSecrets(body: string) {
  assert.equal(body.includes(secrets.reference), false, body);
  assert.equal(body.includes(secrets.solution), false, body);
}

test("student APIs keep answer keys, full solutions and final results private until server release time", async () => {
  const f = await fixture();
  try {
    const student = (await f.c("users").findOne({ email: "s@test.dev" }))!;
    const question = await f.post(
      "/api/questions",
      {
        topicId: f.question.topicId,
        statement: "سؤال دارای نتیجه زمان‌بندی‌شده",
        type: "choice",
        options: ["پاسخ عمومی", secrets.reference],
        reference: secrets.reference,
        hints: ["راهنمای عمومی"],
      },
      f.teacher,
    );
    const releaseAt = new Date(Date.now() + 86_400_000).toISOString();
    const mission = await f.post(
      "/api/missions",
      {
        title: "نتیجه زمان‌بندی‌شده",
        studentId: student._id,
        questionVersionIds: [question._id],
        policy: {
          feedbackMode: "immediate",
          resultReleaseAt: releaseAt,
          maxAttempts: 1,
          maxHints: 1,
          maxHintLevel: 4,
          allowFullSolution: true,
          independent: false,
        },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    const assignment = (await f.c("assignments").findOne({
      missionId: mission._id,
    }))!;
    const path = `/api/assignments/${assignment._id}`;

    await f.c("hintEvents").insertOne({
      _id: randomUUID(),
      assignmentId: assignment._id,
      questionVersionId: question._id,
      text: secrets.solution,
      provider: "teacher-solution",
      level: 4,
      requestedLevel: 4,
      createdAt: new Date().toISOString(),
    });

    const detailBefore = await f.request(path, undefined, f.student);
    assert.equal(detailBefore.statusCode, 200, detailBefore.body);
    excludesSecrets(detailBefore.body);
    assert.deepEqual(detailBefore.json().evaluations, []);
    assert.equal(detailBefore.json().hints.length, 0);

    const submitted = await f.request(
      path + "/attempts",
      { questionId: question._id, answer: secrets.reference },
      f.student,
    );
    assert.equal(submitted.statusCode, 200, submitted.body);
    excludesSecrets(submitted.body);
    assert.equal(submitted.json().evaluation, undefined);

    assert.equal(
      (await f.request(path + "/report", undefined, f.student)).statusCode,
      409,
    );
    await f.post(path + "/complete", {}, f.student);

    const completedButScheduled = await f.request(path, undefined, f.student);
    excludesSecrets(completedButScheduled.body);
    assert.deepEqual(completedButScheduled.json().evaluations, []);
    assert.equal(
      (await f.request(path + "/report", undefined, f.student)).statusCode,
      409,
    );

    await f.c("assignments").updateOne(
      { _id: assignment._id },
      {
        $set: {
          "policy.resultReleaseAt": new Date(Date.now() - 1000).toISOString(),
        },
      },
    );
    const released = await f.request(path + "/report", undefined, f.student);
    assert.equal(released.statusCode, 200, released.body);
    assert.equal(released.json().questions[0].reference, secrets.reference);
    assert.equal(released.json().questions[0].result, "correct");
  } finally {
    await f.close();
  }
});

test("direct question and changed assignment identifiers cannot expose another student's restricted result", async () => {
  const f = await fixture();
  try {
    const invite = await f.post(
      "/api/invitations",
      { email: "result-other@student.test" },
      f.teacher,
    );
    await f.post("/api/invitations/accept", {
      name: "Other Student",
      email: "result-other@student.test",
      password: "StrongPass123!",
      token: invite.token,
    });
    const login = await f.request("/api/auth/login", {
      email: "result-other@student.test",
      password: "StrongPass123!",
    });
    const otherStudent = `session=${login.cookies[0].value}`;

    const attempt = await f.request(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "2" },
      f.student,
    );
    assert.equal(attempt.statusCode, 200, attempt.body);

    for (const endpoint of [f.path, f.path + "/report"]) {
      const response = await f.request(endpoint, undefined, otherStudent);
      assert.equal(response.statusCode, 404, response.body);
      assert.equal(response.body.includes("correct"), false, response.body);
      assert.equal(response.body.includes("reference"), false, response.body);
    }
    assert.equal(
      (await f.request(`/api/questions/${f.question._id}`, undefined, f.student))
        .statusCode,
      403,
    );
  } finally {
    await f.close();
  }
});
