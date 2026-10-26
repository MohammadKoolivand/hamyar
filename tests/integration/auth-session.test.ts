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
    assert.equal(await f.c("sessions").countDocuments({ tokenHash: hash }), 1);
    assert.equal(
      (await f.request("/api/auth/me", undefined, cookie)).json().role,
      "teacher",
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, "session=invalid"))
        .statusCode,
      401,
    );

    const logout = await f.request("/api/auth/logout", {}, cookie);
    assert.equal(logout.statusCode, 200, logout.body);
    assert.match(String(logout.headers["set-cookie"]), /session=;/i);
    assert.equal(await f.c("sessions").countDocuments({ tokenHash: hash }), 0);
    assert.equal(
      (await f.request("/api/auth/me", undefined, cookie)).statusCode,
      401,
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, f.student)).statusCode,
      200,
    );
    assert.equal(
      (
        await f.request("/api/auth/login", {
          email: "t@test.dev",
          password: "StrongPass123!",
        })
      ).statusCode,
      200,
    );
    const previousSecure = process.env.COOKIE_SECURE;
    try {
      process.env.COOKIE_SECURE = "true";
      const secureLogin = await f.request(
        "/api/auth/login",
        { email: "t@test.dev", password: "StrongPass123!" },
        f.teacher,
      );
      assert.equal(secureLogin.statusCode, 200);
      assert.match(
        String(secureLogin.headers["set-cookie"]),
        /; Secure(?:;|$)/i,
      );
      assert.notEqual("session=" + secureLogin.cookies[0].value, f.teacher);
    } finally {
      if (previousSecure === undefined) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = previousSecure;
    }
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
      await f
        .c("users")
        .updateOne({ _id: user._id }, { $set: { passwordHash: malformed } });
      const response = await f.request("/api/auth/login", {
        email: "t@test.dev",
        password: "StrongPass123!",
      });
      assert.equal(response.statusCode, 401, response.body);
      assert.equal(response.headers["set-cookie"], undefined);
    }
    await f
      .c("users")
      .updateOne({ _id: user._id }, { $unset: { passwordHash: "" } });
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

test("a login verified before password reset cannot resurrect an old-password session", async () => {
  let pause = false;
  let resume!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((r) => {
    resume = r;
  });
  const ready = new Promise<void>((r) => {
    reached = r;
  });
  let resetToken = "";
  const f = await fixture({
    hooks: {
      boundary: async (name) => {
        if (pause && name === "after_login_credentials_verified") {
          reached();
          await gate;
        }
      },
    },
    resetMailer: async (_email, token) => {
      resetToken = token;
    },
  });
  try {
    pause = true;
    const pending = f.request("/api/auth/login", {
      email: "t@test.dev",
      password: "StrongPass123!",
    });
    const login = pending.then((r) => r); // start inject before waiting at the boundary
    await Promise.race([
      ready,
      new Promise((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("login boundary not reached")),
          5000,
        );
        timer.unref();
      }),
    ]);
    await f.post("/api/auth/password-reset/request", { email: "t@test.dev" });
    for (let i = 0; i < 100 && !resetToken; i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(resetToken.length, 64);
    await f.post("/api/auth/password-reset/confirm", {
      token: resetToken,
      password: "ChangedStrong456!",
    });
    resume();
    const response = await login;
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers["set-cookie"], undefined);
    const teacher = await f.c("users").findOne({ email: "t@test.dev" });
    assert.equal(
      await f.c("sessions").countDocuments({ userId: teacher!._id }),
      0,
    );
  } finally {
    resume();
    await f.close();
  }
});

test("authentication rate limit rejects excess attempts while Origin and expired sessions fail closed", async () => {
  const f = await fixture();
  try {
    const limit = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);
    // Login is per authenticated user after a valid cookie; use a separate anonymous source IP.
    for (let i = 0; i < limit; i++) {
      const response = await f.app.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: "198.51.100.20",
        payload: { email: "missing@test.dev", password: "WrongPassword123!" },
      });
      assert.equal(response.statusCode, 401);
    }
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/auth/login",
          remoteAddress: "198.51.100.20",
          payload: { email: "missing@test.dev", password: "WrongPassword123!" },
        })
      ).statusCode,
      429,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { cookie: f.teacher, origin: "https://evil.invalid" },
          payload: {},
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { cookie: f.teacher, "sec-fetch-site": "cross-site" },
          payload: {},
        })
      ).statusCode,
      403,
    );
    await f.c("sessions").updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal(
      (await f.request("/api/auth/me", undefined, f.teacher)).statusCode,
      401,
    );
  } finally {
    await f.close();
  }
});
