import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { bootstrapSuperadmin } from "../../src/server/access-bootstrap";
import { createContext } from "../../src/server/context";
import { fixture } from "../helpers/fixture";

test("public identity and membership endpoints reject mass assignment", async () => {
  const f = await fixture();
  try {
    const teacher = (await f.c("users").findOne({ email: "t@test.dev" }))!;
    const student = (await f.c("users").findOne({ email: "s@test.dev" }))!;

    for (const injected of [
      { role: "super_admin" },
      { role: "secretary" },
      { permissions: ["roster.read"] },
      { teacherId: teacher._id },
      { disabledAt: new Date().toISOString() },
    ]) {
      const email = `blocked-${Object.keys(injected)[0]}-${randomUUID()}@test.dev`;
      const response = await f.request("/api/auth/register", {
        name: "Blocked account",
        email,
        password: "StrongPass123!",
        ...injected,
      });
      assert.equal(response.statusCode, 400, response.body);
      assert.equal(await f.c("users").countDocuments({ email }), 0);
    }

    const invitationsBefore = await f.c("invitations").countDocuments();
    const forgedInvitation = await f.request(
      "/api/invitations",
      {
        email: "forged-invitation@test.dev",
        role: "student",
        teacherId: randomUUID(),
        permissions: ["courses.read"],
      },
      f.teacher,
    );
    assert.equal(forgedInvitation.statusCode, 400, forgedInvitation.body);
    assert.equal(await f.c("invitations").countDocuments(), invitationsBefore);

    const parentInvite = await f.post(
      "/api/invitations",
      { email: "parent-mass@test.dev", role: "parent", studentId: student._id },
      f.teacher,
    );
    const forgedAccept = await f.request("/api/invitations/accept", {
      name: "Parent Mass",
      email: "parent-mass@test.dev",
      password: "StrongPass123!",
      token: parentInvite.token,
      role: "super_admin",
      teacherId: crypto.randomUUID(),
      permissions: ["roster.read"],
    });
    assert.equal(forgedAccept.statusCode, 400, forgedAccept.body);
    assert.equal(
      await f.c("users").countDocuments({ email: "parent-mass@test.dev" }),
      0,
    );
    assert.equal(
      (await f.c("invitations").findOne({
        tokenHash: createContext(f.db).hash(parentInvite.token),
      }))?.usedAt,
      null,
    );

    const forgedCourse = await f.request(
      "/api/courses",
      {
        title: "Forged course",
        subject: "Security",
        teacherId: crypto.randomUUID(),
        ownerId: crypto.randomUUID(),
        status: "active",
      },
      f.teacher,
    );
    assert.equal(forgedCourse.statusCode, 400, forgedCourse.body);
    assert.equal(await f.c("courses").countDocuments({ title: "Forged course" }), 0);

    const course = await f.post(
      "/api/courses",
      { title: "Secure course", subject: "Security" },
      f.teacher,
    );
    const joinCode = await f.post(
      `/api/courses/${course._id}/join-code`,
      {},
      f.teacher,
    );
    const forgedRequest = await f.request(
      "/api/course-requests",
      {
        code: joinCode.code,
        studentId: student._id,
        teacherId: teacher._id,
        status: "approved",
        role: "teacher",
      },
      f.student,
    );
    assert.equal(forgedRequest.statusCode, 400, forgedRequest.body);
    assert.equal(await f.c("courseRequests").countDocuments(), 0);

    await f.post("/api/course-requests", { code: joinCode.code }, f.student);
    const membershipRequest = (await f.c("courseRequests").findOne({
      courseId: course._id,
      studentId: student._id,
    }))!;
    assert.equal(membershipRequest.teacherId, teacher._id);
    assert.equal(membershipRequest.status, "pending");
    const forgedDecision = await f.request(
      `/api/course-requests/${membershipRequest._id}/decision`,
      {
        decision: "approve",
        teacherId: crypto.randomUUID(),
        permissions: ["admin"],
      },
      f.teacher,
    );
    assert.equal(forgedDecision.statusCode, 400, forgedDecision.body);
    assert.equal(
      (await f.c("courseRequests").findOne({ _id: membershipRequest._id }))?.status,
      "pending",
    );
    await f.post(
      `/api/course-requests/${membershipRequest._id}/decision`,
      { decision: "approve" },
      f.teacher,
    );
    const enrollment = await f.c("enrollments").findOne({
      courseId: course._id,
      studentId: student._id,
    });
    assert.equal(enrollment?.teacherId, teacher._id);
    assert.equal(enrollment?.status, "active");

    const forgedGroup = await f.request(
      "/api/class-groups",
      {
        courseId: course._id,
        title: "Forged group",
        studentIds: [student._id],
        teacherId: randomUUID(),
        permissions: ["admin"],
      },
      f.teacher,
    );
    assert.equal(forgedGroup.statusCode, 400, forgedGroup.body);
    assert.equal(await f.c("classGroups").countDocuments(), 0);

    assert.equal((await f.c("users").findOne({ _id: student._id }))?.role, "student");
    assert.equal((await f.c("users").findOne({ _id: teacher._id }))?.role, "teacher");
  } finally {
    await f.close();
  }
});

