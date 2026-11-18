import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { questionVisualSchema } from "../../src/lib/question-visuals";
import { randomUUID } from "node:crypto";
test("question revisions preserve assigned versions, latest bank, ownership and idempotency", async () => {
  const f = await fixture();
  try {
    const path = `/api/questions/${f.question._id}/revise`;
    const body = {
      ...f.question,
      statement: "متن ویرایش شده سؤال",
      type: "choice",
      options: ["یک", "دو", "سه"],
      reference: "سه",
      difficulty: "hard",
    };
    assert.equal((await f.request(path, body, f.student)).statusCode, 403);
    assert.equal((await f.request(path, body)).statusCode, 401);
    const next = await f.post(path, body, f.teacher, "revision-test-key");
    assert.equal(next.version, 2);
    assert.equal(next.questionId, f.question.questionId);
    assert.equal(next.origin, "human_revised");
    assert.equal(
      (await f.post(path, body, f.teacher, "revision-test-key"))._id,
      next._id,
    );
    assert.equal(
      (
        await f.request(
          path,
          { ...body, statement: "تغییر همزمان سؤال" },
          f.teacher,
        )
      ).statusCode,
      409,
    );
    const bank = (
      await f.request("/api/questions", undefined, f.teacher)
    ).json();
    assert.deepEqual(
      bank.map((q: { _id: string }) => q._id),
      [next._id],
    );
    const old = (
      await f.request(`/api/questions/${f.question._id}`, undefined, f.teacher)
    ).json();
    assert.equal(old.statement, f.question.statement);
    const assignment = (
      await f.request(
        `/api/assignments/${f.assignment._id}`,
        undefined,
        f.student,
      )
    ).json();
    assert.equal(assignment.questions[0]._id, f.question._id);
    assert.equal(assignment.questions[0].statement, f.question.statement);
    assert.equal(
      (
        await f.request(
          `/api/questions/${f.question._id}`,
          undefined,
          f.student,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          `/api/questions/${randomUUID()}/revise`,
          body,
          f.teacher,
        )
      ).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
test("image crop metadata is bounded and cannot escape original image", () => {
  const image = {
    kind: "image",
    caption: "تصویر آزمون",
    assetId: randomUUID(),
    width: 1000,
    height: 500,
  };
  assert.equal(
    questionVisualSchema.safeParse({
      ...image,
      crop: { x: 10, y: 20, width: 80, height: 60 },
    }).success,
    true,
  );
  for (const crop of [
    { x: 90, y: 0, width: 20, height: 50 },
    { x: -1, y: 0, width: 10, height: 50 },
    { x: 0, y: 0, width: 0, height: 50 },
    { x: 0, y: 0, width: Infinity, height: 50 },
  ])
    assert.equal(
      questionVisualSchema.safeParse({ ...image, crop }).success,
      false,
    );
});

test("editing the booklet question number creates a new version without altering the original", async () => {
  const f = await fixture();
  try {
    const source = {
      family: "konkur" as const,
      group: "experimental" as const,
      academicYear: "۱۴۰۵",
      sourceTitle: "کنکور تجربی ۱۴۰۵",
      questionNumber: 32,
    };
    const original = await f.post("/api/questions", {
      topicId: f.question.topicId,
      statement: "شماره سؤال در دفترچه را بررسی کنید",
      type: "numeric",
      reference: "2",
      source,
    }, f.teacher, "booklet-number-original");
    const revised = await f.post(
      `/api/questions/${original._id}/revise`,
      {
        ...original,
        source: { ...source, questionNumber: 35 },
      },
      f.teacher,
      "booklet-number-revised",
    );
    assert.equal(revised.source.questionNumber, 35);
    assert.equal(revised.questionId, original.questionId);
    const previous = (await f.request(`/api/questions/${original._id}`, undefined, f.teacher)).json();
    assert.equal(previous.source.questionNumber, 32);
    const current = (await f.request(`/api/questions/${revised._id}`, undefined, f.teacher)).json();
    assert.equal(current.source.questionNumber, 35);
    const bank = (await f.request("/api/questions", undefined, f.teacher)).json() as Array<{
      _id: string; source?: { questionNumber?: number };
    }>;
    assert.equal(bank.find((q) => q._id === revised._id)?.source?.questionNumber, 35);
    assert.ok(!bank.some((q) => q._id === original._id));
  } finally {
    await f.close();
  }
});
