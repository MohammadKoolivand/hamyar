import { test } from "node:test";
import assert from "node:assert/strict";
import { MelipayamakProvider } from "../../src/server/auth/sms";
const keys = [
  "MELIPAYAMAK_SHARED_ENDPOINT",
  "MELIPAYAMAK_OTP_BODY_ID",
  "MELIPAYAMAK_USERNAME",
  "MELIPAYAMAK_PASSWORD",
] as const;
test("token SMS adapter sends the one-variable pattern and requires a positive receipt", async () => {
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const endpoint =
    "https://console.melipayamak.com/api/send/shared/private-fixture-token";
  Object.assign(process.env, {
    MELIPAYAMAK_SHARED_ENDPOINT: endpoint,
    MELIPAYAMAK_OTP_BODY_ID: "573237",
  });
  delete process.env.MELIPAYAMAK_USERNAME;
  delete process.env.MELIPAYAMAK_PASSWORD;
  try {
    const provider = new MelipayamakProvider(async (url, options) => {
      assert.equal(url, endpoint);
      assert.equal(options?.redirect, "error");
      assert.equal(options?.method, "POST");
      assert.deepEqual(JSON.parse(String(options?.body)), {
        bodyId: 573237,
        to: "09123456789",
        args: ["123456"],
      });
      return Response.json({ recId: "9876543210", status: "ارسال موفق" });
    });
    assert.equal(provider.configured(), true);
    await provider.sendOtp("+989123456789", "123456");
    for (const payload of [
      {},
      null,
      { recId: "-1" },
      { recId: "0" },
      { recId: "invalid" },
      { recId: "123", RetStatus: 0 },
    ]) {
      await assert.rejects(
        new MelipayamakProvider(async () => Response.json(payload)).sendOtp(
          "09123456789",
          "123456",
        ),
        /^Error: SMS delivery failed$/,
      );
    }
    for (const transport of [
      async () => new Response("bad", { status: 502 }),
      async () => new Response("not JSON"),
      async () => {
        throw Error(endpoint);
      },
    ]) {
      await assert.rejects(
        new MelipayamakProvider(transport).sendOtp("09123456789", "123456"),
        /^Error: SMS delivery failed$/,
      );
    }
    for (const bad of [
      "http://console.melipayamak.com/api/send/shared/token",
      "https://evil.test/api/send/shared/token",
      endpoint + "?key=x",
      "https://console.melipayamak.com.evil.test/api/send/shared/token",
      "https://user:pass@console.melipayamak.com/api/send/shared/token",
    ]) {
      process.env.MELIPAYAMAK_SHARED_ENDPOINT = bad;
      assert.equal(provider.configured(), false);
    }
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
