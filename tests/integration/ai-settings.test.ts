import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { AvalaiClient } from "../../src/server/ai/avalai";
test("teacher model persists privately and selects the actual AvalAI request; drafts still require approval", async () => {
  const selected: string[] = [];
  let fail = false;
  const avalai = new AvalaiClient(
    { apiKey: "server-key-test" },
    async (url, init) => {
      if (String(url).endsWith("/public/models"))
        return Response.json({
          data: [
            { id: "chat-a", mode: "chat" },
            { id: "chat-b", mode: "chat" },
            { id: "image-only", mode: "image" },
          ],
        });
      selected.push(JSON.parse(String(init?.body)).model);
      if (fail) return new Response("private provider error", { status: 429 });
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                statement: "دو به اضافه سه؟",
                reference: "5",
                options: [],
                hints: [],
              }),
            },
            finish_reason: "stop",
          },
        ],
      });
    },
  );
  const f = await fixture({ avalai });
  try {
    for (const path of [
      "/api/settings/authoring",
      "/api/settings/authoring/models",
    ])
      assert.equal(
        (await f.request(path, undefined, f.student)).statusCode,
        403,
      );
    assert.equal(
      (
        await f.request(
          "/api/settings/authoring",
          { model: "chat-a" },
          f.student,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/settings/authoring",
          { model: "image-only" },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    const saved = await f.post(
      "/api/settings/authoring",
      { model: "chat-a" },
      f.teacher,
    );
    assert.equal(saved.model, "chat-a");
    assert.ok(!JSON.stringify(saved).includes("server-key-test"));
    assert.equal(
      (await f.request("/api/settings/authoring", undefined, f.teacher)).json()
        .model,
      "chat-a",
    );
    const before = await f.c("questionVersions").countDocuments();
    const body = {
      topicId: f.question.topicId,
      brief: "تمرین جمع در همین مبحث",
      type: "numeric",
    };
    const draft = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
      "avalai-draft-key-1",
    );
    assert.equal(draft.model, "chat-a");
    assert.equal(draft.provider, "avalai");
    assert.equal(draft.state, "pending_review");
    await f.post("/api/settings/authoring", { model: "chat-b" }, f.teacher);
    const replay = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
      "avalai-draft-key-1",
    );
    assert.equal(replay._id, draft._id);
    assert.deepEqual(selected, ["chat-a"]);
    const next = await f.post(
      "/api/question-drafts/generate",
      body,
      f.teacher,
      "avalai-draft-key-2",
    );
    assert.equal(next.model, "chat-b");
    assert.deepEqual(selected, ["chat-a", "chat-b"]);
    assert.equal(await f.c("questionVersions").countDocuments(), before);
    fail = true;
    assert.equal(
      (
        await f.request(
          "/api/question-drafts/generate",
          body,
          f.teacher,
          "avalai-draft-key-3",
        )
      ).statusCode,
      503,
    );
    assert.equal(await f.c("questionDrafts").countDocuments(), 2);
    assert.equal(await f.c("questionVersions").countDocuments(), before);
    await f.post("/api/auth/register", {
      name: "Other",
      email: "other-model@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "other-model@test.dev",
      password: "StrongPass123!",
    });
    const other = "session=" + login.cookies[0].value;
    assert.notEqual(
      (await f.request("/api/settings/authoring", undefined, other)).json()
        .model,
      "chat-b",
    );
  } finally {
    await f.close();
  }
});
test("a model can be selected without a server key but generation stays unavailable", async () => {
  const avalai = new AvalaiClient({}, async () =>
    Response.json({ data: [{ id: "chat-a", mode: "chat" }] }),
  );
  const f = await fixture({ avalai });
  try {
    const saved = await f.post(
      "/api/settings/authoring",
      { model: "chat-a" },
      f.teacher,
    );
    assert.equal(saved.keyConfigured, false);
    assert.equal(
      (
        await f.request(
          "/api/question-drafts/generate",
          {
            topicId: f.question.topicId,
            brief: "تمرین ساده جمع",
            type: "numeric",
          },
          f.teacher,
        )
      ).statusCode,
      503,
    );
    assert.equal(await f.c("questionDrafts").countDocuments(), 0);
  } finally {
    await f.close();
  }
});
