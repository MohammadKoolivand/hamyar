import { test } from "node:test";
import assert from "node:assert/strict";
import { AvalaiClient } from "../../src/server/ai/avalai";
const input = {
  topic: "کسر",
  curriculum: ["پایه هفتم"],
  brief: "تمرین ساده کسر",
  type: "numeric" as const,
};
const content = JSON.stringify({
  statement: "حاصل دو به اضافه دو چیست؟",
  reference: "4",
  options: [],
  hints: [],
});
test("AvalAI forwards the selected model, server-only credential, bounded curriculum and usage", async () => {
  let calls = 0;
  const client = new AvalaiClient(
    { apiKey: "private-test-key", timeoutMs: 1000 },
    async (url, init) => {
      calls++;
      assert.equal(url, "https://api.avalai.ir/v1/chat/completions");
      assert.equal(init?.redirect, "error");
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer private-test-key",
      );
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.model, "selected-chat-model");
      assert.deepEqual(JSON.parse(payload.messages[1].content), input);
      assert.equal(payload.stream, false);
      return Response.json({
        choices: [
          {
            message: { content: "```json\n" + content + "\n```" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 20 },
      });
    },
  );
  const result = await client.generator("selected-chat-model").generate(input);
  assert.equal(calls, 1);
  assert.equal(result.model, "selected-chat-model");
  assert.equal(result.provider, "avalai");
  assert.equal(result.question.reference, "4");
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 20 });
  assert.ok(!JSON.stringify(result).includes("private-test-key"));
});
test("model discovery only exposes chat models and caches the live list", async () => {
  let calls = 0;
  const client = new AvalaiClient({}, async (url, init) => {
    calls++;
    assert.equal(url, "https://api.avalai.ir/public/models");
    assert.ok(!new Headers(init?.headers).has("Authorization"));
    return Response.json({
      data: [
        { id: "chat-one", mode: "chat", owned_by: "test" },
        { id: "image-one", mode: "image" },
        { id: "unknown" },
        { id: "null-mode", mode: null, owned_by: null },
        { id: "chat-one", mode: "chat" },
      ],
    });
  });
  assert.deepEqual(
    (await client.models()).map((m) => m.id),
    ["chat-one"],
  );
  await client.models();
  assert.equal(calls, 1);
});
test("missing keys, upstream failures, truncation and invalid JSON fail closed", async () => {
  let called = false;
  const missing = new AvalaiClient({}, async () => {
    called = true;
    throw new Error();
  });
  await assert.rejects(() => missing.generator("m").generate(input));
  assert.equal(called, false);
  for (const response of [
    new Response("secret upstream error", { status: 401 }),
    Response.json({
      choices: [{ message: { content }, finish_reason: "length" }],
    }),
    Response.json({ choices: [{ message: { content: "not json" } }] }),
    Response.json({
      choices: [
        { message: { content: JSON.stringify({ statement: "only partial" }) } },
      ],
    }),
    new Response("x".repeat(70000)),
  ]) {
    const client = new AvalaiClient({ apiKey: "test" }, async () => response);
    await assert.rejects(() => client.generator("m").generate(input));
  }
});

test("numeric JSON references normalize to the internal string contract without relaxing other answer types", async () => {
  const client = new AvalaiClient({ apiKey: "test" }, async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              statement: "جمع دو عدد",
              reference: 4,
              options: [],
              hints: [],
            }),
          },
          finish_reason: "stop",
        },
      ],
    }),
  );
  assert.equal(
    (await client.generator("m").generate(input)).question.reference,
    "4",
  );
  await assert.rejects(() =>
    client.generator("m").generate({ ...input, type: "essay" }),
  );
});
