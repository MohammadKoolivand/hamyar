import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { MelipayamakProvider } from "../../src/server/auth/sms";
process.env.AUTH_OTP_SECRET = Buffer.alloc(32, 19).toString("base64");

test("phone OTP: verified signup/login, single use, cooldown, five wrong guesses, expiration and role boundaries", async () => {
  const sent: { phone: string; code: string }[] = [];
  const f = await fixture({
    sms: {
      name: "controlled_sms",
      configured: () => true,
      sendOtp: async (phone, code) => {
        sent.push({ phone, code });
      },
    },
  });
  try {
    const first = await f.post("/api/auth/otp/request", {
      phone: "+۹۸۹۱۲۳۴۵۶۷۸۹",
    });
    assert.equal(sent[0].phone, "09123456789");
    assert.match(sent[0].code, /^\d{6}$/);
    const challenge = await f.c("otpChallenges").findOne({});
    assert.ok(!JSON.stringify(challenge).includes(sent[0].code));
    assert.ok(!JSON.stringify(first).includes(sent[0].code));
    assert.equal(
      (await f.request("/api/auth/otp/request", { phone: "09123456789" }))
        .statusCode,
      429,
    );
    const verify = {
      phone: "09123456789",
      challengeId: first.challengeId,
      code: sent[0].code,
      name: "معلم آزمایشی",
      role: "teacher",
    };
    assert.equal(
      (
        await f.request("/api/auth/otp/verify", {
          ...verify,
          role: "super_admin",
        })
      ).statusCode,
      400,
    );
    const results = await Promise.all([
      f.request("/api/auth/otp/verify", verify),
      f.request("/api/auth/otp/verify", verify),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 400]);
    const logged = results.find((r) => r.statusCode === 200)!;
    assert.equal(logged.json().phoneVerified, true);
    assert.equal(logged.json().role, "teacher");
    assert.equal(logged.cookies[0].httpOnly, true);
    const cookie = "session=" + logged.cookies[0].value;
    assert.equal(
      (await f.request("/api/auth/me", undefined, cookie)).statusCode,
      200,
    );
    assert.equal(
      (await f.request("/api/auth/otp/verify", verify)).statusCode,
      400,
    );
    await f.c("otpThrottle").deleteMany({});
    const second = await f.post("/api/auth/otp/request", {
      phone: "09123456789",
    });
    const incorrect = sent[1].code === "111111" ? "222222" : "111111";
    for (let n = 0; n < 5; n++)
      assert.equal(
        (
          await f.request("/api/auth/otp/verify", {
            phone: verify.phone,
            challengeId: second.challengeId,
            code: incorrect,
          })
        ).statusCode,
        400,
      );
    assert.equal(
      (
        await f.request("/api/auth/otp/verify", {
          phone: verify.phone,
          challengeId: second.challengeId,
          code: sent[1].code,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (await f.c("otpChallenges").findOne({ challengeId: second.challengeId }))!
        .attempts,
      5,
    );
    await f.c("otpThrottle").deleteMany({});
    const third = await f.post("/api/auth/otp/request", {
      phone: verify.phone,
    });
    await f
      .c("otpChallenges")
      .updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal(
      (
        await f.request("/api/auth/otp/verify", {
          phone: verify.phone,
          challengeId: third.challengeId,
          code: sent[2].code,
        })
      ).statusCode,
      400,
    );
    assert.equal(await f.c("users").countDocuments({ phone: verify.phone }), 1);
  } finally {
    await f.close();
  }
});

test("OTP has no fake production success when SMS is absent or fails", async () => {
  const f = await fixture({
    sms: {
      name: "unavailable",
      configured: () => false,
      sendOtp: async () => {
        throw new Error("must not run");
      },
    },
  });
  try {
    assert.equal(
      (await f.request("/api/auth/otp/request", { phone: "09123456789" }))
        .statusCode,
      503,
    );
    assert.equal(await f.c("otpChallenges").countDocuments(), 0);
  } finally {
    await f.close();
  }
  const g = await fixture({
    sms: {
      name: "failing",
      configured: () => true,
      sendOtp: async () => {
        throw new Error("private provider error");
      },
    },
  });
  try {
    const result = await g.request("/api/auth/otp/request", {
      phone: "09123456789",
    });
    assert.equal(result.statusCode, 503);
    assert.ok(!result.body.includes("private provider"));
    assert.equal(await g.c("otpChallenges").countDocuments(), 0);
  } finally {
    await g.close();
  }
});

test("Melipayamak adapter sends approved pattern over HTTPS and validates acceptance (controlled HTTP)", async () => {
  const saved = {
    MELIPAYAMAK_USERNAME: process.env.MELIPAYAMAK_USERNAME,
    MELIPAYAMAK_PASSWORD: process.env.MELIPAYAMAK_PASSWORD,
    MELIPAYAMAK_OTP_BODY_ID: process.env.MELIPAYAMAK_OTP_BODY_ID,
  };
  Object.assign(process.env, {
    MELIPAYAMAK_USERNAME: "fixture",
    MELIPAYAMAK_PASSWORD: "fixture",
    MELIPAYAMAK_OTP_BODY_ID: "123",
  });
  try {
    const provider = new MelipayamakProvider(async (input, options) => {
      assert.equal(
        String(input),
        "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber",
      );
      assert.equal(options!.method, "POST");
      const body = options!.body as URLSearchParams;
      assert.equal(body.get("to"), "09123456789");
      assert.equal(body.get("text"), "123456");
      assert.equal(body.get("bodyId"), "123");
      return Response.json({ RetStatus: 1, Value: "123456789012345" });
    });
    await provider.sendOtp("09123456789", "123456");
    await assert.rejects(
      new MelipayamakProvider(async () =>
        Response.json({ RetStatus: 1, Value: "-1" }),
      ).sendOtp("09123456789", "123456"),
    );
    await assert.rejects(
      new MelipayamakProvider(async () => {
        throw new Error("timeout");
      }).sendOtp("09123456789", "123456"),
    );
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("OTP invitation binds the verified phone to parent scope; disabled accounts stay denied", async () => {
  let code = "";
  const f = await fixture({
    sms: {
      name: "controlled_sms",
      configured: () => true,
      sendOtp: async (_phone, value) => {
        code = value;
      },
    },
  });
  try {
    const student = (
      await f.request("/api/auth/me", undefined, f.student)
    ).json();
    const inv = await f.post(
      "/api/invitations",
      { phone: "09135556677", role: "parent", studentId: student._id },
      f.teacher,
    );
    const challenge = await f.post("/api/auth/otp/request", {
      phone: "09135556677",
    });
    const parent = await f.request("/api/auth/otp/verify", {
      phone: "09135556677",
      challengeId: challenge.challengeId,
      code,
      name: "ولی آزمایشی",
      invitationToken: inv.token,
    });
    assert.equal(parent.statusCode, 200, parent.body);
    assert.equal(parent.json().role, "parent");
    const cookie = "session=" + parent.cookies[0].value;
    assert.equal(
      (await f.request("/api/children", undefined, cookie)).json().length,
      1,
    );
    assert.equal(
      (await f.request("/api/questions", undefined, cookie)).statusCode,
      403,
    );
    await f
      .c("users")
      .updateOne(
        { _id: parent.json()._id },
        { $set: { disabledAt: new Date().toISOString() } },
      );
    await f.c("otpThrottle").deleteMany({});
    const next = await f.post("/api/auth/otp/request", {
      phone: "09135556677",
    });
    assert.equal(
      (
        await f.request("/api/auth/otp/verify", {
          phone: "09135556677",
          challengeId: next.challengeId,
          code,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, cookie)).statusCode,
      401,
    );
  } finally {
    await f.close();
  }
});

test("OTP challenge and throttle collections have TTL cleanup indexes", async () => {
  const f = await fixture();
  try {
    for (const name of ["otpChallenges", "otpThrottle"]) {
      const indexes = await f.db
        .collection(name)
        .listIndexes()
        .toArray()
        .catch((error: { code?: number }) => {
          if (error.code === 26) return [];
          throw error;
        });
      assert.ok(
        indexes.some(
          (index) =>
            index.key.expiresAt === 1 && index.expireAfterSeconds === 0,
        ),
        `${name} must expire temporary authentication data`,
      );
    }
  } finally {
    await f.close();
  }
});
