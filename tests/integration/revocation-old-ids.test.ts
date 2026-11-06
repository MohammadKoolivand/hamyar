import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

test("revoking membership mid-practice blocks old URLs, attempts, hints and completion while retaining evidence", async () => {
  const f = await fixture();
  try {
    const studentId = f.assignment.studentId;
    const course = await f.post("/api/courses", { subject: "ریاضی", title: "درس محافظت‌شده" }, f.teacher);
    const join = await f.post(`/api/courses/${course._id}/join-code`, {}, f.teacher);
    await f.post("/api/course-requests", { code: join.code }, f.student);
    const request = (await f.request("/api/course-requests", undefined, f.teacher)).json()[0];
    await f.post(`/api/course-requests/${request._id}/decision`, { decision: "approve" }, f.teacher);
    const enrollment = await f.c("enrollments").findOne({ studentId, courseId: course._id });
    assert.ok(enrollment);

    const mission = await f.post("/api/missions", {
      studentId, courseId: course._id, title: "تمرین نیمه‌تمام",
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 3, maxHints: 1, independent: false },
    }, f.teacher);
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    const assignment = await f.c("assignments").findOne({ missionId: mission._id });
    assert.ok(assignment);
    const base = `/api/assignments/${assignment._id}`;
    assert.equal((await f.request(base, undefined, f.student)).statusCode, 200);
    await f.post(`${base}/attempts`, { questionId: f.question._id, answer: "3" }, f.student);
    const count = await f.c("attempts").countDocuments({ assignmentId: assignment._id });
    // A separate completed assignment must retain its historical state but
    // lose student content access after revocation.
    const completedMission = await f.post("/api/missions", {
      studentId, courseId: course._id, title: "گزارش تاریخی",
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 2, maxHints: 0, independent: true },
    }, f.teacher);
    await f.post(`/api/missions/${completedMission._id}/publish`, {}, f.teacher);
    const completed = await f.c("assignments").findOne({ missionId: completedMission._id });
    assert.ok(completed);
    await f.post(`/api/assignments/${completed._id}/complete`, { allowUnanswered: true }, f.student);
    await f.post(`/api/enrollments/${enrollment._id}/leave`, {}, f.teacher);

    for (const path of [base, `${base}/report`])
      assert.equal((await f.request(path, undefined, f.student)).statusCode, 404, path);
    for (const [path, payload] of [
      [`${base}/attempts`, { questionId: f.question._id, answer: "4" }],
      [`${base}/hints`, { questionId: f.question._id }],
      [`${base}/complete`, {}],
    ] as const)
      assert.equal((await f.request(path, payload, f.student)).statusCode, 404, path);
    const list = (await f.request("/api/assignments", undefined, f.student)).json();
    assert.ok(!list.some((a: { _id: string }) => a._id === assignment._id));
    const missions = (await f.request("/api/missions", undefined, f.student)).json();
    assert.ok(!missions.some((a: { _id: string }) => a._id === assignment._id));
    assert.equal(await f.c("attempts").countDocuments({ assignmentId: assignment._id }), count);
    assert.equal((await f.c("assignments").findOne({ _id: assignment._id }))?.state, "cancelled");
    assert.equal((await f.c("assignments").findOne({ _id: completed._id }))?.state, "completed");
    assert.equal((await f.request(`/api/assignments/${completed._id}`, undefined, f.student)).statusCode, 404);
    assert.equal((await f.request(`/api/assignments/${completed._id}/report`, undefined, f.student)).statusCode, 404);
    assert.equal((await f.request(base, undefined, f.teacher)).statusCode, 200);

    // Rejoining cannot reactivate a cancelled attempt through its old ID.
    await f.post("/api/course-requests", { code: join.code }, f.student);
    const next = (await f.request("/api/course-requests", undefined, f.teacher)).json()[0];
    await f.post(`/api/course-requests/${next._id}/decision`, { decision: "approve" }, f.teacher);
    assert.equal((await f.request(base, undefined, f.student)).statusCode, 404);
    assert.equal((await f.request(`/api/assignments/${completed._id}`, undefined, f.student)).statusCode, 404);
  } finally {
    await f.close();
  }
});

