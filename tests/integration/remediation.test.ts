import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

const policy = { maxAttempts: 1, maxHints: 0, independent: true };

test("teacher can publish one individual remediation from verified incorrect latest answer, idempotently", async () => {
  const f = await fixture();
  try {
    const studentId = f.assignment.studentId as string;
    const url = "/api/students/" + studentId;
    assert.equal((await f.request(url + "/remediation-candidates", undefined, f.student)).statusCode, 403);
    assert.equal((await f.request(url + "/remediation-missions", {
      title: "Unauthorized", questionVersionIds: [f.question._id], policy,
    }, f.student)).statusCode, 403);
    const empty = (await f.request(url + "/remediation-candidates", undefined, f.teacher)).json();
    assert.deepEqual(empty.items, []);

    const wrong = await f.post(f.path + "/attempts", {
      questionId: f.question._id, answer: "1",
    }, f.student);
    const found = (await f.request(url + "/remediation-candidates", undefined, f.teacher)).json();
    assert.equal(found.items.length, 1);
    assert.equal(found.items[0].questionVersionId, f.question._id);
    assert.equal(found.items[0].lastResult, "incorrect");
    assert.equal(found.items[0].statement, "پاسخ خود را بنویسید");
    assert.ok(!JSON.stringify(found).includes("reference"));

    await f.post("/api/auth/register", {
      name: "Other Teacher", email: "other-remedial@test.dev",
      password: "StrongPass123!", role: "teacher",
    });
    const l = await f.request("/api/auth/login", {
      email: "other-remedial@test.dev", password: "StrongPass123!",
    });
    const teacher2 = "session=" + l.cookies[0].value;
    assert.equal((await f.request(url + "/remediation-candidates", undefined, teacher2)).statusCode, 404);
    assert.equal((await f.request(url + "/remediation-missions", {
      title: "Outside Teacher", questionVersionIds: [f.question._id], policy,
    }, teacher2)).statusCode, 404);
    assert.equal((await f.request(url + "/remediation-missions", {
      title: "Foreign Question", questionVersionIds: [
        "00000000-0000-4000-8000-000000000001",
      ], policy,
    }, f.teacher)).statusCode, 409);

    const publish = await f.post(url + "/remediation-missions", {
      title: "تمرین تقویتی شخصی", questionVersionIds: [f.question._id], policy,
    }, f.teacher, "individual-remediation-01");
    assert.equal(publish.published, true);
    const replay = await f.post(url + "/remediation-missions", {
      title: "تمرین تقویتی شخصی", questionVersionIds: [f.question._id], policy,
    }, f.teacher, "individual-remediation-01");
    assert.deepEqual(replay, publish);
    const created = await f.c("assignments").find({
      missionId: publish.missionId, studentId,
    }).toArray();
    assert.equal(created.length, 1);
    assert.equal(created[0]._id, publish.assignmentId);
    assert.equal(created[0].remediation, true);
    assert.equal(created[0].state, "published");
    assert.equal(created[0].policy.maxHints, 0);
    assert.equal((await f.request("/api/assignments/" + publish.assignmentId, undefined, f.student)).statusCode, 200);

    // A teacher's correction makes the latest result correct and removes
    // that question from the next batch of *suggested* remediation.
    await f.post("/api/evaluations/" + wrong.evaluation._id + "/review", {
      result: "correct", note: "Correction after teacher review",
    }, f.teacher);
    assert.deepEqual((await f.request(url + "/remediation-candidates", undefined, f.teacher)).json().items, []);
    assert.equal((await f.request(url + "/remediation-missions", {
      title: "Stale Remediation", questionVersionIds: [f.question._id], policy,
    }, f.teacher)).statusCode, 409);
    assert.equal(await f.c("assignments").countDocuments({ remediation: true, teacherId: (await f.c("users").findOne({ email: "t@test.dev" }))!._id }), 1);
  } finally {
    await f.close();
  }
});

test("remediation is course-scoped and requires active enrollment, including on publication", async () => {
  const f = await fixture();
  try {
    const sid = f.assignment.studentId as string;
    const course = await f.post("/api/courses", {
      title: "ریاضی دهم", subject: "ریاضی",
    }, f.teacher);
    const invite = await f.post("/api/invitations", {
      email: "s@test.dev", courseId: course._id,
    }, f.teacher);
    await f.post("/api/invitations/claim", { token: invite.token }, f.student);
    const mission = await f.post("/api/missions", {
      title: "First individual", studentId: sid, courseId: course._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 3, maxHints: 1, independent: false },
    }, f.teacher);
    await f.post("/api/missions/" + mission._id + "/publish", {}, f.teacher);
    const assignment = await f.c("assignments").findOne({ missionId: mission._id });
    assert.ok(assignment);
    await f.post("/api/assignments/" + assignment._id + "/attempts", {
      questionId: f.question._id, answer: "0",
    }, f.student);
    const base = "/api/students/" + sid;
    const query = "?courseId=" + course._id;
    assert.deepEqual((await f.request(base + "/remediation-candidates", undefined, f.teacher)).json().items, []);
    const scoped = (await f.request(base + "/remediation-candidates" + query, undefined, f.teacher)).json();
    assert.equal(scoped.items.length, 1);
    assert.equal((await f.request(base + "/remediation-missions", {
      title: "Wrong source", questionVersionIds: [f.question._id], policy,
    }, f.teacher)).statusCode, 409);
    const row = await f.post(base + "/remediation-missions", {
      title: "تمرین ریاضی اختصاصی", courseId: course._id,
      questionVersionIds: [f.question._id], policy,
    }, f.teacher);
    const rem = await f.c("assignments").findOne({ _id: row.assignmentId });
    assert.equal(rem?.courseId, course._id);
    assert.equal(rem?.enrollmentId, assignment.enrollmentId);
    const enrollment = await f.c("enrollments").findOne({ _id: assignment.enrollmentId });
    assert.ok(enrollment);
    await f.post("/api/enrollments/" + enrollment._id + "/leave", {}, f.student);
    assert.equal((await f.request(base + "/remediation-candidates" + query, undefined, f.teacher)).statusCode, 404);
    assert.equal((await f.request(base + "/remediation-missions", {
      title: "After leaving", courseId: course._id,
      questionVersionIds: [f.question._id], policy,
    }, f.teacher)).statusCode, 404);
    const stored = await f.c("attempts").countDocuments({ assignmentId: assignment._id });
    assert.equal(stored, 1);
    assert.equal((await f.c("assignments").findOne({ _id: rem!._id }))?.state, "cancelled");
  } finally { await f.close(); }
});
