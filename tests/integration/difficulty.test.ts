import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

test("difficulty metadata, bulk edits and exact 20-question selection are persisted and scoped", async () => {
  const f = await fixture();
  try {
    const questions = [];
    for (let i = 0; i < 20; i++)
      questions.push(
        await f.post(
          "/api/questions",
          {
            statement: `سؤال مستقل شماره ${i + 1} را حل کنید`,
            classification: "free",
            type: "numeric",
            reference: "2",
            difficulty: "hard",
          },
          f.teacher,
        ),
      );
    const ids = questions.map((q) => q._id);
    assert.equal(questions[0].difficultyAssessment.method, "teacher_selected");
    const selection = await f.post(
      "/api/questions/select",
      { candidateIds: ids, difficulty: "hard", count: 20 },
      f.teacher,
    );
    assert.equal(new Set(selection.questionVersionIds).size, 20);
    assert.deepEqual([...selection.questionVersionIds].sort(), [...ids].sort());
    assert.equal(
      (
        await f.request(
          "/api/questions/select",
          { candidateIds: ids, difficulty: "hard", count: 21 },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.request(
          "/api/questions/select",
          { candidateIds: ids, difficulty: "hard", count: 20 },
          f.student,
        )
      ).statusCode,
      403,
    );
    const student = (
      await f.request("/api/students", undefined, f.teacher)
    ).json()[0];
    const mission = await f.post(
      "/api/missions",
      {
        title: "تمرین ۲۰ سوالی سخت",
        studentId: student._id,
        questionVersionIds: selection.questionVersionIds,
        policy: { maxAttempts: 3, maxHints: 2, independent: false },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    assert.equal(
      (await f.db
        .collection("assignments")
        .findOne({ missionId: mission._id }))!.questionVersionIds.length,
      20,
    );
    const changed = await f.post(
      "/api/questions/difficulty-batch",
      { questionVersionIds: ids.slice(0, 4), difficulty: "easy" },
      f.teacher,
    );
    assert.equal(changed.updated, 4);
    assert.equal(
      (
        await f.request(
          "/api/questions/select",
          { candidateIds: ids, difficulty: "hard", count: 20 },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.post(
          "/api/questions/select",
          { candidateIds: ids, difficulty: "easy", count: 4 },
          f.teacher,
        )
      ).questionVersionIds.length,
      4,
    );
    const inferred = await f.post(
      "/api/questions",
      {
        statement: "برای چه مقدار پارامتر تابع وارون با ریشه مضاعف سازگار است؟",
        classification: "free",
        type: "numeric",
        reference: "2",
      },
      f.teacher,
    );
    assert.equal(inferred.difficulty, "hard");
    assert.equal(inferred.difficultyAssessment.needsReview, true);
    const foreignId = crypto.randomUUID();
    await f.db.collection("questionVersions").insertOne({
      _id: foreignId as never,
      ownerId: crypto.randomUUID(),
      difficulty: "medium",
    });
    assert.equal(
      (
        await f.request(
          "/api/questions/difficulty-batch",
          { questionVersionIds: [ids[0], foreignId], difficulty: "hard" },
          f.teacher,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (await f.db.collection("questionVersions").findOne({ _id: ids[0] }))!
        .difficulty,
      "easy",
    );
  } finally {
    await f.close();
  }
});
