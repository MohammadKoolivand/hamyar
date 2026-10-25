import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
test("report includes ordered questions, actual answers and keys after submission, including deliberately unanswered questions", async () => {
  const f = await fixture();
  try {
    const students = (
      await f.request("/api/students", undefined, f.teacher)
    ).json();
    const wrong = await f.post(
      "/api/questions",
      {
        classification: "free",
        statement: "سؤال با پاسخ اشتباه",
        type: "choice",
        options: ["یک", "دو"],
        reference: "دو",
      },
      f.teacher,
    );
    const blank = await f.post(
      "/api/questions",
      {
        classification: "free",
        statement: "سؤال بدون پاسخ",
        type: "choice",
        options: ["سه", "چهار"],
        reference: "چهار",
      },
      f.teacher,
    );
    const m = await f.post(
      "/api/missions",
      {
        title: "گزارش کامل سؤال‌ها",
        studentId: students[0]._id,
        questionVersionIds: [f.question._id, wrong._id, blank._id],
        policy: {
          maxHints: 0,
          maxAttempts: 2,
          independent: true,
          feedbackMode: "immediate",
        },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${m._id}/publish`, {}, f.teacher);
    const assignments = (
      await f.request("/api/missions", undefined, f.student)
    ).json();
    const a = assignments.find(
      (a: { missionId: string }) => a.missionId === m._id,
    );
    const path = `/api/assignments/${a._id}`;
    await f.post(
      path + "/attempts",
      { questionId: f.question._id, answer: "2" },
      f.student,
    );
    await f.post(
      path + "/attempts",
      { questionId: wrong._id, answer: "یک" },
      f.student,
    );
    const before = (
      await f.request(path + "/report", undefined, f.student)
    ).json();
    assert.equal(before.questions[0].reference, undefined);
    assert.equal(before.questions[2].result, "unanswered");
    assert.equal(
      (await f.request(path + "/complete", {}, f.student)).statusCode,
      409,
    );
    await f.post(path + "/complete", { allowUnanswered: true }, f.student);
    const report = (
      await f.request(path + "/report", undefined, f.student)
    ).json();
    assert.deepEqual(
      report.questions.map((q: { _id: string }) => q._id),
      [f.question._id, wrong._id, blank._id],
    );
    assert.deepEqual(
      report.questions.map((q: { result: string }) => q.result),
      ["correct", "incorrect", "unanswered"],
    );
    assert.equal(report.questions[1].answer, "یک");
    assert.equal(report.questions[1].reference, "دو");
    assert.equal(report.questions[2].answer, null);
    assert.equal(report.unanswered, 1);
    assert.equal(report.incorrect, 1);
    assert.equal(report.answered, 2);
    assert.equal(report.evidence.length, 2);
    assert.equal(report.questions[0].hintBank, undefined);
    assert.equal(report.questions[0].importReview, undefined);
    const learning = (
      await f.request(
        `/api/students/${students[0]._id}/progress`,
        undefined,
        f.student,
      )
    ).json();
    assert.ok(
      learning.recentMissions.some(
        (m: { assignmentId: string; total: number }) =>
          m.assignmentId === a._id && m.total === 3,
      ),
    );
  } finally {
    await f.close();
  }
});
test("explicitly submitting entirely unanswered work produces yellow-ready question rows without fake attempts", async () => {
  const f = await fixture();
  try {
    const students = (
      await f.request("/api/students", undefined, f.teacher)
    ).json();
    const m = await f.post(
      "/api/missions",
      {
        title: "تمرین کاملاً نزده",
        studentId: students[0]._id,
        questionVersionIds: [f.question._id],
        policy: {
          maxHints: 0,
          maxAttempts: 1,
          independent: true,
          feedbackMode: "end",
        },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${m._id}/publish`, {}, f.teacher);
    const rows = (
      await f.request("/api/missions", undefined, f.student)
    ).json();
    const a = rows.find((a: { missionId: string }) => a.missionId === m._id);
    await f.post(
      `/api/assignments/${a._id}/complete`,
      { allowUnanswered: true },
      f.student,
    );
    const r = (
      await f.request(`/api/assignments/${a._id}/report`, undefined, f.student)
    ).json();
    assert.equal(r.unanswered, 1);
    assert.equal(r.questions[0].result, "unanswered");
    assert.equal(r.evidence.length, 0);
    assert.equal(r.questions[0].reference, "2");
  } finally {
    await f.close();
  }
});
