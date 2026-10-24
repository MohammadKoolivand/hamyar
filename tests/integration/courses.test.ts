import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

test("course enrollments isolate teachers and students; missions preserve course provenance", async () => {
  const f = await fixture();
  try {
    const studentId = f.assignment.studentId;
    const teacherId = (await f.c("users").findOne({ email: "t@test.dev" }))!._id;
    const studentEmail = "s@test.dev";
    const math = await f.post("/api/courses", { subject: "ریاضی", title: "ریاضی دهم" }, f.teacher);
    const physics = await f.post("/api/courses", { subject: "فیزیک", title: "فیزیک دهم" }, f.teacher);
    assert.notEqual(math._id, physics._id);
    assert.equal(math.teacherId, teacherId);
    assert.equal((await f.request("/api/courses")).statusCode, 401);
    assert.equal((await f.request("/api/courses", { subject: "جعلی", title: "کلاس جعلی" }, f.student)).statusCode, 403);

    // A legacy relation does not implicitly enroll a student into all courses.
    assert.deepEqual((await f.request("/api/enrollments", undefined, f.student)).json(), []);
    const unassigned = await f.request("/api/missions", {
      title: "ریاضی پیش از عضویت",
      studentId,
      courseId: math._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 3, maxHints: 1, independent: false },
    }, f.teacher);
    assert.equal(unassigned.statusCode, 404);

    const invitation = await f.post("/api/invitations", {
      email: studentEmail, courseId: math._id,
    }, f.teacher);
    const denied = await f.request("/api/invitations/claim", { token: invitation.token }, f.teacher);
    assert.equal(denied.statusCode, 403);
    const join = await f.request("/api/invitations/claim", { token: invitation.token }, f.student);
    assert.equal(join.statusCode, 200, join.body);
    assert.equal((await f.request("/api/invitations/claim", { token: invitation.token }, f.student)).statusCode, 400);
    assert.equal(await f.c("enrollments").countDocuments({ courseId: math._id, studentId }), 1);
    assert.equal(await f.c("users").countDocuments({ email: studentEmail }), 1);

    const m = await f.post("/api/missions", {
      title: "ماموریت ریاضی",
      studentId,
      courseId: math._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 3, maxHints: 1, independent: false },
    }, f.teacher);
    assert.equal(m.courseId, math._id);
    assert.ok(m.enrollmentId);
    await f.post("/api/missions/" + m._id + "/publish", {}, f.teacher);
    const scoped = await f.c("assignments").findOne({ missionId: m._id });
    assert.equal(scoped?.courseId, math._id);
    assert.equal(scoped?.enrollmentId, m.enrollmentId);
    const studentAssignments = (await f.request("/api/assignments", undefined, f.student)).json();
    assert.equal(studentAssignments.some((a: { courseId?: string }) => a.courseId === math._id), true);

    const another = await f.request("/api/missions", {
      title: "فیزیک بدون عضویت", studentId, courseId: physics._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 3, maxHints: 1, independent: false },
    }, f.teacher);
    assert.equal(another.statusCode, 404);

    const secondInvite = await f.post("/api/invitations", {
      email: studentEmail, courseId: physics._id,
    }, f.teacher);
    await f.post("/api/invitations/claim", { token: secondInvite.token }, f.student);
    assert.equal(await f.c("enrollments").countDocuments({ studentId }), 2);

    // One account, two teachers, independently owned courses.
    await f.post("/api/auth/register", {
      name: "Second Teacher", email: "teacher2@test.dev",
      password: "StrongPass123!", role: "teacher",
    });
    const login = await f.request("/api/auth/login", {
      email: "teacher2@test.dev", password: "StrongPass123!",
    });
    const teacher2 = "session=" + login.cookies[0].value;
    const teacher2id = login.json()._id as string;
    const outside = await f.post("/api/courses", { subject: "زبان", title: "انگلیسی مقدماتی" }, teacher2);
    assert.equal((await f.request("/api/invitations", {
      email: studentEmail, courseId: outside._id,
    }, f.teacher)).statusCode, 404);
    assert.equal((await f.request("/api/courses", undefined, f.teacher)).json().length, 2);
    assert.equal((await f.request("/api/courses", undefined, teacher2)).json().length, 1);
    assert.equal((await f.request("/api/courses", undefined, f.student)).json().length, 2);
    const unauthorizedInv = await f.request("/api/invitations", {
      email: studentEmail, role: "parent", studentId, courseId: math._id,
    }, f.teacher);
    assert.equal(unauthorizedInv.statusCode, 400);
    const thirdInvite = await f.post("/api/invitations", { email: studentEmail, courseId: outside._id }, teacher2);
    await f.post("/api/invitations/claim", { token: thirdInvite.token }, f.student);
    const all = (await f.request("/api/enrollments", undefined, f.student)).json() as {
      courseId: string; teacherId: string; teacherName?: string; courseTitle: string;
    }[];
    assert.equal(all.length, 3);
    assert.equal(all.find((e) => e.courseId === outside._id)?.teacherId, teacher2id);
    assert.equal(all.find((e) => e.courseId === outside._id)?.teacherName, "Second Teacher");
    assert.equal((await f.request("/api/enrollments", undefined, f.teacher)).json().length, 2);
    assert.equal((await f.request("/api/enrollments", undefined, teacher2)).json().length, 1);
    assert.equal((await f.request("/api/students", undefined, teacher2)).json().length, 1);
    // Private question versions remain teacher-owned.
    assert.equal((await f.request("/api/missions", {
      title: "تلاش غیرمجاز", studentId, courseId: outside._id,
      questionVersionIds: [f.question._id],
      policy: { maxAttempts: 2, maxHints: 0, independent: true },
    }, teacher2)).statusCode, 404);
  } finally {
    await f.close();
  }
});
