import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixture } from "../helpers/fixture";
import { sessionCookieOptions } from "../../src/server/security/session";

const password = { email: "t@test.dev", password: "StrongPass123!" };

test("cookie security cannot be disabled in production", () => {
  const priorNode = process.env.NODE_ENV;
  const priorSecure = process.env.COOKIE_SECURE;
  try {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";
    assert.deepEqual(sessionCookieOptions(), {
      httpOnly: true, sameSite: "strict", secure: true,
      path: "/", maxAge: 604800,
    });
  } finally {
    if (priorNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNode;
    if (priorSecure === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = priorSecure;
  }
});

test("login replaces caller-supplied session and logout rejects replay on protected APIs", async () => {
  const f = await fixture();
  try {
    const planted = "session=" + "a".repeat(64);
    const r = await f.request("/api/auth/login", password, planted);
    assert.equal(r.statusCode, 200, r.body);
    const header = String(r.headers["set-cookie"]);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Strict/i);
    assert.match(header, /Max-Age=604800/i);
    assert.doesNotMatch(header, /Domain=/i);
    const token = r.cookies[0].value;
    assert.notEqual(token, "a".repeat(64));
    assert.notEqual("session=" + token, f.teacher);
    assert.equal((await f.request("/api/auth/me", undefined, planted)).statusCode, 401);
    const cookie = "session=" + token;
    assert.equal((await f.request("/api/access/me", undefined, cookie)).statusCode, 200);
    assert.equal((await f.request("/api/auth/logout", {}, cookie)).statusCode, 200);
    for (const path of ["/api/auth/me", "/api/access/me", "/api/assignments"]) {
      assert.equal((await f.request(path, undefined, cookie)).statusCode, 401, path);
    }
    assert.equal((await f.request("/api/auth/logout", {}, cookie)).statusCode, 200);
    assert.equal((await f.request("/api/auth/me", undefined, f.teacher)).statusCode, 200);
  } finally { await f.close(); }
});

test("expiry is server-side and stale session security revision is rejected", async () => {
  const f = await fixture();
  try {
    const r = await f.request("/api/auth/login", password);
    assert.equal(r.statusCode, 200);
    const token = r.cookies[0].value;
    const cookie = "session=" + token;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const row = await f.c("sessions").findOne({ tokenHash });
    assert.ok(row);
    assert.ok(new Date(row.expiresAt).getTime() > Date.now());
    await f.c("users").updateOne({ _id: row.userId }, { $inc: { securityRevision: 1 } });
    assert.equal((await f.request("/api/auth/me", undefined, cookie)).statusCode, 401);
    // Even if a record lingers until MongoDB TTL cleanup, its expiry is enforced.
    await f.c("sessions").updateOne({ tokenHash }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await f.request("/api/auth/me", undefined, cookie)).statusCode, 401);
  } finally { await f.close(); }
});
