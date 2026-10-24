import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "../helpers/fixture";
import { buildApp } from "../../src/server/app";

for (const boundary of [
  "after_attempt_counter",
  "after_attempt_insert",
  "after_evaluation_insert",
  "after_learning_evidence",
  "before_operation_record",
])
  test(`attempt rollback and retry after ${boundary}`, async () => {
    let armed = false,
      failed = false;
    const f = await fixture({
      hooks: {
        async boundary(name) {
          if (armed && !failed && name === boundary) {
            failed = true;
            throw new Error("injected database failure");
          }
        },
      },
    });
    try {
      armed = true;
      const key = randomUUID(),
        body = { questionId: f.question._id, answer: "2" };
      assert.equal(
        (await f.request(f.path + "/attempts", body, f.student, key))
          .statusCode,
        500,
      );
      assert.equal(
        await f
          .c("attempts")
          .countDocuments({ assignmentId: f.assignment._id }),
        0,
      );
      assert.equal(
        await f
          .c("evaluations")
          .countDocuments({ assignmentId: f.assignment._id }),
        0,
      );
      assert.equal(
        (await f.c("assignments").findOne({ _id: f.assignment._id }))!.progress[
          f.question._id
        ].attempts,
        0,
      );
      const good = await f.post(f.path + "/attempts", body, f.student, key),
        replay = await f.post(f.path + "/attempts", body, f.student, key);
      assert.deepEqual(good, replay);
      assert.equal(
        await f
          .c("attempts")
          .countDocuments({ assignmentId: f.assignment._id }),
        1,
      );
    } finally {
      await f.close();
    }
  });
for (const boundary of ["after_hint_counter", "after_hint_insert"])
  test(`hint rollback and retry after ${boundary}`, async () => {
    let armed = false,
      failed = false;
    const f = await fixture({
      hooks: {
        async boundary(name) {
          if (armed && !failed && name === boundary) {
            failed = true;
            throw new Error("injected failure");
          }
        },
      },
    });
    try {
      armed = true;
      const key = randomUUID(),
        body = { questionId: f.question._id };
      assert.equal(
        (await f.request(f.path + "/hints", body, f.student, key)).statusCode,
        500,
      );
      assert.equal(
        await f
          .c("hintEvents")
          .countDocuments({ assignmentId: f.assignment._id }),
        0,
      );
      assert.equal(
        (await f.c("assignments").findOne({ _id: f.assignment._id }))!.progress[
          f.question._id
        ].hints,
        0,
      );
      await f.post(f.path + "/hints", body, f.student, key);
      assert.equal(
        await f
          .c("hintEvents")
          .countDocuments({ assignmentId: f.assignment._id }),
        1,
      );
    } finally {
      await f.close();
    }
  });
