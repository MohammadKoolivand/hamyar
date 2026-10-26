import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import { deliverNextMail } from "../../src/server/auth/mail-outbox";

test("email ownership: generic requests, encrypted delivery, one-use confirmation, session revocation, verified reset and secure change", async () => {
  const saved = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    APP_ORIGIN: process.env.APP_ORIGIN,
  };
  Object.assign(process.env, {
    SMTP_HOST: "smtp.invalid",
    SMTP_USER: "fixture",
    SMTP_PASSWORD: "fixture",
    SMTP_FROM: "fixture@example.test",
    APP_ORIGIN: "http://127.0.0.1:5174",
  });
  const f = await fixture();
  const ctx = createContext(f.db);
  let token = "";
  try {
    const me = await f.request("/api/auth/me", undefined, f.teacher);
    assert.equal(me.json().emailVerified, false);
    await f.post("/api/auth/password-reset/request", { email: "t@test.dev" });
    assert.equal(
      await f.c("passwordResetTokens").countDocuments(),
      0,
      "Unverified address cannot recover account",
    );
    const unknown = await f.post("/api/auth/email-verification/request", {
      email: "absent@test.dev",
    });
    const known = await f.post("/api/auth/email-verification/request", {
      email: "t@test.dev",
    });
    assert.deepEqual(known, unknown);
    await f.post("/api/auth/email-verification/request", {
      email: "t@test.dev",
    });
    assert.equal(
      await f.c("mailOutbox").countDocuments(),
      1,
      "resend throttled",
    );
    await deliverNextMail(ctx, async (to, value, purpose) => {
      assert.equal(to, "t@test.dev");
      assert.equal(purpose, "email_verification");
      token = value;
    });
    assert.equal(token.length, 64);
    await f.post("/api/auth/email-verification/confirm", { token });
    assert.equal(
      (await f.request("/api/auth/email-verification/confirm", { token }))
        .statusCode,
      400,
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, f.teacher)).statusCode,
      401,
    );
    const user = await f.c("users").findOne({ email: "t@test.dev" });
    assert.equal(user!.emailVerified, true);
    const login = await f.request("/api/auth/login", {
      email: "t@test.dev",
      password: "StrongPass123!",
    });
    const cookie = "session=" + login.cookies[0].value;
    assert.equal(
      (
        await f.request(
          "/api/auth/email/change",
          { email: "new@test.dev", password: "WrongPass123!" },
          cookie,
        )
      ).statusCode,
      401,
    );
    await f.c("emailVerificationThrottle").deleteMany({});
    await f.post(
      "/api/auth/email/change",
      { email: "new@test.dev", password: "StrongPass123!" },
      cookie,
    );
    assert.equal(
      (await f.c("users").findOne({ _id: user!._id }))!.email,
      "t@test.dev",
      "pending change cannot replace email",
    );
    await deliverNextMail(ctx, async (to, value) => {
      assert.equal(to, "new@test.dev");
      token = value;
    });
    await f.post("/api/auth/email-verification/confirm", { token });
    assert.equal(
      (await f.c("users").findOne({ _id: user!._id }))!.email,
      "new@test.dev",
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, cookie)).statusCode,
      401,
    );
    await f.c("emailVerificationThrottle").deleteMany({});
    // Expired token never verifies ownership.
    await f.post("/api/auth/email-verification/request", {
      email: "s@test.dev",
    });
    await deliverNextMail(ctx, async (_to, value) => {
      token = value;
    });
    await f
      .c("emailVerificationTokens")
      .updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal(
      (await f.request("/api/auth/email-verification/confirm", { token }))
        .statusCode,
      400,
    );
  } finally {
    await f.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("a login checked before email verification cannot recreate a revoked session", async () => {
  const saved = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    APP_ORIGIN: process.env.APP_ORIGIN,
  };
  Object.assign(process.env, {
    SMTP_HOST: "smtp.invalid",
    SMTP_USER: "fixture",
    SMTP_PASSWORD: "fixture",
    SMTP_FROM: "fixture@example.test",
    APP_ORIGIN: "http://127.0.0.1:5174",
  });
  let paused = false;
  let reached: () => void = () => {};
  let resume: () => void = () => {};
  const gate = new Promise<void>((r) => {
    resume = r;
  });
  const ready = new Promise<void>((r) => {
    reached = r;
  });
  const f = await fixture({
    hooks: {
      boundary: async (name) => {
        if (paused && name === "after_login_credentials_verified") {
          reached();
          await gate;
        }
      },
    },
  });
  try {
    await f.post("/api/auth/email-verification/request", {
      email: "t@test.dev",
    });
    let token = "";
    await deliverNextMail(createContext(f.db), async (_to, value) => {
      token = value;
    });
    paused = true;
    const login = f
      .request("/api/auth/login", {
        email: "t@test.dev",
        password: "StrongPass123!",
      })
      .then((r) => r);
    await ready;
    await f.post("/api/auth/email-verification/confirm", { token });
    resume();
    assert.equal((await login).statusCode, 401);
    const user = await f.c("users").findOne({ email: "t@test.dev" });
    assert.equal(
      await f.c("sessions").countDocuments({ userId: user!._id }),
      0,
    );
  } finally {
    resume();
    await f.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
