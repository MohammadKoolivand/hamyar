import type { PasswordResetMailer } from "../../src/server/auth/reset-mail";
import type { AvalaiClient } from "../../src/server/ai/avalai";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { connect, collection } from "../../src/server/db";
import { buildApp } from "../../src/server/app";
import { MockProvider, type HintProvider } from "../../src/server/domain";
import type { QuestionGenerator } from "../../src/server/ai/question-generator";
import type { WriteHooks } from "../../src/server/transactions";
Object.assign(process.env, { NODE_ENV: "test" });
export async function fixture(
  options: {
    hooks?: WriteHooks;
    resetMailer?: PasswordResetMailer;
    avalai?: AvalaiClient;
    questionGenerator?: QuestionGenerator;
    provider?: HintProvider;
    essay?: boolean;
    maxAttempts?: number;
    maxHints?: number;
  } = {},
) {
  const { client, db } = await connect(
    process.env.TEST_MONGO_URL ??
      "mongodb://127.0.0.1:27019/?replicaSet=hamyar-rs",
    "hamyar_test_" + randomUUID(),
  );
  const app = await buildApp(
    db,
    options.provider ?? new MockProvider(),
    options.hooks,
    options.questionGenerator,
    options.avalai,
    options.resetMailer,
  );
  await app.ready();
  const request = (url: string, body?: object, cookie = "", key?: string) =>
    app.inject({
      method: body === undefined ? "GET" : "POST",
      url,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
      ...(body ? { payload: body } : {}),
    });
  const post = async (url: string, body: object, cookie = "", key?: string) => {
    const r = await request(url, body, cookie, key);
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  const login = async (email: string) => {
    const r = await request("/api/auth/login", {
      email,
      password: "StrongPass123!",
    });
    assert.equal(r.statusCode, 200, r.body);
    return "session=" + r.cookies[0].value;
  };
  await post("/api/auth/register", {
    name: "Teacher",
    email: "t@test.dev",
    password: "StrongPass123!",
  });
  const teacher = await login("t@test.dev");
  const invite = await post(
    "/api/invitations",
    { email: "s@test.dev" },
    teacher,
  );
  await post("/api/invitations/accept", {
    name: "Student",
    email: "s@test.dev",
    password: "StrongPass123!",
    token: invite.token,
  });
  const student = await login("s@test.dev");
  const students = (await request("/api/students", undefined, teacher)).json();
  const topic = await post(
    "/api/curriculum",
    { title: "Configurable Topic", kind: "topic" },
    teacher,
  );
  const question = await post(
    "/api/questions",
    {
      topicId: topic._id,
      statement: "پاسخ خود را بنویسید",
      type: options.essay ? "essay" : "numeric",
      reference: "2",
      hints: ["مفهوم مرتبط را مرور کن.", "روش خود را دوباره بررسی کن."],
    },
    teacher,
  );
  const create = () =>
    post(
      "/api/missions",
      {
        title: "Mission",
        studentId: students[0]._id,
        questionVersionIds: [question._id],
        policy: {
          maxAttempts: options.maxAttempts ?? 3,
          maxHints: options.maxHints ?? 2,
          independent: false,
        },
      },
      teacher,
    );
  const mission = await create();
  await post(`/api/missions/${mission._id}/publish`, {}, teacher);
  const a = (await collection(db, "assignments").findOne({
      missionId: mission._id,
    }))!,
    path = "/api/assignments/" + a._id;
  return {
    client,
    db,
    app,
    request,
    post,
    teacher,
    student,
    question,
    mission,
    assignment: a,
    path,
    create,
    c: (name: string) => collection(db, name),
    async close() {
      await app.close();
      await db.dropDatabase();
      await client.close();
    },
  };
}
