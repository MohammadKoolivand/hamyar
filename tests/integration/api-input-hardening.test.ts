import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

// Integration tests require the project's test MongoDB replica set.
test("API rejects Mongo operator injection at every nesting level", async () => {
  const f = await fixture();
  try {
    const cases = [
      { email: { $ne: null }, password: "StrongPass123!" },
      { email: "t@test.dev", password: { $gt: "" } },
      { email: "t@test.dev", password: "StrongPass123!", filter: { $where: "true" } },
      JSON.parse('{"email":"t@test.dev","password":"StrongPass123!","__proto__":{"admin":true}}'),
      JSON.parse('{"email":"t@test.dev","password":"StrongPass123!","profile.role":"admin"}'),
    ];
    for (const payload of cases) {
      const res = await f.request("/api/auth/login", payload);
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
    }
    assert.equal((await f.request("/api/auth/me", undefined, f.teacher)).statusCode, 200);
  } finally { await f.close(); }
});

test("API rejects unknown search filters, operator keys and malformed query types", async () => {
  const f = await fixture();
  try {
    for (const url of [
      "/api/courses?sort=%24where",
      "/api/courses?filter%5B%24ne%5D=x",
      "/api/courses?unknown=1",
      "/api/courses?sort=one&sort=two",
      "/api/courses?%24where=true",
    ]) {
      const res = await f.request(url, undefined, f.teacher);
      assert.equal(res.statusCode, 400, url);
    }
    assert.equal((await f.request("/api/courses", undefined, f.teacher)).statusCode, 200);
  } finally { await f.close(); }
});

test("API rejects malformed content and oversized or unexpected objects", async () => {
  const f = await fixture();
  try {
    const malformed = [
      { title: { $ne: "" }, subject: "Math" },
      { title: ["Math"], subject: "Math" },
      { title: "Math", subject: "Math", extra: { constructor: "malicious" } },
      { title: "x".repeat(16001), subject: "Math" },
    ];
    for (const payload of malformed) {
      const res = await f.request("/api/courses", payload, f.teacher);
      assert.equal(res.statusCode, 400, JSON.stringify(Object.keys(payload)));
    }
  } finally { await f.close(); }
});
