import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { initialSource, sourceCategories } from "../../src/lib/question-source";
test("source categories persist in immutable question versions and are private; invalid combinations rejected", async () => {
  const f = await fixture();
  try {
    for (const category of sourceCategories) {
      const source = {
        ...initialSource(category.id),
        sourceTitle: "آرشیو آزمایشی",
        sourceUrl: "https://konkur.in/",
        bookletCode: "A-1",
        questionNumber: 7,
      };
      const q = await f.post(
        "/api/questions",
        {
          topicId: f.question.topicId,
          statement: `سؤال تست ${category.label}`,
          type: "numeric",
          reference: "2",
          source,
        },
        f.teacher,
        `source-${category.id}`,
      );
      assert.deepEqual(q.source, source);
      assert.deepEqual(
        (await f.c("questionVersions").findOne({ _id: q._id }))!.source,
        source,
      );
    }
    const list = (
      await f.request("/api/questions", undefined, f.teacher)
    ).json();
    assert.equal(list.filter((q: { source?: object }) => q.source).length, 8);
    assert.equal(
      (await f.request("/api/questions", undefined, f.student)).statusCode,
      403,
    );
    const invalid = await f.request(
      "/api/questions",
      {
        topicId: f.question.topicId,
        statement: "سؤال نامعتبر",
        type: "numeric",
        reference: "2",
        source: { family: "practice", administration: "final" },
      },
      f.teacher,
    );
    assert.equal(invalid.statusCode, 400);
  } finally {
    await f.close();
  }
});
