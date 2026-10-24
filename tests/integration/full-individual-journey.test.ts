import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

/**
 * Covers the owner's twelve-step individual tutoring journey on real MongoDB:
 * accounts → course → curriculum → five teacher-approved questions →
 * enrollment → individual mission → hints/attempts → teacher evidence →
 * remedial follow-up → corrected evidence → restricted guardian view.
 * Every user, action, question and outcome here is synthetic.
 */
test("12-step individual learning journey: five questions, recovery and parent isolation", async () => {
  const f = await fixture();
  try {
    const password = "StrongPass123!";
    // Step 1: Teacher independently registers and signs in.
    await f.post("/api/auth/register", {
      name: "Journey Teacher", email: "journey-teacher@test.dev",
      password, role: "teacher",
    });
    const teacherLogin = await f.request("/api/auth/login", {
      email: "journey-teacher@test.dev", password,
    });
    assert.equal(teacherLogin.statusCode, 200);
    const teacher = "session=" + teacherLogin.cookies[0].value;
    const teacherId = teacherLogin.json()._id;

    // Steps 2–4: Course, topic, skill and five approved private questions.
    const course = await f.post("/api/courses", {
      title: "ریاضی دهم", subject: "ریاضی",
    }, teacher);
    const topic = await f.post("/api/curriculum", {
      kind: "topic", title: "معادلات ساده",
    }, teacher);
    const skill = await f.post("/api/curriculum", {
      kind: "skill", title: "حل مستقل معادلات", parentId: topic._id,
    }, teacher);
    const questions: { _id: string }[] = [];
    for (let i = 0; i < 5; i++) {
      questions.push(await f.post("/api/questions", {
        topicId: topic._id, skillIds: [skill._id],
        statement: "سؤال آزمایشی شماره " + (i + 1) + " را حساب کنید",
        type: "numeric", reference: String(i + 2),
        hints: ["راهنمای تأییدشده برای حل سؤال"],
      }, teacher));
    }
    assert.equal(questions.length, 5);
    assert.equal((await f.request("/api/questions", undefined, teacher)).json().length, 5);

    // Step 5: Independent student signup and email-bound course invitation.
    await f.post("/api/auth/register", {
      name: "Journey Student", email: "journey-student@test.dev",
      password, role: "student",
    });
    const studentLogin = await f.request("/api/auth/login", {
      email: "journey-student@test.dev", password,
    });
    assert.equal(studentLogin.statusCode, 200);
    const student = "session=" + studentLogin.cookies[0].value;
    const studentId = studentLogin.json()._id;
    assert.deepEqual((await f.request("/api/assignments", undefined, student)).json(), []);
    assert.equal((await f.request("/api/questions", undefined, student)).statusCode, 403);
    const invite = await f.post("/api/invitations", {
      email: "journey-student@test.dev", courseId: course._id,
    }, teacher);
    await f.post("/api/invitations/claim", { token: invite.token }, student);
    const member = await f.c("enrollments").findOne({
      teacherId, studentId, courseId: course._id,
    });
    assert.equal(member?.status, "active");
    assert.equal((await f.request("/api/courses", undefined, student)).json().length, 1);

    // Step 6: One teacher-approved individual mission containing five items.
    const mission = await f.post("/api/missions", {
      title: "تمرین اولیه ریاضی", studentId, courseId: course._id,
      questionVersionIds: questions.map((q) => q._id),
      policy: { maxAttempts: 3, maxHints: 2, independent: false },
    }, teacher);
    assert.equal(mission.state, "draft");
    await f.post("/api/missions/" + mission._id + "/publish", {}, teacher);
    const a = await f.c("assignments").findOne({ missionId: mission._id });
    assert.ok(a);
    assert.equal(a.questionVersionIds.length, 5);
    const path = "/api/assignments/" + a._id;
    assert.equal((await f.request(path, undefined, student)).json().questions.length, 5);
    assert.equal((await f.request(path, undefined, f.student)).statusCode, 404);

    // Steps 7–8: One unresolved error, one correct answer after an approved
    // hint, and three correct independent answers.
    const incorrect = await f.post(path + "/attempts", {
      questionId: questions[0]._id, answer: "99",
    }, student);
    assert.equal(incorrect.evaluation.result, "incorrect");
    const hint = await f.post(path + "/hints", {
      questionId: questions[1]._id,
    }, student);
    assert.equal(hint.provider, "mock-approved-hints");
    const helped = await f.post(path + "/attempts", {
      questionId: questions[1]._id, answer: "3",
    }, student);
    assert.equal(helped.evaluation.result, "correct");
    assert.equal(helped.attempt.hintsUsed, 1);
    for (let i = 2; i < 5; i++) {
      const submitted = await f.post(path + "/attempts", {
        questionId: questions[i]._id, answer: String(i + 2),
      }, student);
      assert.equal(submitted.evaluation.result, "correct");
      assert.equal(submitted.attempt.hintsUsed, 0);
    }
    await f.post(path + "/complete", {}, student);
    assert.equal((await f.c("assignments").findOne({ _id: a._id }))?.state, "completed");

    // Step 9: Teacher receives five real evaluations, with no fabricated mastery.
    const report = (await f.request(path + "/report", undefined, teacher)).json();
    assert.equal(report.total, 5);
    assert.equal(report.answered, 5);
    assert.equal(report.independent, 3);
    assert.equal(report.assisted, 1);
    assert.equal(report.pending, 0);
    assert.equal(report.hints, 1);
    const progress = (await f.request(
      "/api/students/" + studentId + "/progress", undefined, teacher,
    )).json();
    assert.equal(progress.skills.length, 1);
    assert.ok(progress.mistakes.some(
      (m: { questionVersionId: string }) => m.questionVersionId === questions[0]._id,
    ));
    assert.ok(progress.trends.some(
      (t: { assignmentId: string }) => t.assignmentId === a._id,
    ));

    // Steps 10–11: Publish a single targeted retry. The open question must
    // not be suggested again before its practice is finished.
    const endpoint = "/api/students/" + studentId;
    const query = "?courseId=" + course._id;
    const initial = (await f.request(endpoint + "/remediation-candidates" + query,
      undefined, teacher)).json();
    assert.deepEqual(initial.items.map(
      (q: { questionVersionId: string }) => q.questionVersionId,
    ), [questions[0]._id]);
    const remedial = await f.post(endpoint + "/remediation-missions", {
      courseId: course._id, title: "مرور خطای فردی",
      questionVersionIds: [questions[0]._id],
      policy: { maxAttempts: 1, maxHints: 0, independent: true },
    }, teacher, "journey-remediation-one");
    const remedialAssignment = await f.c("assignments").findOne({
      _id: remedial.assignmentId,
    });
    assert.equal(remedialAssignment?.studentId, studentId);
    assert.equal(remedialAssignment?.enrollmentId, member._id);
    assert.equal(remedialAssignment?.remediation, true);
    assert.deepEqual((await f.request(endpoint + "/remediation-candidates" + query,
      undefined, teacher)).json().items, []);
    assert.equal((await f.request(endpoint + "/remediation-missions", {
      courseId: course._id, title: "تکلیف تقویتی تکراری",
      questionVersionIds: [questions[0]._id],
      policy: { maxAttempts: 1, maxHints: 0, independent: true },
    }, teacher)).statusCode, 409);
    const retryPath = "/api/assignments/" + remedial.assignmentId;
    assert.equal((await f.request(retryPath + "/hints", {
      questionId: questions[0]._id,
    }, student)).statusCode, 409);
    const corrected = await f.post(retryPath + "/attempts", {
      questionId: questions[0]._id, answer: "2",
    }, student);
    assert.equal(corrected.evaluation.result, "correct");
    await f.post(retryPath + "/complete", {}, student);
    assert.equal((await f.request(retryPath + "/report", undefined, teacher)).json().independent, 1);
    const followUp = (await f.request(endpoint + "/remediation-candidates" + query,
      undefined, teacher)).json();
    assert.deepEqual(followUp.items, []);
    const updatedProgress = (await f.request(
      endpoint + "/progress", undefined, teacher,
    )).json();
    assert.equal(updatedProgress.trends.length, 2);
    assert.equal(updatedProgress.answered, 6);
    assert.ok(updatedProgress.skills[0].supportingAttempts >= 6);
    assert.equal(await f.c("attempts").countDocuments({
      studentId, assignmentId: { $in: [a._id, remedial.assignmentId] },
    }), 6);

    // Step 12: A teacher-invited parent has only scoped read-only access.
    const parentInvite = await f.post("/api/invitations", {
      email: "journey-parent@test.dev", role: "parent", studentId,
    }, teacher);
    await f.post("/api/invitations/accept", {
      name: "Journey Parent", email: "journey-parent@test.dev",
      password, token: parentInvite.token,
    });
    const parentLogin = await f.request("/api/auth/login", {
      email: "journey-parent@test.dev", password,
    });
    assert.equal(parentLogin.statusCode, 200);
    const parent = "session=" + parentLogin.cookies[0].value;
    assert.deepEqual((await f.request("/api/children", undefined, parent))
      .json().map((c: { _id: string }) => c._id), [studentId]);
    const parentProgress = (await f.request(
      endpoint + "/progress", undefined, parent,
    )).json();
    assert.equal(parentProgress.role, "parent");
    assert.equal(parentProgress.answered, 6);
    assert.equal(parentProgress.trends, undefined);
    assert.equal(parentProgress.evidence, undefined);
    assert.equal((await f.request(retryPath + "/report", undefined, parent)).statusCode, 200);
    assert.equal((await f.request(retryPath, undefined, parent)).statusCode, 403);
    assert.equal((await f.request(retryPath + "/attempts", {
      questionId: questions[0]._id, answer: "2",
    }, parent)).statusCode, 403);
    assert.equal((await f.request("/api/questions", undefined, parent)).statusCode, 403);
    assert.equal((await f.request("/api/students/" + f.assignment.studentId + "/progress",
      undefined, parent)).statusCode, 404);
  } finally {
    await f.close();
  }
});
