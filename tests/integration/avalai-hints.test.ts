import { test } from "node:test";
import assert from "node:assert/strict";
import { AvalaiClient } from "../../src/server/ai/avalai";
import { fixture } from "../helpers/fixture";
test("AvvalAI hints use the teacher model, record usage and never charge quota on provider failure", async () => {
  let fail = false;
  const seen: string[] = [];
  const f = await fixture({
    avalai: new AvalaiClient({ apiKey: "test-key" }, async (url, init) => {
      if (String(url).endsWith("/public/models"))
        return Response.json({ data: [{ id: "teacher-chat", mode: "chat" }] });
      const body = JSON.parse(String(init?.body));
      seen.push(body.model);
      const context = JSON.parse(body.messages[1].content);
      assert.equal(context.allowedLevel, fail ? 2 : 1);
      assert.equal("reference" in context, false);
      if (fail) return new Response("unavailable", { status: 503 });
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({ hintIndex: 0, focus: "start" }),
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 9 },
      });
    }),
  });
  try {
    await f.post(
      "/api/settings/authoring",
      { model: "teacher-chat" },
      f.teacher,
    );
    const hint = await f.post(
      f.path + "/hints",
      { questionId: f.question._id, expectedHintLevel: 1 },
      f.student,
    );
    assert.equal(hint.provider, "avalai");
    assert.equal(hint.model, "teacher-chat");
    assert.deepEqual(seen, ["teacher-chat"]);
    const request = await f
      .c("aiRequests")
      .findOne({ questionVersionId: f.question._id });
    assert.deepEqual(request!.usage, { inputTokens: 12, outputTokens: 9 });
    fail = true;
    assert.equal(
      (
        await f.request(
          f.path + "/hints",
          { questionId: f.question._id, expectedHintLevel: 2 },
          f.student,
        )
      ).statusCode,
      503,
    );
    const current = await f.c("assignments").findOne({ _id: f.assignment._id });
    assert.equal(current!.progress[f.question._id].hints, 1);
  } finally {
    await f.close();
  }
});
