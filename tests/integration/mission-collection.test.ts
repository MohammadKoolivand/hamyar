import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { MAX_MISSION_QUESTIONS } from "../../src/lib/mission-limits";

test("a complete collection above the old 30-question cap is saved and assigned intact", async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    for (let i = 0; i < 35; i++) {
      const q = await f.post(
        "/api/questions",
        {
          classification: "free",
          statement: `سؤال مجموعه شماره ${i + 1}`,
          type: "numeric",
          reference: "2",
        },
        f.teacher,
      );
      ids.push(q._id);
    }
    const body = {
      title: "مجموعه کامل ۳۵ سؤال",
      studentId: f.assignment.studentId,
      questionVersionIds: ids,
      policy: {
        maxAttempts: 1,
        maxHints: 0,
        independent: true,
        feedbackMode: "end",
      },
    };
    const mission = await f.post("/api/missions", body, f.teacher);
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    const assignment = await f
      .c("assignments")
      .findOne({ missionId: mission._id });
    assert.deepEqual(assignment?.questionVersionIds, ids);
    assert.equal(
      (
        await f.request(
          "/api/missions",
          { ...body, questionVersionIds: [...ids, ids[0]] },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.request(
          "/api/missions",
          {
            ...body,
            questionVersionIds: Array.from(
              { length: MAX_MISSION_QUESTIONS + 1 },
              () => ids[0],
            ),
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
