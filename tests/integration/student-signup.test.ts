import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixture } from "../helpers/fixture";

test("independent student signs up without teacher, then claims email-bound invitations using the same account", async () => {
  const f = await fixture();
  const email = "independent@test.dev";
  const password = "StrongPass123!";
  try {
    const registration = await f.request("/api/auth/register", {
      name: "Independent Student",
      email: email.toUpperCase(),
      password,
      role: "student",
    });
    assert.equal(registration.statusCode, 200, registration.body);

    const duplicate = await f.request("/api/auth/register", {
      name: "Duplicate Student",
      email,
      password,
      role: "teacher",
    });
    assert.equal(duplicate.statusCode, 409);
    for (const role of ["admin", "parent", "super_admin"]) {
      const response = await f.request("/api/auth/register", {
        name: "Invalid Role",
        email: `invalid-${role}@test.dev`,
        password,
        role,
      });
      assert.equal(response.statusCode, 400, response.body);
    }
    const login = await f.request("/api/auth/login", { email, password });
    assert.equal(login.statusCode, 200, login.body);
    assert.equal(login.json().role, "student");
    const studentId = login.json()._id;
    const cookie = "session=" + login.cookies[0].value;

    const originalRelations = await f.c("relations").countDocuments({ studentId });
    assert.equal(originalRelations, 0);
    const assignments = await f.request("/api/assignments", undefined, cookie);
    assert.equal(assignments.statusCode, 200, assignments.body);
    assert.deepEqual(assignments.json(), []);
    assert.equal((await f.request("/api/students/" + studentId + "/progress", undefined, cookie)).statusCode, 200);
    assert.equal((await f.request("/api/students", undefined, cookie)).statusCode, 403);
    assert.equal(
      (await f.request("/api/invitations", { email: "another@test.dev" }, cookie)).statusCode,
      403,
    );

    const invitation = await f.post("/api/invitations", { email }, f.teacher);
    const wrongStudent = await f.request("/api/invitations/claim", { token: invitation.token }, f.student);
    assert.equal(wrongStudent.statusCode, 400);
    const wrongRole = await f.request("/api/invitations/claim", { token: invitation.token }, f.teacher);
    assert.equal(wrongRole.statusCode, 403);
    assert.equal(
      (await f.c("invitations").findOne({ tokenHash: createHash("sha256").update(invitation.token).digest("hex") }))?.usedAt,
      null,
    );

    const joined = await f.request("/api/invitations/claim", { token: invitation.token }, cookie);
    assert.equal(joined.statusCode, 200, joined.body);
    assert.equal(
      (await f.request("/api/invitations/claim", { token: invitation.token }, cookie)).statusCode,
      400,
    );
    assert.equal(await f.c("users").countDocuments({ email }), 1);
    assert.equal(await f.c("relations").countDocuments({ studentId, teacherId: (await f.c("users").findOne({ email: "t@test.dev" }))!._id }), 1);
    assert.equal((await f.request("/api/students", undefined, f.teacher)).json().some((u) => u._id === studentId), true);

    // A second teacher must be able to link the same existing account without
    // sharing the first teacher's content or creating a duplicate student.
    await f.post("/api/auth/register", {
      name: "Teacher Two", email: "teacher-two@test.dev", password, role: "teacher",
    });
    const t2login = await f.request("/api/auth/login", { email: "teacher-two@test.dev", password });
    const secondTeacher = "session=" + t2login.cookies[0].value;
    const secondInvite = await f.post("/api/invitations", { email }, secondTeacher);
    assert.equal(
      (await f.request("/api/invitations/claim", { token: secondInvite.token }, cookie)).statusCode, 200,
    );
    assert.equal(await f.c("relations").countDocuments({ studentId }), 2);
    assert.equal(await f.c("users").countDocuments({ email }), 1);
    assert.equal((await f.request("/api/students", undefined, secondTeacher)).json().length, 1);

    const expired = await f.post("/api/invitations", { email }, f.teacher);
    await f.c("invitations").updateOne(
      { tokenHash: createHash("sha256").update(expired.token).digest("hex") },
      { $set: { expiresAt: new Date(0) } },
    );
    assert.equal(
      (await f.request("/api/invitations/claim", { token: expired.token }, cookie)).statusCode, 400,
    );
    assert.equal(await f.c("relations").countDocuments({ studentId }), 2);
  } finally {
    await f.close();
  }
});
