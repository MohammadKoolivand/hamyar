import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../src/server/app";
import { collection, connect } from "../../src/server/db";

Object.assign(process.env, { NODE_ENV: "test" });
const password = "OriginalPass123!";

test("password reset: no enumeration, one-time token, expiration and revoke all sessions", async () => {
  const { client, db } = await connect(
    process.env.TEST_MONGO_URL ?? "mongodb://127.0.0.1:27019/?replicaSet=hamyar-rs",
    "hodhod_reset_" + randomUUID(),
  );
  const sent: { email: string; token: string }[] = [];
  const app = await buildApp(db, undefined, {}, undefined, undefined, async (email, token) => {
    sent.push({ email, token });
  });
  await app.ready();
  async function post(path: string, body: unknown) {
    return app.inject({ method: "POST", url: "/api" + path, payload: body as object });
  }
  async function login(email: string, pass = password) {
    return post("/auth/login", { email, password: pass });
  }
  async function waitForMail(count: number) {
    for (let attempt = 0; sent.length < count && attempt < 100; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(sent.length, count, "Expected asynchronous reset email delivery");
  }
  try {
    const register = await post("/auth/register", {
      email: "owner@example.test", name: "Owner", password, role: "teacher",
    });
    assert.equal(register.statusCode, 200, register.body);
    await post("/auth/register", {
      email: "second@example.test", name: "Second", password, role: "student",
    });
    const session1 = await login("owner@example.test");
    const session2 = await login("owner@example.test");
    assert.equal(session1.statusCode, 200);
    assert.equal(session2.statusCode, 200);
    const cookie1 = "session=" + session1.cookies.find(x => x.name === "session")!.value;
    const cookie2 = "session=" + session2.cookies.find(x => x.name === "session")!.value;

    const unknown = await post("/auth/password-reset/request", { email: "absent@example.test" });
    const known = await post("/auth/password-reset/request", { email: "OWNER@EXAMPLE.TEST" });
    assert.equal(unknown.statusCode, 200);
    assert.equal(known.statusCode, 200);
    assert.deepEqual(unknown.json(), known.json());
    await waitForMail(1);
    assert.equal(sent[0].email, "owner@example.test");
    assert.match(sent[0].token, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(known.json()).includes(sent[0].token));

    const repeat = await post("/auth/password-reset/request", { email: "owner@example.test" });
    assert.deepEqual(repeat.json(), known.json());
    assert.equal(sent.length, 1);
    const bogus = await post("/auth/password-reset/confirm", {
      token: "a".repeat(64), password: "ChangedPass456!",
    });
    assert.equal(bogus.statusCode, 400);
    const reset = await post("/auth/password-reset/confirm", {
      token: sent[0].token, password: "ChangedPass456!",
    });
    assert.equal(reset.statusCode, 200, reset.body);
    const replay = await post("/auth/password-reset/confirm", {
      token: sent[0].token, password: "AnotherPass456!",
    });
    assert.equal(replay.statusCode, 400);
    for (const cookie of [cookie1, cookie2]) {
      const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
      assert.equal(me.statusCode, 401);
    }
    assert.equal((await login("owner@example.test")).statusCode, 401);
    assert.equal((await login("owner@example.test", "ChangedPass456!")).statusCode, 200);
    assert.equal(await collection(db, "sessions").countDocuments({
      userId: (await collection(db, "users").findOne({email:"owner@example.test"}))!._id,
    }), 1);

    await post("/auth/password-reset/request", { email: "second@example.test" });
    await waitForMail(2);
    const second = await collection(db, "users").findOne({ email: "second@example.test" });
    await collection(db, "passwordResetTokens").updateOne(
      { _id: second!._id }, { $set: { expiresAt: new Date(Date.now()-1000) } },
    );
    assert.equal((await post("/auth/password-reset/confirm", {
      token: sent[1].token, password: "ExpiredPass987!",
    })).statusCode, 400);
    assert.equal((await login("second@example.test")).statusCode, 200);
    assert.equal((await post("/auth/password-reset/request", { email: "not-email" })).statusCode, 400);
  } finally {
    await app.close();
    await db.dropDatabase();
    await client.close();
  }
});


test("password reset replies before slow SMTP completes, for an existing or missing account", async () => {
  const { client, db } = await connect(
    process.env.TEST_MONGO_URL ?? "mongodb://127.0.0.1:27019/?replicaSet=hamyar-rs",
    "hodhod_reset_async_" + randomUUID(),
  );
  let releaseMail: () => void = () => {};
  let beganMail: () => void = () => {};
  const mailStarted = new Promise<void>((resolve) => { beganMail = resolve; });
  const mailBlock = new Promise<void>((resolve) => { releaseMail = resolve; });
  const delivered: string[] = [];
  const app = await buildApp(db, undefined, {}, undefined, undefined, async (email) => {
    beganMail();
    await mailBlock;
    delivered.push(email);
  });
  await app.ready();
  try {
    const register = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { email: "async@example.test", name: "Async account", password },
    });
    assert.equal(register.statusCode, 200, register.body);
    const unknown = await app.inject({
      method: "POST", url: "/api/auth/password-reset/request",
      payload: { email: "nonexistent@example.test" },
    });
    // This must resolve before the deliberately blocked mailer finishes.
    const knownRequest = app.inject({
      method: "POST", url: "/api/auth/password-reset/request",
      payload: { email: "async@example.test" },
    });
    const known = await Promise.race([
      knownRequest,
      new Promise<never>((_, reject) => setTimeout(
        () => reject(new Error("Reset HTTP response blocked by SMTP delivery")), 12000,
      )),
    ]);
    assert.equal(known.statusCode, 200, known.body);
    assert.deepEqual(known.json(), unknown.json());
    await Promise.race([
      mailStarted,
      new Promise<never>((_, reject) => setTimeout(
        () => reject(new Error("Queued reset mail was not started")), 12000,
      )),
    ]);
    assert.deepEqual(delivered, []);
    releaseMail();
  } finally {
    releaseMail();
    await app.close();
    assert.deepEqual(delivered, ["async@example.test"]);
    await db.dropDatabase();
    await client.close();
  }
});

test("failed password reset delivery invalidates its token without exposing the account", async () => {
  const { client, db } = await connect(
    process.env.TEST_MONGO_URL ?? "mongodb://127.0.0.1:27019/?replicaSet=hamyar-rs",
    "reset_fail_" + randomUUID(),
  );
  const app = await buildApp(db, undefined, {}, undefined, undefined, async () => {
    throw new Error("Simulated SMTP outage");
  });
  await app.ready();
  try {
    const registration = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { email: "failing@example.test", name: "SMTP test", password },
    });
    assert.equal(registration.statusCode, 200, registration.body);
    const unknown = await app.inject({
      method: "POST", url: "/api/auth/password-reset/request",
      payload: { email: "absent@example.test" },
    });
    const known = await app.inject({
      method: "POST", url: "/api/auth/password-reset/request",
      payload: { email: "failing@example.test" },
    });
    assert.deepEqual(known.json(), unknown.json());
  } finally {
    await app.close(); // graceful shutdown waits for the queued send and cleanup
    assert.equal(await collection(db, "passwordResetTokens").countDocuments(), 0);
    await db.dropDatabase();
    await client.close();
  }
});
