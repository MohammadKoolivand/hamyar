import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

const policy = {
  maxAttempts: 3, maxHints: 2, independent: false,
};
test("group task fans out only to actively enrolled class members, with isolated evidence and reports", async () => {
  const f = await fixture();
  try {
    const student1 = f.assignment.studentId as string;
    const course = await f.post("/api/courses", { title: "ریاضی پایه دهم", subject: "ریاضی" }, f.teacher);
    const invite1 = await f.post("/api/invitations", { email: "s@test.dev", courseId: course._id }, f.teacher);
    await f.post("/api/invitations/claim", { token: invite1.token }, f.student);
    const password = "StrongPass123!";
    await f.post("/api/auth/register", {
      email: "s2@test.dev", password, name: "Second Student", role: "student",
    });
    const login = await f.request("/api/auth/login", { email: "s2@test.dev", password });
    const student2cookie = "session=" + login.cookies[0].value;
    const student2 = login.json()._id as string;
    const invite2 = await f.post("/api/invitations", { email: "s2@test.dev", courseId: course._id }, f.teacher);
    await f.post("/api/invitations/claim", { token: invite2.token }, student2cookie);

    await f.post("/api/auth/register", {
      email: "other-teacher@test.dev", password, name: "Other Teacher", role: "teacher",
    });
    const otherLogin = await f.request("/api/auth/login", { email: "other-teacher@test.dev", password });
    const otherTeacher = "session=" + otherLogin.cookies[0].value;

    assert.equal((await f.request("/api/class-groups", undefined, f.student)).statusCode, 403);
    assert.equal((await f.request("/api/class-groups", undefined, otherTeacher)).json().length, 0);
    assert.equal((await f.request("/api/class-groups", {
      courseId: course._id, title: "Fake", studentIds: [student1],
    }, f.student)).statusCode, 403);
    const wrongCourse = await f.request("/api/class-groups", {
      courseId: "00000000-0000-4000-8000-000000000001",
      title: "Class", studentIds: [student1],
    }, f.teacher);
    assert.equal(wrongCourse.statusCode, 404);
    assert.equal((await f.request("/api/class-groups", {
      courseId: course._id, title: "Class", studentIds: [student1, student1],
    }, f.teacher)).statusCode, 400);

    const group = await f.post("/api/class-groups", {
      courseId: course._id, title: "کلاس ریاضی الف", studentIds: [student1, student2],
    }, f.teacher);
    assert.equal(group.studentIds.length, 2);
    assert.equal((await f.request("/api/class-groups/" + group._id + "/members", {
      studentIds: [student1],
    }, otherTeacher)).statusCode, 404);
    assert.equal((await f.request("/api/group-tasks", {
      groupId: group._id, title: "Unauthorized assignment",
      questionVersionIds: [f.question._id], policy,
    }, otherTeacher)).statusCode, 404);
    const task = await f.post("/api/group-tasks", {
      groupId: group._id, title: "تمرین دو دانش‌آموز",
      questionVersionIds: [f.question._id], policy,
    }, f.teacher);
    assert.equal(task.state, "draft");
    await f.post("/api/class-groups/" + group._id + "/members", {
      studentIds: [student1],
    }, f.teacher);
    // Existing task snapshot retains its original recipients.
    assert.deepEqual(
      (await f.c("groupTasks").findOne({ _id: task._id }))?.studentIds,
      [student1, student2],
    );
    assert.equal((await f.request("/api/group-tasks/" + task._id + "/publish", {}, otherTeacher)).statusCode, 404);
    assert.equal(await f.c("assignments").countDocuments({ groupTaskId: task._id }), 0);
    await f.post("/api/group-tasks/" + task._id + "/publish", {}, f.teacher);
    assert.equal(await f.c("assignments").countDocuments({ groupTaskId: task._id }), 2);
    assert.equal(await f.c("missions").countDocuments({ groupTaskId: task._id }), 2);
    await f.post("/api/group-tasks/" + task._id + "/publish", {}, f.teacher);
    assert.equal(await f.c("assignments").countDocuments({ groupTaskId: task._id }), 2);
    const assignments = await f.c("assignments").find({ groupTaskId: task._id }).toArray();
    const a1 = assignments.find((a) => a.studentId === student1)!;
    const a2 = assignments.find((a) => a.studentId === student2)!;
    assert.notEqual(a1.missionId, a2.missionId);
    assert.notEqual(a1._id, a2._id);
    assert.equal(a1.enrollmentId !== a2.enrollmentId, true);
    assert.equal((await f.request("/api/assignments/" + a2._id, undefined, f.student)).statusCode, 404);
    assert.equal((await f.request("/api/assignments/" + a1._id, undefined, student2cookie)).statusCode, 404);
    assert.equal((await f.request("/api/assignments/" + a1._id + "/report", undefined, otherTeacher)).statusCode, 404);
    assert.equal((await f.request("/api/group-tasks/" + task._id + "/report", undefined, f.student)).statusCode, 403);
    assert.equal((await f.request("/api/group-tasks/" + task._id + "/report", undefined, otherTeacher)).statusCode, 404);

    await f.post("/api/assignments/" + a1._id + "/attempts", {
      questionId: f.question._id, answer: "2",
    }, f.student);
    await f.post("/api/assignments/" + a1._id + "/complete", {}, f.student);
    await f.post("/api/assignments/" + a2._id + "/attempts", {
      questionId: f.question._id, answer: "3",
    }, student2cookie);
    const report = (await f.request("/api/group-tasks/" + task._id + "/report", undefined, f.teacher)).json();
    assert.equal(report.recipients, 2);
    assert.equal(report.students.length, 2);
    const r1 = report.students.find((s: { studentId: string }) => s.studentId === student1);
    const r2 = report.students.find((s: { studentId: string }) => s.studentId === student2);
    assert.equal(r1.answered, 1);
    assert.equal(r1.independent, 1);
    assert.equal(r1.state, "completed");
    assert.equal(r2.answered, 1);
    assert.equal(r2.independent, 0);
    assert.equal(r2.state, "in_progress");
    assert.ok(!JSON.stringify(report).includes("reference"));
    assert.ok(!JSON.stringify(report).includes("passwordHash"));
    const individual = (await f.request("/api/assignments/" + a1._id + "/report", undefined, f.teacher)).json();
    assert.equal(individual.independent, 1);
    assert.equal((await f.request("/api/assignments/" + a2._id + "/report", undefined, f.teacher)).json().independent, 0);
    // Leaving the course stops only the second student's unfinished assignment.
    const enrollment2 = await f.c("enrollments").findOne({ courseId: course._id, studentId: student2 });
    await f.post("/api/enrollments/" + enrollment2!._id + "/leave", {}, student2cookie);
    assert.equal((await f.c("assignments").findOne({ _id: a2._id }))?.state, "cancelled");
    assert.equal((await f.c("assignments").findOne({ _id: a1._id }))?.state, "completed");
    assert.equal((await f.request("/api/assignments/" + a2._id + "/report", undefined, student2cookie)).statusCode, 200);
  } finally {
    await f.close();
  }
});

