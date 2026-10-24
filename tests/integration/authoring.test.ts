import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import type { QuestionGenerator } from "../../src/server/ai/question-generator";
const generator: QuestionGenerator = {
  async generate(input) {
    assert.equal(input.topic, "Configurable Topic");
    assert.ok(!JSON.stringify(input).includes("student"));
    return {
      provider: "fake-test-only",
      model: "fixture",
      promptVersion: "test-v1",
      question: {
        statement: "حاصل سه به اضافه چهار چیست؟",
        reference: "7",
        options: [],
        hints: ["به شمارش ادامه بده."],
      },
    };
  },
};
test("generated questions stay private drafts until edited teacher approval; replay/reject/isolation", async () => {
  const f = await fixture({ questionGenerator: generator });
  try {
    const before = await f.c("questionVersions").countDocuments(),
      body = {
        topicId: f.question.topicId,
        brief: "تمرین جمع برای پایه مشخص",
        type: "numeric",
      };
    const draft = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
      "generate-intent-1",
    );
    const replay = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
      "generate-intent-1",
    );
    assert.equal(replay._id, draft._id);
    assert.equal(
      (
        await f.request(
          "/api/question-drafts/generate",
          { ...body, brief: "هدف متفاوت همین مبحث" },
          f.teacher,
          "generate-intent-1",
        )
      ).statusCode,
      409,
    );
    assert.equal(await f.c("questionDrafts").countDocuments(), 1);
    assert.equal(await f.c("questionVersions").countDocuments(), before);
    assert.equal(
      (await f.request("/api/question-drafts", undefined, f.student))
        .statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-drafts/${draft._id}/approve`,
          { question: draft.question, confirmed: false },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    const edited = {
      ...draft.question,
      statement: "حاصل چهار به اضافه چهار چیست؟",
      reference: "8",
    };
    const approved = await f.post(
      `/api/question-drafts/${draft._id}/approve`,
      { question: edited, confirmed: true },
      f.teacher,
      "approve-intent-1",
    );
    assert.equal(approved.reference, "8");
    assert.equal(approved.origin, "ai_reviewed");
    assert.equal(
      (
        await f.post(
          `/api/question-drafts/${draft._id}/approve`,
          { question: edited, confirmed: true },
          f.teacher,
          "approve-intent-1",
        )
      )._id,
      approved._id,
    );
    assert.equal(await f.c("questionVersions").countDocuments(), before + 1);
    const rejected = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
    );
    await f.post(
      `/api/question-drafts/${rejected._id}/reject`,
      { reason: "سطح دشواری مناسب نیست" },
      f.teacher,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-drafts/${rejected._id}/approve`,
          { question: edited, confirmed: true },
          f.teacher,
        )
      ).statusCode,
      409,
    );
    assert.equal(await f.c("questionVersions").countDocuments(), before + 1);
    await f.post("/api/auth/register", {
      name: "Other Teacher",
      email: "other@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "other@test.dev",
      password: "StrongPass123!",
    });
    const other = "session=" + login.cookies[0].value;
    assert.deepEqual(
      (await f.request("/api/question-drafts", undefined, other)).json(),
      [],
    );
    assert.equal(
      (
        await f.request(
          `/api/question-drafts/${draft._id}/reject`,
          { reason: "other" },
          other,
        )
      ).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
test("unavailable generator cannot add questions; invalid numeric reference requires teacher correction", async () => {
  for (const provider of [
    undefined,
    {
      async generate() {
        return {
          ...(await generator.generate({
            topic: "Configurable Topic",
            curriculum: [],
            brief: "test",
            type: "numeric",
          })),
          question: {
            statement: "نامعتبر",
            reference: "not numeric",
            options: [],
            hints: [],
          },
        };
      },
    },
  ]) {
    const f = await fixture({ questionGenerator: provider });
    try {
      const before = await f.c("questionVersions").countDocuments();
      const r = await f.request(
        "/api/question-drafts/generate",
        {
          topicId: f.question.topicId,
          brief: "هدف تمرین مشخص",
          type: "numeric",
        },
        f.teacher,
      );
      assert.equal(r.statusCode, provider ? 200 : 503);
      if (provider) {
        const draft = r.json();
        assert.ok(draft.validationIssues.length > 0);
        assert.equal(
          (
            await f.request(
              `/api/question-drafts/${draft._id}/approve`,
              { question: draft.question, confirmed: true },
              f.teacher,
            )
          ).statusCode,
          400,
        );
      }
      assert.equal(await f.c("questionVersions").countDocuments(), before);
      assert.equal(
        await f.c("questionDrafts").countDocuments(),
        provider ? 1 : 0,
      );
    } finally {
      await f.close();
    }
  }
});

test("question version/draft approval rollback together at the final write boundary", async () => {
  let armed = false;
  const f = await fixture({
    questionGenerator: generator,
    hooks: {
      boundary: async (point) => {
        if (armed && point === "after_question_version_insert")
          throw new Error("injected authoring interruption");
      },
    },
  });
  try {
    const draft = await f.post(
      "/api/question-drafts/generate",
      { topicId: f.question.topicId, brief: "هدف تمرین مشخص", type: "numeric" },
      f.teacher,
    );
    const before = await f.c("questionVersions").countDocuments();
    armed = true;
    assert.equal(
      (
        await f.request(
          `/api/question-drafts/${draft._id}/approve`,
          { question: draft.question, confirmed: true },
          f.teacher,
          "approval-rollback-1",
        )
      ).statusCode,
      500,
    );
    assert.equal(await f.c("questionVersions").countDocuments(), before);
    assert.equal(
      (await f.c("questionDrafts").findOne({ _id: draft._id }))!.state,
      "pending_review",
    );
    assert.equal(
      await f.c("auditLogs").countDocuments({ action: "approve_ai_question" }),
      0,
    );
    armed = false;
    await f.post(
      `/api/question-drafts/${draft._id}/approve`,
      { question: draft.question, confirmed: true },
      f.teacher,
      "approval-rollback-1",
    );
    assert.equal(await f.c("questionVersions").countDocuments(), before + 1);
  } finally {
    await f.close();
  }
});
