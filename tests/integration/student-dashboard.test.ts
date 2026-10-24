import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

test("student dashboard groups lessons, counts real evaluations, and keeps legacy work separate", async () => {
  const f = await fixture();
  try {
    const sid = f.assignment.studentId;
    const password = "StrongPass123!";
    // A legacy mission already exists in fixture without any course identifier.
    assert.equal((await f.request("/api/student/dashboard", undefined, f.teacher)).statusCode, 403);
    assert.equal((await f.request("/api/student/dashboard")).statusCode, 401);

    const math = await f.post("/api/courses", {
      subject: "ریاضی", title: "ریاضی دهم",
    }, f.teacher);
    const mathInvite = await f.post("/api/invitations", {
      email: "s@test.dev", courseId: math._id,
    }, f.teacher);
    await f.post("/api/invitations/claim", { token: mathInvite.token }, f.student);

    await f.post("/api/auth/register", {
      name: "Physics Teacher", email: "physics@test.dev", password, role: "teacher",
    });
    const login = await f.request("/api/auth/login", {
      email: "physics@test.dev", password,
    });
    const physicsTeacher = "session=" + login.cookies[0].value;
    const physics = await f.post("/api/courses", {
      subject: "فیزیک", title: "فیزیک یازدهم",
    }, physicsTeacher);
    const physicsInvite = await f.post("/api/invitations", {
      email: "s@test.dev", courseId: physics._id,
    }, physicsTeacher);
    await f.post("/api/invitations/claim", { token: physicsInvite.token }, f.student);

    const topic = await f.post("/api/curriculum", {
      kind: "topic", title: "حرکت",
    }, physicsTeacher);
    const q = await f.post("/api/questions", {
      topicId: topic._id, statement: "دو ضرب در یک؟",
      reference: "2", type: "numeric",
      hints: ["دوباره ضرب را بررسی کن."],
    }, physicsTeacher);
    const policy = { maxAttempts: 3, maxHints: 2, independent: false };
    const mathMission = await f.post("/api/missions", {
      title: "آزمون معادله", studentId: sid, courseId: math._id,
      questionVersionIds: [f.question._id], policy,
    }, f.teacher);
    const physicsMission = await f.post("/api/missions", {
      title: "آزمون حرکت", studentId: sid, courseId: physics._id,
      questionVersionIds: [q._id], policy,
    }, physicsTeacher);
    await f.post("/api/missions/" + mathMission._id + "/publish", {}, f.teacher);
    await f.post("/api/missions/" + physicsMission._id + "/publish", {}, physicsTeacher);
    const mathAssignment = await f.c("assignments").findOne({ missionId: mathMission._id });
    const physicsAssignment = await f.c("assignments").findOne({ missionId: physicsMission._id });
    assert.ok(mathAssignment);
    assert.ok(physicsAssignment);
    await f.post("/api/assignments/" + mathAssignment!._id + "/attempts", {
      questionId: f.question._id, answer: "2",
    }, f.student);
    // A hint makes physics correct-with-help rather than independent correctness.
    await f.post("/api/assignments/" + physicsAssignment!._id + "/hints", {
      questionId: q._id,
    }, f.student);
    await f.post("/api/assignments/" + physicsAssignment!._id + "/attempts", {
      questionId: q._id, answer: "2",
    }, f.student);

    const response = await f.request("/api/student/dashboard", undefined, f.student);
    assert.equal(response.statusCode, 200, response.body);
    const dashboard = response.json();
    assert.equal(dashboard.summary.activeCourses, 2);
    assert.equal(dashboard.summary.assignments, 3); // 2 course + fixture legacy
    assert.equal(dashboard.summary.answeredQuestions, 2);
    assert.equal(dashboard.courses.length, 2);
    const mathView = dashboard.courses.find((c: { courseId: string }) => c.courseId === math._id);
    const physicsView = dashboard.courses.find((c: { courseId: string }) => c.courseId === physics._id);
    assert.ok(mathView);
    assert.ok(physicsView);
    assert.equal(mathView.assignments, 1);
    assert.equal(mathView.correctIndependent, 1);
    assert.equal(mathView.correctAssisted, 0);
    assert.equal(mathView.answeredQuestions, 1);
    assert.equal(physicsView.correctIndependent, 0);
    assert.equal(physicsView.correctAssisted, 1);
    assert.equal(physicsView.teacherName, "Physics Teacher");
    assert.equal(dashboard.legacy.assignments, 1);
    assert.equal(dashboard.legacy.missions[0]._id, f.assignment._id);
    assert.ok(!response.body.includes("passwordHash"));
    assert.ok(!response.body.includes("reference"));
    assert.ok(!response.body.includes("hints"));
    assert.ok(!response.body.includes("sourceAnswer"));

    // Evaluation can change after teacher review: the dashboard must use the
    // latest canonical evaluation, not a stored percentage or stale counter.
    await f.post("/api/assignments/" + mathAssignment!._id + "/complete", {}, f.student);
    const updated = (await f.request("/api/student/dashboard", undefined, f.student)).json();
    const mathUpdated = updated.courses.find((c: { courseId: string }) => c.courseId === math._id);
    assert.equal(mathUpdated.completed, 1);
    assert.equal(updated.summary.completed, 1);

    // A separately registered student has no courses or leaked records.
    await f.post("/api/auth/register", {
      name: "Other Student", email: "other@test.dev", password, role: "student",
    });
    const otherLogin = await f.request("/api/auth/login", {
      email: "other@test.dev", password,
    });
    const other = "session=" + otherLogin.cookies[0].value;
    const empty = (await f.request("/api/student/dashboard", undefined, other)).json();
    assert.deepEqual(empty.courses, []);
    assert.equal(empty.summary.assignments, 0);
    assert.equal(empty.legacy.assignments, 0);
  } finally {
    await f.close();
  }
});