test("group publishing rejects inactive recipients atomically without partial assignment", async () => {
  const f = await fixture();
  try {
    const studentId = f.assignment.studentId;
    const course = await f.post("/api/courses", { subject: "ریاضی", title: "ریاضی" }, f.teacher);
    const invitation = await f.post("/api/invitations", { email: "s@test.dev", courseId: course._id }, f.teacher);
    await f.post("/api/invitations/claim", { token: invitation.token }, f.student);
    const group = await f.post("/api/class-groups", {
      courseId: course._id, title: "کلاس آزمایشی", studentIds: [studentId],
    }, f.teacher);
    const task = await f.post("/api/group-tasks", {
      groupId: group._id, title: "تکلیف آزمایشی", questionVersionIds: [f.question._id], policy,
    }, f.teacher);
    const enrollment = await f.c("enrollments").findOne({ courseId: course._id, studentId });
    await f.post("/api/enrollments/" + enrollment!._id + "/leave", {}, f.student);
    assert.equal((await f.request("/api/group-tasks/" + task._id + "/publish", {}, f.teacher)).statusCode, 409);
    assert.equal(await f.c("assignments").countDocuments({ groupTaskId: task._id }), 0);
    assert.equal((await f.c("groupTasks").findOne({ _id: task._id }))?.state, "draft");
  } finally {
    await f.close();
  }
});
