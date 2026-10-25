import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import { bootstrapSuperadmin } from "../../src/server/access-bootstrap";
test("five roles have distinct server permissions, delegated staff scope, revocation and no public escalation", async () => {
  const f = await fixture();
  try {
    const ctx = createContext(f.db);
    const adminId = await bootstrapSuperadmin(ctx, {
      name: "Super admin fixture",
      email: "admin@roles.test",
      password: "AdminStrongPass123!",
    });
    async function login(email: string, password: string) {
      const r = await f.request("/api/auth/login", { email, password });
      assert.equal(r.statusCode, 200, r.body);
      return "session=" + r.cookies[0].value;
    }
    const admin = await login("admin@roles.test", "AdminStrongPass123!");
    const teacher = (await f.c("users").findOne({ email: "t@test.dev" }))!;
    await assert.rejects(
      bootstrapSuperadmin(ctx, {
        name: "Second bootstrap",
        email: "another@roles.test",
        password: "AdminStrongPass123!",
      }),
      /already exists/,
    );
    for (const role of ["super_admin", "secretary", "parent", "root"])
      assert.equal(
        (
          await f.request("/api/auth/register", {
            name: "Blocked role",
            email: `${role}@public.test`,
            password: "StrongPass123!",
            role,
          })
        ).statusCode,
        400,
      );
    const secretary = await f.post(
      "/api/admin/users",
      {
        name: "Secretary",
        email: "staff@roles.test",
        password: "StaffStrong123!",
        role: "secretary",
      },
      admin,
    );
    let staff = await login("staff@roles.test", "StaffStrong123!");
    const root = `/api/staff/workspaces/${teacher._id}`;
    assert.equal(
      (await f.request("/api/admin/users", undefined, f.student)).statusCode,
      403,
    );
    assert.equal(
      (await f.request("/api/admin/users", undefined, f.teacher)).statusCode,
      403,
    );
    assert.equal(
      (await f.request("/api/admin/users", undefined, staff)).statusCode,
      403,
    );
    assert.equal(
      (await f.request("/api/questions", undefined, staff)).statusCode,
      403,
    );
    assert.equal(
      (await f.request("/api/questions", undefined, admin)).statusCode,
      403,
    );
    assert.equal(
      (await f.request("/api/exam-imports", undefined, staff)).statusCode,
      403,
    );
    assert.equal(
      (await f.request(f.path + "/report", undefined, staff)).statusCode,
      403,
    );
    assert.equal(
      (await f.request(root + "/roster", undefined, staff)).statusCode,
      403,
    );
    assert.deepEqual(
      (await f.request("/api/staff/workspaces", undefined, staff)).json(),
      [],
    );
    await f.post(
      "/api/admin/staff-assignments",
      {
        secretaryId: secretary._id,
        teacherId: teacher._id,
        permissions: ["roster.read"],
      },
      admin,
    );
    const roster = (await f.request(root + "/roster", undefined, staff)).json();
    assert.equal(roster.length, 1);
    assert.deepEqual(Object.keys(roster[0]).sort(), ["_id", "email", "name"]);
    assert.equal(
      (await f.request(root + "/courses", undefined, staff)).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          root + "/invitations",
          { email: "new@roles.test", role: "student" },
          staff,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/staff/workspaces/00000000-0000-4000-8000-000000000000/roster",
          undefined,
          staff,
        )
      ).statusCode,
      403,
    );
    await f.post(
      "/api/admin/staff-assignments",
      {
        secretaryId: secretary._id,
        teacherId: teacher._id,
        permissions: ["roster.read", "courses.read", "invitations.create"],
      },
      admin,
    );
    const invitation = await f.post(
      root + "/invitations",
      { email: "new@roles.test", role: "student" },
      staff,
    );
    assert.ok(invitation.token);
    assert.equal(
      (
        await f.request(
          root + "/invitations",
          { email: "escalate@roles.test", role: "super_admin" },
          staff,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.request(
          root + "/invitations",
          { email: "parent@roles.test", role: "parent", studentId: ctx.id() },
          staff,
        )
      ).statusCode,
      404,
    );
    await f.post("/api/invitations/accept", {
      name: "Invited student",
      email: "new@roles.test",
      password: "StrongPass123!",
      token: invitation.token,
    });
    const invited = (await f.c("users").findOne({ email: "new@roles.test" }))!;
    assert.equal(invited.role, "student");
    assert.ok(
      await f
        .c("relations")
        .findOne({ teacherId: teacher._id, studentId: invited._id }),
    );
    const grants = (
      await f.request("/api/admin/staff-assignments", undefined, admin)
    ).json();
    await f.post(
      `/api/admin/staff-assignments/${grants[0]._id}/revoke`,
      {},
      admin,
    );
    assert.equal(
      (await f.request(root + "/roster", undefined, staff)).statusCode,
      403,
    );
    const users = (
      await f.request("/api/admin/users", undefined, admin)
    ).json();
    assert.ok(users.some((u: { role: string }) => u.role === "secretary"));
    assert.ok(users.every((u: object) => !("passwordHash" in u)));
    assert.equal(
      (
        await f.request(
          `/api/admin/users/${adminId}/access`,
          { role: "student", disabled: true },
          admin,
        )
      ).statusCode,
      409,
    );
    await f.post(
      `/api/admin/users/${secretary._id}/access`,
      { role: "student", disabled: false },
      admin,
    );
    assert.equal(
      (await f.request("/api/auth/me", undefined, staff)).statusCode,
      401,
    );
    staff = await login("staff@roles.test", "StaffStrong123!");
    assert.equal(
      (await f.request("/api/staff/workspaces", undefined, staff)).statusCode,
      403,
    );
    await f.post(
      `/api/admin/users/${secretary._id}/access`,
      { role: "student", disabled: true },
      admin,
    );
    assert.equal(
      (
        await f.request("/api/auth/login", {
          email: "staff@roles.test",
          password: "StaffStrong123!",
        })
      ).statusCode,
      401,
    );
    const audit = (
      await f.request("/api/admin/audit", undefined, admin)
    ).json();
    assert.ok(
      audit.some((a: { action: string }) => a.action === "admin_update_access"),
    );
  } finally {
    await f.close();
  }
});
test("parent access is tied to verified child links and stays read-only", async () => {
  const f = await fixture();
  try {
    const inv = await f.post(
      "/api/invitations",
      {
        email: "parent@roles.test",
        role: "parent",
        studentId: f.assignment.studentId,
      },
      f.teacher,
    );
    await f.post("/api/invitations/accept", {
      name: "Parent fixture",
      email: "parent@roles.test",
      password: "StrongPass123!",
      token: inv.token,
    });
    const login = await f.request("/api/auth/login", {
      email: "parent@roles.test",
      password: "StrongPass123!",
    });
    const parent = "session=" + login.cookies[0].value;
    assert.equal(
      (await f.request("/api/children", undefined, parent)).statusCode,
      200,
    );
    assert.equal(
      (await f.request(f.path + "/report", undefined, parent)).statusCode,
      200,
    );
    assert.equal(
      (await f.request("/api/questions", undefined, parent)).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/attempts",
          { questionVersionId: f.question._id, answer: "2" },
          parent,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (await f.request("/api/admin/users", undefined, parent)).statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/students/00000000-0000-4000-8000-000000000000/progress",
          undefined,
          parent,
        )
      ).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
