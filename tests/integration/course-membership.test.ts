import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

test("course join requests require owner approval and do not leak other students", async () => {
  const f = await fixture();
  try {
    const sid = f.assignment.studentId;
    const math = await f.post("/api/courses", {
      subject: "ریاضی", title: "ریاضی دهم",
    }, f.teacher);
    const issued = await f.post("/api/courses/" + math._id + "/join-code", {}, f.teacher);
    assert.match(issued.code, /^[a-f0-9]{48}$/);
    assert.equal((await f.request("/api/courses/" + math._id + "/join-code", {}, f.student)).statusCode, 403);
    assert.equal((await f.request("/api/course-requests")).statusCode, 401);
    assert.equal((await f.request("/api/course-requests", { code: issued.code }, f.teacher)).statusCode, 403);
    assert.equal((await f.request("/api/course-requests", { code: "f".repeat(48) }, f.student)).statusCode, 400);
    assert.equal((await f.request("/api/course-requests", { code: "invalid" }, f.student)).statusCode, 400);

    const initial = await f.post("/api/course-requests", { code: issued.code }, f.student);
    assert.equal(initial.status, "pending");
    assert.equal(await f.c("enrollments").countDocuments({ courseId: math._id, studentId: sid }), 0);
    assert.equal((await f.request("/api/course-requests", { code: issued.code }, f.student)).statusCode, 409);

    const list = (await f.request("/api/course-requests", undefined, f.teacher)).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].studentPhone, "");
    assert.equal(list[0].status, "pending");
    const studentView = (await f.request("/api/course-requests", undefined, f.student)).json();
    assert.equal(studentView.length, 1);
    assert.equal(studentView[0].studentPhone, undefined);
    assert.ok(!JSON.stringify(studentView).includes("tokenHash"));

    await f.post("/api/auth/register", {
      name: "Other Teacher", email: "otherteacher@test.dev",
      password: "StrongPass123!", role: "teacher",
    });
    const otherLogin = await f.request("/api/auth/login", {
      email: "otherteacher@test.dev", password: "StrongPass123!",
    });
    const otherTeacher = "session=" + otherLogin.cookies[0].value;
    assert.deepEqual((await f.request("/api/course-requests", undefined, otherTeacher)).json(), []);
    assert.equal(
      (await f.request("/api/course-requests/" + list[0]._id + "/decision", { decision: "approve" }, otherTeacher)).statusCode,
      404,
    );
    assert.equal((await f.request("/api/course-requests/" + list[0]._id + "/decision", { decision: "approve" }, f.student)).statusCode, 403);

    const approved = await f.post("/api/course-requests/" + list[0]._id + "/decision", {
      decision: "approve",
    }, f.teacher);
    assert.equal(approved.status, "approved");
    assert.equal((await f.request("/api/course-requests/" + list[0]._id + "/decision", {
      decision: "approve",
    }, f.teacher)).statusCode, 404);
    const enrollment = await f.c("enrollments").findOne({ courseId: math._id, studentId: sid });
    assert.equal(enrollment?.status, "active");
    assert.equal((await f.request("/api/courses", undefined, f.student)).json().length, 1);
    assert.equal(
      (await f.request("/api/enrollments", undefined, f.student)).json().length,
      1,
    );

    // A second student cannot read the first student's request or membership.
    await f.post("/api/auth/register", {
      name: "New Student", email: "secondstudent@test.dev",
      password: "StrongPass123!", role: "student",
    });
    const studentLogin = await f.request("/api/auth/login", {
      email: "secondstudent@test.dev", password: "StrongPass123!",
    });
    const otherStudent = "session=" + studentLogin.cookies[0].value;
    assert.deepEqual((await f.request("/api/course-requests", undefined, otherStudent)).json(), []);
    assert.equal((await f.request("/api/enrollments/" + enrollment!._id + "/leave", {}, otherStudent)).statusCode, 404);

    // Rotating the teacher's code invalidates the old code.
    const rotated = await f.post("/api/courses/" + math._id + "/join-code", {}, f.teacher);
    assert.notEqual(rotated.code, issued.code);
    assert.equal((await f.request("/api/course-requests", { code: issued.code }, otherStudent)).statusCode, 400);
    await f.post("/api/course-requests", { code: rotated.code }, otherStudent);
    const otherRequest = (await f.request("/api/course-requests", undefined, f.teacher)).json()
      .find((v: { studentId: string }) => v.studentId === studentLogin.json()._id);
    assert.ok(otherRequest);
    await f.post("/api/course-requests/" + otherRequest._id + "/decision", { decision: "decline" }, f.teacher);
    assert.equal((await f.request("/api/enrollments", undefined, otherStudent)).json().length, 0);
    assert.equal((await f.request("/api/course-requests", undefined, otherStudent)).json()[0].status, "declined");
  } finally {
    await f.close();
  }
});

