import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import { bootstrapSuperadmin } from "../../src/server/access-bootstrap";

process.env.AUTH_OTP_SECRET = Buffer.alloc(32, 11).toString("base64");

test("admin-provisioned mobile-only user signs in by OTP without email or password", async () => {
  let sentCode = "";
  const f = await fixture({
    sms: {
      name: "controlled_sms",
      configured: () => true,
      sendOtp: async (_phone, code) => { sentCode = code; },
    },
  });
  try {
    await bootstrapSuperadmin(createContext(f.db), {
      name: "Admin fixture", email: "admin@fixture.test", password: "AdminStrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "admin@fixture.test", password: "AdminStrongPass123!",
    });
    assert.equal(login.statusCode, 200, login.body);
    const admin = "session=" + login.cookies[0].value;
    const created = await f.post("/api/admin/users", {
      name: "منشی با موبایل", phone: "09000000121", role: "secretary",
    }, admin);
    assert.equal(created.phone, "09000000121");
    assert.equal(created.role, "secretary");
    const stored = await f.c("users").findOne({ phone: "09000000121" });
    assert.ok(stored);
    assert.equal(stored.passwordHash, undefined);
    assert.equal(stored.email, undefined);
    assert.equal(stored.phoneVerified, false);
    const otp = await f.post("/api/auth/otp/request", { phone: "09000000121" });
    assert.match(sentCode, /^\d{6}$/);
    const verified = await f.request("/api/auth/otp/verify", {
      phone: "09000000121", challengeId: otp.challengeId, code: sentCode,
    });
    assert.equal(verified.statusCode, 200, verified.body);
    assert.equal(verified.json().role, "secretary");
    assert.equal(verified.json().phoneVerified, true);
    const denied = await f.request("/api/admin/users", undefined,
      "session=" + verified.cookies[0].value);
    assert.equal(denied.statusCode, 403);
    const again = await f.request("/api/admin/users", {
      name: "Duplicate", phone: "09000000121", role: "secretary",
    }, admin);
    assert.equal(again.statusCode, 409);
  } finally { await f.close(); }
});
