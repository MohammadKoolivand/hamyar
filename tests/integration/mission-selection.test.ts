import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "../helpers/fixture";

test("mixed difficulty quotas select exact unique owned current versions and reject invalid or insufficient plans", async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    const levels = [
      "easy",
      "easy",
      "medium",
      "medium",
      "medium",
      "hard",
    ] as const;
    for (const [i, difficulty] of levels.entries()) {
      const q = await f.post(
        "/api/questions",
        {
          statement: `سؤال ترکیبی انتخاب ${i}`,
          type: "numeric",
          classification: "free",
          reference: "2",
          difficulty,
        },
        f.teacher,
      );
      ids.push(q._id);
    }
    const selected = await f.post(
      "/api/questions/select",
      {
        candidateIds: [...ids, ids[0], randomUUID()],
        quotas: { easy: 2, medium: 2, hard: 1 },
      },
      f.teacher,
    );
    assert.equal(selected.questionVersionIds.length, 5);
    assert.equal(new Set(selected.questionVersionIds).size, 5);
    const rows = await f
      .c("questionVersions")
      .find({ _id: { $in: selected.questionVersionIds } })
      .toArray();
    assert.deepEqual(
      ["easy", "medium", "hard"].map(
        (d) => rows.filter((q) => q.difficulty === d).length,
      ),
      [2, 2, 1],
    );
    for (const quotas of [
      { easy: 0, medium: 0, hard: 0 },
      { easy: 1.5, medium: 0, hard: 0 },
      { easy: 3, medium: 0, hard: 0 },
      { easy: 100, medium: 100, hard: 100 },
    ]) {
      assert.equal(
        (
          await f.request(
            "/api/questions/select",
            { candidateIds: ids, quotas },
            f.teacher,
          )
        ).statusCode,
        400,
      );
    }
    assert.equal(
      (
        await f.request(
          "/api/questions/select",
          { candidateIds: ids, quotas: { easy: 1, medium: 0, hard: 0 } },
          f.student,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.post(
          "/api/questions/select",
          { candidateIds: ids, difficulty: "hard", count: 1 },
          f.teacher,
        )
      ).questionVersionIds.length,
      1,
    );
  } finally {
    await f.close();
  }
});