test("revocation freezes unfinished assignments but retains history and permits reapproval", async () => {
  const f = await fixture();
  try {
    const sid = f.assignment.studentId;
    const course = await f.post("/api/courses", {
      subject: "ریاضی", title: "ریاضی دهم",
    }, f.teacher);
    const code = await f.post("/api/courses/" + course._id + "/join-code", {}, f.teacher);
    await f.post("/api/course-requests", { code: code.code }, f.student);
    const req = (await f.request("/api/course-requests", undefined, f.teacher)).json()[0];
    await f.post("/api/course-requests/" + req._id + "/decision", { decision: "approve" }, f.teacher);
    const membership = await f.c("enrollments").findOne({ courseId: course._id, studentId: sid });
    assert.ok(membership);

    const mission = await f.post("/api/missions", {
      title: "تمرین قابل توقف", studentId: sid, courseId: course._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 2, maxHints: 1, independent: false },
    }, f.teacher);
    await f.post("/api/missions/" + mission._id + "/publish", {}, f.teacher);
    const assignment = await f.c("assignments").findOne({ missionId: mission._id });
    assert.ok(assignment);
    await f.post("/api/assignments/" + assignment!._id + "/attempts", {
      questionId: f.question._id, answer: "3",
    }, f.student);
    const recorded = await f.c("attempts").countDocuments({ assignmentId: assignment!._id });
    assert.equal(recorded, 1);

    const result = await f.post("/api/enrollments/" + membership!._id + "/leave", {}, f.student);
    assert.equal(result.ok, true);
    assert.equal(result.cancelledAssignments, 1);
    assert.equal((await f.c("enrollments").findOne({ _id: membership!._id }))?.status, "revoked");
    assert.equal((await f.c("assignments").findOne({ _id: assignment!._id }))?.state, "cancelled");
    assert.equal((await f.c("missions").findOne({ _id: mission._id }))?.state, "cancelled");
    assert.equal(await f.c("attempts").countDocuments({ assignmentId: assignment!._id }), recorded);
    assert.equal((await f.request("/api/assignments/" + assignment!._id, undefined, f.student)).statusCode, 200);
    assert.equal((await f.request("/api/assignments/" + assignment!._id + "/report", undefined, f.student)).statusCode, 200);
    assert.equal((await f.request("/api/assignments/" + assignment!._id + "/attempts", {
      questionId: f.question._id, answer: "2",
    }, f.student)).statusCode, 409);
    assert.equal((await f.request("/api/enrollments/" + membership!._id + "/leave", {}, f.student)).statusCode, 404);

    const notAllowed = await f.request("/api/missions", {
      title: "بعد از لغو عضویت", studentId: sid, courseId: course._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 2, maxHints: 0, independent: true },
    }, f.teacher);
    assert.equal(notAllowed.statusCode, 404);
    assert.deepEqual((await f.request("/api/enrollments", undefined, f.student)).json(), []);
    const history = (await f.request("/api/enrollment-history", undefined, f.student)).json();
    assert.equal(history.length, 1);
    assert.equal(history[0].status, "revoked");
    assert.equal(history[0].history.at(-1).actorId, sid);

    await f.post("/api/course-requests", { code: code.code }, f.student);
    const pending = (await f.request("/api/course-requests", undefined, f.teacher)).json()[0];
    assert.equal(pending.status, "pending");
    await f.post("/api/course-requests/" + pending._id + "/decision", { decision: "approve" }, f.teacher);
    const rejoined = await f.c("enrollments").findOne({ courseId: course._id, studentId: sid });
    assert.equal(rejoined?._id, membership!._id);
    assert.equal(rejoined?.status, "active");
    assert.ok((rejoined?.history?.length ?? 0) >= 3);
    assert.equal(await f.c("attempts").countDocuments({ assignmentId: assignment!._id }), recorded);
    const newMission = await f.post("/api/missions", {
      title: "تمرین بعد از بازعضویت", studentId: sid, courseId: course._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 2, maxHints: 0, independent: true },
    }, f.teacher);
    assert.equal(newMission.enrollmentId, membership!._id);
  } finally {
    await f.close();
  }
});
