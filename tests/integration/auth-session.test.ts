import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixture } from "../helpers/fixture";

test("login validates credentials, creates a secure session, and logout revokes only that session", async () => {
  const f = await fixture();
  try {
    for (const email of ["missing@test.dev", "t@test.dev"]) {
      const response = await f.request("/api/auth/login", {
        email,
        password: "WrongPassword123!",
      });
      assert.equal(response.statusCode, 401, response.body);
      assert.equal(response.headers["set-cookie"], undefined);
    }
    const signedIn = await f.request("/api/auth/login", {
      email: "t@test.dev",
      password: "StrongPass123!",
    });
    assert.equal(signedIn.statusCode, 200, signedIn.body);
    assert.equal(signedIn.json().role, "teacher");
    assert.equal("passwordHash" in signedIn.json(), false);
    const cookieHeader = String(signedIn.headers["set-cookie"]);
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Strict/i);
    assert.match(cookieHeader, /Path=\//i);
    const token = signedIn.cookies[0].value;
    const cookie = "session=" + token;
    const hash = createHash("sha256").update(token).digest("hex");
    assert.equal(
      await f.c("sessions").countDocuments({ tokenHash: hash }),
      1,
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, cookie)).json().role,
      "teacher",
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, "session=invalid")).statusCode,
      401,
    );

    const logout = await f.request("/api/auth/logout", {}, cookie);
    assert.equal(logout.statusCode, 200, logout.body);
    assert.match(String(logout.headers["set-cookie"]), /session=;/i);
    assert.equal(
      await f.c("sessions").countDocuments({ tokenHash: hash }),
      0,
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, cookie)).statusCode,
      401,
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, f.student)).statusCode,
      200,
    );
    assert.equal(
      (await f.request("/api/auth/login", {
        email: "t@test.dev",
        password: "StrongPass123!",
      })).statusCode,
      200,
    );
  } finally {
    await f.close();
  }
});

test("missing or malformed password hashes reject login without internal errors or sessions", async () => {
  const f = await fixture();
  try {
    const user = await f.c("users").findOne({ email: "t@test.dev" });
    assert.ok(user);
    const existingSessions = await f.c("sessions").countDocuments({
      userId: user._id,
    });
    for (const malformed of ["not-a-hash", "deadbeef:zz", "ff:ab"]) {
      await f.c("users").updateOne(
        { _id: user._id },
        { $set: { passwordHash: malformed } },
      );
      const response = await f.request("/api/auth/login", {
        email: "t@test.dev",
        password: "StrongPass123!",
      });
      assert.equal(response.statusCode, 401, response.body);
      assert.equal(response.headers["set-cookie"], undefined);
    }
    await f.c("users").updateOne(
      { _id: user._id },
      { $unset: { passwordHash: "" } },
    );
    const absentHash = await f.request("/api/auth/login", {
      email: "t@test.dev",
      password: "StrongPass123!",
    });
    assert.equal(absentHash.statusCode, 401, absentHash.body);
    assert.equal(
      await f.c("sessions").countDocuments({ userId: user._id }),
      existingSessions,
    );
  } finally {
    await f.close();
  }
});