test("lost response after commit survives app restart and replays the same evidence", async () => {
  let armed = false;
  const f = await fixture({
    hooks: {
      async boundary(name) {
        if (armed && name === "after_commit") throw new Error("lost response");
      },
    },
  });
  try {
    armed = true;
    const key = randomUUID(),
      body = { questionId: f.question._id, answer: "2" };
    assert.equal(
      (await f.request(f.path + "/attempts", body, f.student, key)).statusCode,
      500,
    );
    assert.equal(
      await f.c("attempts").countDocuments({ assignmentId: f.assignment._id }),
      1,
    );
    const restart = await buildApp(f.db);
    await restart.ready();
    const replay = await restart.inject({
      method: "POST",
      url: f.path + "/attempts",
      headers: { cookie: f.student, "idempotency-key": key },
      payload: body,
    });
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(
      await f.c("attempts").countDocuments({ assignmentId: f.assignment._id }),
      1,
    );
    assert.equal(replay.json().attempt.sequence, 1);
    await restart.close();
  } finally {
    await f.close();
  }
});
test("concurrent identical requests consume one quota; changed payload conflicts", async () => {
  const f = await fixture({ maxAttempts: 2 });
  try {
    const key = randomUUID(),
      body = { questionId: f.question._id, answer: "2" };
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        f.request(f.path + "/attempts", body, f.student, key),
      ),
    );
    assert.ok(
      responses.every((r) => r.statusCode === 200),
      responses.map((r) => r.body).join("\n"),
    );
    assert.equal(new Set(responses.map((r) => r.json().attempt._id)).size, 1);
    assert.equal(
      await f.c("attempts").countDocuments({ assignmentId: f.assignment._id }),
      1,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/attempts",
          { ...body, answer: "3" },
          f.student,
          key,
        )
      ).statusCode,
      409,
    );
    const hints = await Promise.all(
      Array.from({ length: 6 }, () =>
        f.request(
          f.path + "/hints",
          { questionId: f.question._id },
          f.student,
          "same-hint-key",
        ),
      ),
    );
    assert.ok(hints.every((r) => r.statusCode === 200));
    assert.equal(new Set(hints.map((r) => r.json()._id)).size, 1);
    const distinct = await Promise.all(
      Array.from({ length: 6 }, () =>
        f.request(
          f.path + "/hints",
          { questionId: f.question._id },
          f.student,
          randomUUID(),
        ),
      ),
    );
    assert.equal(distinct.filter((r) => r.statusCode === 200).length, 1);
    assert.equal(
      await f
        .c("hintEvents")
        .countDocuments({ assignmentId: f.assignment._id }),
      2,
    );
  } finally {
    await f.close();
  }
});
test("distinct concurrent submissions respect the attempt limit without orphan evaluations", async () => {
  const f = await fixture({ maxAttempts: 2 });
  try {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        f.request(
          f.path + "/attempts",
          { questionId: f.question._id, answer: "1" },
          f.student,
          randomUUID(),
        ),
      ),
    );
    assert.equal(results.filter((r) => r.statusCode === 200).length, 2);
    assert.equal(results.filter((r) => r.statusCode === 409).length, 6);
    assert.equal(
      await f.c("attempts").countDocuments({ assignmentId: f.assignment._id }),
      2,
    );
    assert.equal(
      await f
        .c("evaluations")
        .countDocuments({ assignmentId: f.assignment._id }),
      2,
    );
  } finally {
    await f.close();
  }
});
test("completion serializes with an uncommitted attempt; terminal states reject writes", async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    seen = new Promise<void>((r) => (entered = r));
  let armed = false;
  const f = await fixture({
    hooks: {
      async boundary(name) {
        if (armed && name === "after_attempt_insert") {
          entered();
          await gate;
        }
      },
    },
  });
  try {
    await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "1" },
      f.student,
    );
    armed = true;
    const attempt = f.request(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "2" },
      f.student,
      randomUUID(),
    );
    await seen;
    const completion = f.request(
      f.path + "/complete",
      {},
      f.student,
      randomUUID(),
    );
    release();
    const results = await Promise.all([attempt, completion]);
    assert.ok(
      results.every((r) => r.statusCode === 200),
      results.map((r) => r.body).join(),
    );
    assert.equal(
      (await f.c("assignments").findOne({ _id: f.assignment._id }))!.state,
      "completed",
    );
    assert.equal(
      await f
        .c("evaluations")
        .countDocuments({ assignmentId: f.assignment._id }),
      2,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/attempts",
          { questionId: f.question._id, answer: "2" },
          f.student,
          randomUUID(),
        )
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/hints",
          { questionId: f.question._id },
          f.student,
          randomUUID(),
        )
      ).statusCode,
      409,
    );
    await f.post(f.path + "/complete", {}, f.student);
    assert.equal(
      (await f.request(`/api/missions/${f.mission._id}/cancel`, {}, f.teacher))
        .statusCode,
      409,
    );
  } finally {
    release();
    await f.close();
  }
});
test("review rollback preserves pending state; retries have a single audit/history entry", async () => {
  let armed = false,
    failed = false;
  const f = await fixture({
    essay: true,
    hooks: {
      async boundary(name) {
        if (armed && !failed && name === "after_teacher_review") {
          failed = true;
          throw new Error("fail review");
        }
      },
    },
  });
  try {
    const attempt = await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "Essay" },
      f.student,
    );
    await f.post(f.path + "/complete", {}, f.student);
    armed = true;
    const body = { result: "correct", note: "Teacher checked the rubric" },
      key = randomUUID(),
      url = "/api/evaluations/" + attempt.evaluation._id + "/review";
    assert.equal((await f.request(url, body, f.teacher, key)).statusCode, 500);
    assert.equal(
      (await f.c("assignments").findOne({ _id: f.assignment._id }))!.state,
      "submitted",
    );
    assert.equal(
      (await f.c("evaluations").findOne({ _id: attempt.evaluation._id }))!
        .reviews!.length,
      0,
    );
    await f.post(url, body, f.teacher, key);
    await f.post(url, body, f.teacher, key);
    assert.equal(
      (await f.c("evaluations").findOne({ _id: attempt.evaluation._id }))!
        .reviews!.length,
      1,
    );
    assert.equal(
      (await f.c("assignments").findOne({ _id: f.assignment._id }))!.state,
      "completed",
    );
  } finally {
    await f.close();
  }
});
test("cancellation is terminal, repeated cancellation is safe, cancelled missions cannot publish", async () => {
  const f = await fixture();
  try {
    await f.post(`/api/missions/${f.mission._id}/cancel`, {}, f.teacher);
    await f.post(`/api/missions/${f.mission._id}/cancel`, {}, f.teacher);
    for (const suffix of ["attempts", "hints", "complete"])
      assert.equal(
        (
          await f.request(
            f.path + "/" + suffix,
            suffix === "complete"
              ? {}
              : { questionId: f.question._id, answer: "2" },
            f.student,
          )
        ).statusCode,
        409,
      );
    assert.equal(
      (await f.request(`/api/missions/${f.mission._id}/publish`, {}, f.teacher))
        .statusCode,
      409,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: {
            cookie: f.student,
            origin: "https://evil.test",
            host: "evil.test",
          },
          payload: {},
        })
      ).statusCode,
      403,
    );
  } finally {
    await f.close();
  }
});
for (const boundary of ["after_assignment_insert", "after_invited_user_insert"])
  test(`publication/invitation rollback after ${boundary}`, async () => {
    let armed = false,
      failed = false;
    const f = await fixture({
      hooks: {
        async boundary(name) {
          if (armed && !failed && name === boundary) {
            failed = true;
            throw new Error("injected");
          }
        },
      },
    });
    try {
      armed = true;
      if (boundary === "after_assignment_insert") {
        const mission = await f.create();
        assert.equal(
          (
            await f.request(
              `/api/missions/${mission._id}/publish`,
              {},
              f.teacher,
              "publish-retry-key",
            )
          ).statusCode,
          500,
        );
        assert.equal(
          await f.c("assignments").countDocuments({ missionId: mission._id }),
          0,
        );
        assert.equal(
          (await f.c("missions").findOne({ _id: mission._id }))!.state,
          "draft",
        );
        await f.post(
          `/api/missions/${mission._id}/publish`,
          {},
          f.teacher,
          "publish-retry-key",
        );
      } else {
        const inv = await f.post(
            "/api/invitations",
            { email: "new@test.dev" },
            f.teacher,
          ),
          body = {
            name: "New Student",
            email: "new@test.dev",
            password: "StrongPass123!",
            token: inv.token,
          };
        assert.equal(
          (await f.request("/api/invitations/accept", body)).statusCode,
          500,
        );
        assert.equal(
          await f.c("users").countDocuments({ email: body.email }),
          0,
        );
        await f.post("/api/invitations/accept", body);
        assert.equal(
          await f.c("users").countDocuments({ email: body.email }),
          1,
        );
      }
    } finally {
      await f.close();
    }
  });
