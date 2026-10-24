import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
test("persistent evidence/notebook/mastery and teacher override use only authorized canonical work", async () => {
  const f = await fixture();
  try {
    const topic = (await f
      .c("questionVersions")
      .findOne({ _id: f.question._id }))!.topicId;
    const skill = await f.post(
      "/api/curriculum",
      { title: "Configurable skill", kind: "skill", parentId: topic },
      f.teacher,
    );
    await f
      .c("questionVersions")
      .updateOne({ _id: f.question._id }, { $set: { skillIds: [skill._id] } });
    const wrong = await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "1" },
      f.student,
      "learning-wrong-key",
    );
    const evidence = await f
      .c("learningEvidence")
      .findOne({ _id: wrong.attempt._id });
    assert.equal(evidence!.skillIds[0], skill._id);
    assert.equal(
      await f
        .c("mistakeRecords")
        .countDocuments({ studentId: f.assignment.studentId }),
      1,
    );
    await f.post(f.path + "/hints", { questionId: f.question._id }, f.student);
    await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "2" },
      f.student,
    );
    let student = (
      await f.request(
        "/api/students/" + f.assignment.studentId + "/progress",
        undefined,
        f.student,
      )
    ).json();
    assert.equal(student.mistakes[0].status, "needs_practice");
    assert.equal(student.skills[0].status, "insufficient_evidence");
    assert.equal(student.evidence, undefined);
    assert.equal(student.trends, undefined);
    for (let n = 0; n < 3; n++) {
      const q = await f.post(
          "/api/questions",
          {
            topicId: topic,
            skillIds: [skill._id],
            statement: "Follow-up " + n,
            type: "numeric",
            reference: "2",
          },
          f.teacher,
        ),
        m = await f.post(
          "/api/missions",
          {
            title: "Independent check " + n,
            studentId: f.assignment.studentId,
            questionVersionIds: [q._id],
            policy: { maxAttempts: 1, maxHints: 0, independent: true },
          },
          f.teacher,
        );
      await f.post("/api/missions/" + m._id + "/publish", {}, f.teacher);
      const a = (await f.c("assignments").findOne({ missionId: m._id }))!;
      await f.post(
        "/api/assignments/" + a._id + "/attempts",
        { questionId: q._id, answer: "2" },
        f.student,
      );
    }
    student = (
      await f.request(
        "/api/students/" + f.assignment.studentId + "/progress",
        undefined,
        f.student,
      )
    ).json();
    assert.equal(student.mistakes[0].status, "resolved");
    assert.ok(student.mistakes[0].improvementEvidenceIds.length >= 2);
    assert.equal(student.skills[0].distinctQuestions, 4);
    const teacher = (
      await f.request(
        "/api/students/" + f.assignment.studentId + "/progress",
        undefined,
        f.teacher,
      )
    ).json();
    assert.equal(
      teacher.independentSuccessRate,
      student.independentSuccessRate,
    );
    assert.equal(teacher.evidence.length, 5);
    assert.equal(teacher.trends.length, 4);
    assert.ok(teacher.recommendations[0].evidenceIds.length > 0);
    await f.post(
      "/api/students/" +
        f.assignment.studentId +
        "/mastery/" +
        skill._id +
        "/override",
      {
        status: "needs_review",
        reason: "Teacher requests another diagnostic check",
      },
      f.teacher,
      "mastery-override-key",
    );
    student = (
      await f.request(
        "/api/students/" + f.assignment.studentId + "/progress",
        undefined,
        f.student,
      )
    ).json();
    assert.equal(student.skills[0].status, "needs_review");
    assert.ok(student.skills[0].derivedStatus);
    assert.equal(student.skills[0].overrideHistory, undefined);
    assert.equal(
      (
        await f.request(
          "/api/students/" +
            f.assignment.studentId +
            "/mastery/" +
            skill._id +
            "/override",
          { status: "proficient", reason: "Student cannot set this" },
          f.student,
        )
      ).statusCode,
      403,
    );
    const reviewed = await f.post(
      "/api/evaluations/" + wrong.evaluation._id + "/review",
      { result: "correct", note: "Initial evaluation corrected" },
      f.teacher,
    );
    assert.equal(reviewed.ok, true);
    assert.equal(
      (await f.c("learningEvidence").findOne({ _id: wrong.attempt._id }))!
        .result,
      "correct",
    );
    assert.equal(
      (await f.c("mistakeRecords").findOne({ _id: wrong.attempt._id }))!.status,
      "corrected_by_review",
    );
    assert.equal(
      (
        await f.request(
          "/api/students/another-student/progress",
          undefined,
          f.student,
        )
      ).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
test("concurrent missions sharing a skill retain all evidence and a consistent mastery projection", async () => {
  const f = await fixture();
  try {
    const topic = (await f
        .c("questionVersions")
        .findOne({ _id: f.question._id }))!.topicId,
      skill = await f.post(
        "/api/curriculum",
        { title: "Shared skill", kind: "skill" },
        f.teacher,
      ),
      items: { questionId: string; path: string }[] = [];
    for (let n = 0; n < 2; n++) {
      const q = await f.post(
          "/api/questions",
          {
            topicId: topic,
            skillIds: [skill._id],
            statement: "Concurrent " + n,
            type: "numeric",
            reference: "2",
          },
          f.teacher,
        ),
        m = await f.post(
          "/api/missions",
          {
            title: "Concurrent mission " + n,
            studentId: f.assignment.studentId,
            questionVersionIds: [q._id],
            policy: { maxAttempts: 1, maxHints: 0, independent: true },
          },
          f.teacher,
        );
      await f.post("/api/missions/" + m._id + "/publish", {}, f.teacher);
      const a = (await f.c("assignments").findOne({ missionId: m._id }))!;
      items.push({ questionId: q._id, path: "/api/assignments/" + a._id });
    }
    const results = await Promise.all(
      items.map((item) =>
        f.request(
          item.path + "/attempts",
          { questionId: item.questionId, answer: "2" },
          f.student,
        ),
      ),
    );
    assert.ok(
      results.every((r) => r.statusCode === 200),
      results.map((r) => r.body).join("\n"),
    );
    const record = await f
      .c("masteryRecords")
      .findOne({ studentId: f.assignment.studentId, skillId: skill._id });
    assert.equal(record!.supportingAttempts, 2);
    assert.equal(
      await f
        .c("learningEvidence")
        .countDocuments({ studentId: f.assignment.studentId }),
      2,
    );
  } finally {
    await f.close();
  }
});
