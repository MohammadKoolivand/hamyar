import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "../helpers/fixture";
test("parent invitation creates scoped read-only access; private teacher notes and other children isolated; revocation works", async () => {
  const f = await fixture();
  try {
    const sid = f.assignment.studentId;
    const inv = await f.post(
      "/api/invitations",
      { email: "parent@test.dev", role: "parent", studentId: sid },
      f.teacher,
    );
    await f.post("/api/invitations/accept", {
      email: "parent@test.dev",
      password: "StrongPass123!",
      name: "Parent",
      token: inv.token,
    });
    const login = await f.request("/api/auth/login", {
        email: "parent@test.dev",
        password: "StrongPass123!",
      }),
      parent = "session=" + login.cookies[0].value;
    assert.equal(login.json().role, "parent");
    const children = (
      await f.request("/api/children", undefined, parent)
    ).json();
    assert.equal(children.length, 1);
    assert.equal(children[0]._id, sid);
    assert.equal(children[0].email, undefined);
    const result = await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "2" },
      f.student,
    );
    await f.post(
      "/api/evaluations/" + result.evaluation._id + "/review",
      { result: "correct", note: "PRIVATE_TEACHER_NOTE_SENTINEL" },
      f.teacher,
    );
    const report = await f.request(f.path + "/report", undefined, parent);
    assert.equal(report.statusCode, 200);
    assert.equal(report.json().independent, 1);
    assert.ok(!report.body.includes("PRIVATE_TEACHER_NOTE_SENTINEL"));
    // Same child also practices with a different teacher; this parent invitation does not authorize that relationship.
    const hiddenAssignmentId = randomUUID(),
      hiddenAttemptId = randomUUID();
    await f
      .c("assignments")
      .insertOne({
        ...f.assignment,
        _id: hiddenAssignmentId,
        teacherId: randomUUID(),
        missionId: randomUUID(),
      });
    await f
      .c("attempts")
      .insertOne({
        _id: hiddenAttemptId,
        assignmentId: hiddenAssignmentId,
        questionVersionId: f.question._id,
        answer: "OTHER_RELATIONSHIP_SENTINEL",
        sequence: 1,
        hintsUsed: 0,
        createdAt: new Date().toISOString(),
      });
    await f
      .c("evaluations")
      .insertOne({
        _id: randomUUID(),
        attemptId: hiddenAttemptId,
        assignmentId: hiddenAssignmentId,
        questionVersionId: f.question._id,
        result: "incorrect",
        method: "deterministic",
      });
    const progress = await f.request(
      "/api/students/" + sid + "/progress",
      undefined,
      parent,
    );
    assert.equal(progress.statusCode, 200);
    assert.equal(progress.json().role, "parent");
    assert.equal(progress.json().answered, 1);
    assert.ok(!progress.body.includes("OTHER_RELATIONSHIP_SENTINEL"));
    assert.equal(
      (
        await f.request(
          "/api/assignments/" + hiddenAssignmentId + "/report",
          undefined,
          parent,
        )
      ).statusCode,
      404,
    );
    assert.equal(progress.json().evidence, undefined);
    assert.equal(progress.json().trends, undefined);
    assert.equal(
      (
        await f.request(
          "/api/students/" + randomUUID() + "/progress",
          undefined,
          parent,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/attempts",
          { questionId: f.question._id, answer: "2" },
          parent,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/hints",
          { questionId: f.question._id },
          parent,
        )
      ).statusCode,
      403,
    );
    assert.equal((await f.request(f.path, undefined, parent)).statusCode, 403);
    assert.equal(
      (await f.request("/api/questions", undefined, parent)).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/invitations",
          { email: "unauthorized@test.dev" },
          parent,
        )
      ).statusCode,
      403,
    );
    const pid = login.json()._id;
    await f.post(
      `/api/students/${sid}/parents/${pid}/revoke`,
      {},
      f.teacher,
      "revoke-parent-intent",
    );
    assert.deepEqual(
      (await f.request("/api/children", undefined, parent)).json(),
      [],
    );
    assert.equal(
      (await f.request("/api/students/" + sid + "/progress", undefined, parent))
        .statusCode,
      404,
    );
    assert.equal(
      (await f.request(f.path + "/report", undefined, parent)).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request("/api/invitations/accept", {
          email: "parent@test.dev",
          password: "StrongPass123!",
          name: "Parent",
          token: inv.token,
        })
      ).statusCode,
      400,
    );
  } finally {
    await f.close();
  }
});