test("completion failure is rolled back; a repeated review racing completion stays consistent", async () => {
  let armed = false,
    failed = false;
  const f = await fixture({
    essay: true,
    hooks: {
      async boundary(name) {
        if (armed && !failed && name === "completion_locked") {
          failed = true;
          throw new Error("stop completion");
        }
      },
    },
  });
  try {
    const result = await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "Essay" },
      f.student,
    );
    armed = true;
    assert.equal(
      (
        await f.request(
          f.path + "/complete",
          {},
          f.student,
          "complete-retry-key",
        )
      ).statusCode,
      500,
    );
    assert.equal(
      (await f.c("assignments").findOne({ _id: f.assignment._id }))!.state,
      "in_progress",
    );
    const reviewed = f.request(
        "/api/evaluations/" + result.evaluation._id + "/review",
        { result: "correct", note: "Verified" },
        f.teacher,
        "review-retry-key",
      ),
      completed = f.request(
        f.path + "/complete",
        {},
        f.student,
        "complete-retry-key",
      );
    const responses = await Promise.all([reviewed, completed]);
    assert.ok(responses.every((r) => r.statusCode === 200));
    assert.equal(
      (await f.c("assignments").findOne({ _id: f.assignment._id }))!.state,
      "completed",
    );
  } finally {
    await f.close();
  }
});
test("client expected counters prevent stale intents while replay returns the acknowledged result", async () => {
  const f = await fixture();
  try {
    const body = {
        questionId: f.question._id,
        answer: "2",
        expectedAttempt: 1,
      },
      first = await f.post(
        f.path + "/attempts",
        body,
        f.student,
        "client-attempt-1",
      );
    assert.deepEqual(
      await f.post(f.path + "/attempts", body, f.student, "client-attempt-1"),
      first,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/attempts",
          body,
          f.student,
          "new-stale-attempt",
        )
      ).statusCode,
      409,
    );
    const hint = { questionId: f.question._id, expectedHintLevel: 1 },
      h = await f.post(f.path + "/hints", hint, f.student, "client-hint-1");
    assert.deepEqual(
      await f.post(f.path + "/hints", hint, f.student, "client-hint-1"),
      h,
    );
    const second = await f.post(
      f.path + "/hints",
      { ...hint, expectedHintLevel: 2 },
      f.student,
      "client-hint-2",
    );
    assert.equal(second.level, 2);
  } finally {
    await f.close();
  }
});
test("symbolic and rubric answers use versioned policy and uncertain work reaches teacher review", async () => {
  const f = await fixture();
  try {
    const topic = (await f
      .c("questionVersions")
      .findOne({ _id: f.question._id }))!.topicId;
    const q = await f.post(
      "/api/questions",
      {
        topicId: topic,
        statement: "Write an equivalent expression",
        type: "symbolic",
        reference: "2*x+2",
        mathContext: { variables: ["x"], domain: "real", mode: "expression" },
        rubric: [],
      },
      f.teacher,
    );
    const studentId = f.assignment.studentId;
    const m = await f.post(
      "/api/missions",
      {
        title: "Symbolic scope",
        studentId,
        questionVersionIds: [q._id],
        policy: { maxAttempts: 3, maxHints: 0, independent: true },
      },
      f.teacher,
    );
    await f.post("/api/missions/" + m._id + "/publish", {}, f.teacher);
    const a = (await f.c("assignments").findOne({ missionId: m._id }))!,
      path = "/api/assignments/" + a._id;
    const correct = await f.post(
      path + "/attempts",
      { questionId: q._id, answer: "2(x+1)" },
      f.student,
    );
    assert.equal(correct.evaluation.result, "correct");
    assert.equal(correct.evaluation.method, "symbolic");
    assert.equal(correct.evaluation.requiresTeacherReview, false);
    const unsupported = await f.post(
      path + "/attempts",
      { questionId: q._id, answer: "sin(x)" },
      f.student,
    );
    assert.equal(unsupported.evaluation.result, "pending_review");
    await f.post(path + "/complete", {}, f.student);
    assert.equal(
      (await f.c("assignments").findOne({ _id: a._id }))!.state,
      "submitted",
    );
    await f.post(
      "/api/evaluations/" + unsupported.evaluation._id + "/review",
      { result: "incorrect", note: "Outside requested polynomial form" },
      f.teacher,
    );
    assert.equal(
      (await f.c("assignments").findOne({ _id: a._id }))!.state,
      "completed",
    );
  } finally {
    await f.close();
  }
});