test("only a current superadmin can mutate roles and delegated permissions", async () => {
  const f = await fixture();
  try {
    const ctx = createContext(f.db);
    await bootstrapSuperadmin(ctx, {
      name: "Mass assignment admin",
      email: "mass-admin@test.dev",
      password: "AdminStrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "mass-admin@test.dev",
      password: "AdminStrongPass123!",
    });
    assert.equal(login.statusCode, 200, login.body);
    const admin = `session=${login.cookies[0].value}`;
    const student = (await f.c("users").findOne({ email: "s@test.dev" }))!;
    const teacher = (await f.c("users").findOne({ email: "t@test.dev" }))!;

    const directEscalation = await f.request(
      `/api/admin/users/${student._id}/access`,
      { role: "super_admin", disabled: false },
      f.student,
    );
    assert.equal(directEscalation.statusCode, 403, directEscalation.body);

    const injectedAdminChange = await f.request(
      `/api/admin/users/${student._id}/access`,
      {
        role: "teacher",
        disabled: false,
        teacherId: teacher._id,
        permissions: ["roster.read"],
        securityRevision: 0,
      },
      admin,
    );
    assert.equal(injectedAdminChange.statusCode, 400, injectedAdminChange.body);
    assert.equal((await f.c("users").findOne({ _id: student._id }))?.role, "student");

    const secretary = await f.post(
      "/api/admin/users",
      {
        name: "Scoped secretary",
        email: "scoped-secretary@test.dev",
        password: "SecretaryStrong123!",
        role: "secretary",
      },
      admin,
    );
    const forgedGrant = await f.request(
      "/api/admin/staff-assignments",
      {
        secretaryId: secretary._id,
        teacherId: teacher._id,
        permissions: ["roster.read"],
        grantedBy: secretary._id,
        role: "super_admin",
      },
      admin,
    );
    assert.equal(forgedGrant.statusCode, 400, forgedGrant.body);
    assert.equal(await f.c("staffAssignments").countDocuments(), 0);

    const unauthorizedGrant = await f.request(
      "/api/admin/staff-assignments",
      {
        secretaryId: secretary._id,
        teacherId: teacher._id,
        permissions: ["roster.read"],
      },
      f.teacher,
    );
    assert.equal(unauthorizedGrant.statusCode, 403, unauthorizedGrant.body);
    assert.equal(await f.c("staffAssignments").countDocuments(), 0);

    await f.post(
      "/api/admin/staff-assignments",
      {
        secretaryId: secretary._id,
        teacherId: teacher._id,
        permissions: ["roster.read"],
      },
      admin,
    );
    const storedGrant = await f.c("staffAssignments").findOne({
      secretaryId: secretary._id,
      teacherId: teacher._id,
    });
    assert.deepEqual(storedGrant?.permissions, ["roster.read"]);
    assert.equal(storedGrant?.grantedBy, login.json()._id);
  } finally {
    await f.close();
  }
});
