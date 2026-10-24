import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { visualTemplate } from "../../src/lib/question-visuals";
import type { QuestionGenerator } from "../../src/server/ai/question-generator";
test("visual authoring survives review, immutable version, mission snapshot and student projection without private answer", async () => {
  let omit = false;
  const generator: QuestionGenerator = {
    async generate(input) {
      assert.equal(input.visualKind, "chart");
      return {
        provider: "test-only",
        model: "fixture",
        promptVersion: "test",
        question: {
          statement:
            "شتاب را از نمودار حساب کنید؛ $a=\\frac{\\Delta v}{\\Delta t}$",
          reference: "2",
          hints: [],
          options: [],
          ...(!omit
            ? { visuals: [visualTemplate("chart"), visualTemplate("formula")] }
            : {}),
        },
      };
    },
  };
  const f = await fixture({ questionGenerator: generator });
  try {
    const body = {
      topicId: f.question.topicId,
      brief: "نمودار سرعت زمان با شیب ۲",
      type: "numeric",
      visualKind: "chart",
    };
    const draft = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
    );
    assert.equal(draft.validationIssues.length, 0);
    assert.equal(draft.state, "pending_review");
    const approved = await f.post(
      `/api/question-drafts/${draft._id}/approve`,
      { question: draft.question, confirmed: true },
      f.teacher,
    );
    assert.equal(approved.visuals.length, 2);
    const mission = await f.post(
      "/api/missions",
      {
        title: "تمرین نموداری",
        studentId: f.assignment.studentId,
        questionVersionIds: [approved._id],
        policy: { maxAttempts: 3, maxHints: 0, independent: true },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    const a = await f.c("assignments").findOne({ missionId: mission._id });
    const student = (
      await f.request(`/api/assignments/${a!._id}`, undefined, f.student)
    ).json();
    assert.deepEqual(student.questions[0].visuals, approved.visuals);
    assert.ok(!("reference" in student.questions[0]));
    assert.ok(!("hints" in student.questions[0]));
    const grade = await f.post(
      `/api/assignments/${a!._id}/attempts`,
      { questionId: approved._id, answer: "2" },
      f.student,
    );
    assert.ok(grade);
    omit = true;
    const incomplete = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
    );
    assert.ok(incomplete.validationIssues.length);
    const stripped = { ...incomplete.question };
    delete stripped.visualKind;
    assert.equal(
      (
        await f.request(
          `/api/question-drafts/${incomplete._id}/approve`,
          { question: stripped, confirmed: true },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-drafts/${incomplete._id}/approve`,
          {
            question: {
              ...incomplete.question,
              visuals: [visualTemplate("chart")],
            },
            confirmed: true,
          },
          f.teacher,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await f.request(
          "/api/questions",
          {
            topicId: f.question.topicId,
            statement: "سؤال نامعتبر",
            type: "numeric",
            reference: "2",
            visuals: [
              {
                kind: "formula",
                caption: "بدون اعتبار",
                latex: "\\url{https://example.com}",
              },
            ],
          },
          f.teacher,
        )
      ).statusCode,
      400,
    );
  } finally {
    await f.close();
  }
});