test("library unpublish cancels started practice and old assignment IDs stay unusable after republish", async () => {
  const f = await fixture();
  try {
    const course = await f.post("/api/courses", { subject: "ریاضی", title: "کتابخانه" }, f.teacher);
    const invite = await f.post("/api/invitations", { email: "s@test.dev", courseId: course._id }, f.teacher);
    await f.post("/api/invitations/claim", { token: invite.token }, f.student);
    const pub = `/api/questions/${f.question._id}/library`;
    await f.post(pub, { courseId: course._id, published: true }, f.teacher);
    const start = `/api/student/library/${f.question._id}/start`;
    const started = await f.post(start, { courseId: course._id }, f.student);
    const base = `/api/assignments/${started.assignmentId}`;
    assert.equal((await f.request(base, undefined, f.student)).statusCode, 200);
    await f.post(pub, { courseId: course._id, published: false }, f.teacher);
    assert.equal((await f.request(base, undefined, f.student)).statusCode, 404);
    assert.equal((await f.c("assignments").findOne({ _id: started.assignmentId }))?.state, "cancelled");
    await f.post(pub, { courseId: course._id, published: true }, f.teacher);
    assert.equal((await f.request(base, undefined, f.student)).statusCode, 404);
    const restarted = await f.post(start, { courseId: course._id }, f.student);
    assert.notEqual(restarted.assignmentId, started.assignmentId);
  } finally {
    await f.close();
  }
});

test("library access is revoked during an unfinished exercise even with old start idempotency key", async () => {
  const f = await fixture();
  try {
    const course = await f.post("/api/courses", { subject: "ریاضی", title: "درس کتابخانه خصوصی" }, f.teacher);
    const invitation = await f.post("/api/invitations", { email: "s@test.dev", courseId: course._id }, f.teacher);
    await f.post("/api/invitations/claim", { token: invitation.token }, f.student);
    const membership = await f.c("enrollments").findOne({
      courseId: course._id, studentId: f.assignment.studentId,
    });
    assert.ok(membership);
    await f.post(`/api/questions/${f.question._id}/library`, {
      courseId: course._id, published: true,
    }, f.teacher);
    const startPath = `/api/student/library/${f.question._id}/start`;
    const startKey = "replay-after-course-revocation";
    const created = await f.post(startPath, { courseId: course._id }, f.student, startKey);
    const detail = `/api/assignments/${created.assignmentId}`;
    assert.equal((await f.request(detail, undefined, f.student)).statusCode, 200);
    // Simulate older library rows created before enrollmentId tracking.
    await f.c("assignments").updateOne({ _id: created.assignmentId }, { $unset: { enrollmentId: "" } });

    // Teacher terminates enrollment while the student's old browser tab is open.
    await f.post(`/api/enrollments/${membership._id}/leave`, {}, f.teacher);
    assert.deepEqual((await f.request("/api/student/library", undefined, f.student)).json().items, []);
    assert.equal((await f.request(startPath, { courseId: course._id }, f.student, startKey)).statusCode, 404);
    assert.equal((await f.request(detail, undefined, f.student)).statusCode, 404);
    assert.equal((await f.request(`${detail}/attempts`, {
      questionId: f.question._id, answer: "1",
    }, f.student)).statusCode, 404);
    assert.equal((await f.request(`${detail}/hints`, {
      questionId: f.question._id,
    }, f.student)).statusCode, 404);
    assert.equal((await f.c("assignments").findOne({ _id: created.assignmentId }))?.state, "cancelled");
    assert.equal((await f.request(detail, undefined, f.teacher)).statusCode, 200);
  } finally {
    await f.close();
  }
});
