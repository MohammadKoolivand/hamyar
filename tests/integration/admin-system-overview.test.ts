import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import { bootstrapSuperadmin } from "../../src/server/access-bootstrap";

test("admin dashboard counts current questions, reports collections, and hides internal fields", async () => {
  const f = await fixture();
  try {
    const ctx = createContext(f.db);
    await bootstrapSuperadmin(ctx, {
      name: "Admin Overview",
      email: "admin@overview.test",
      password: "StrongAdminPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "admin@overview.test",
      password: "StrongAdminPass123!",
    });
    assert.equal(login.statusCode, 200, login.body);
    const admin = "session=" + login.cookies[0].value;

    for (const cookie of ["", f.teacher, f.student]) {
      const denied = await f.request("/api/admin/system-overview", undefined, cookie);
      assert.equal(denied.statusCode, cookie ? 403 : 401, denied.body);
      assert.equal(
        (await f.request("/api/admin/system-overview/users", undefined, cookie)).statusCode,
        cookie ? 403 : 401,
      );
    }

    // A historical revision must not count as an extra question.
    const previous = await f.c("questionVersions").findOne({ _id: f.question._id });
    assert.ok(previous);
    await f.c("questionVersions").insertOne({
      ...previous,
      _id: ctx.id(),
    });

    const response = await f.request("/api/admin/system-overview", undefined, admin);
    assert.equal(response.statusCode, 200, response.body);
    const overview = response.json();
    assert.match(response.headers["cache-control"] ?? "", /no-store/);
    assert.equal(overview.database.name, f.db.databaseName);
    assert.equal(overview.totals.users, 3);
    assert.equal(overview.totals.teachers, 1);
    assert.equal(overview.totals.students, 1);
    assert.equal(overview.totals.questions, await f.c("questions").countDocuments({}));
    assert.equal(overview.totals.questionVersions,
      await f.c("questionVersions").estimatedDocumentCount());
    assert.ok(overview.questionTypes.some((q: { key: string; count: number }) =>
      q.key === "numeric" && q.count === 1));
    assert.ok(overview.collections.some((c: { name: string; documents: number | null }) =>
      c.name === "users" && c.documents !== null));
    assert.ok(overview.database.collections >= 2);
    assert.ok(!JSON.stringify(overview).includes("StrongAdminPass123!"));

    const usersRes = await f.request("/api/admin/system-overview/users?role=teacher&page=1", undefined, admin);
    assert.equal(usersRes.statusCode, 200, usersRes.body);
    const teachers = usersRes.json();
    assert.equal(teachers.total, 1);
    assert.equal(teachers.items[0].name, "Teacher");
    for (const item of teachers.items) {
      assert.deepEqual(
        Object.keys(item).filter((key) => ["passwordHash", "securityRevision", "tokenHash"].includes(key)),
        [],
      );
    }

    for (const query of ["?role=unknown", "?q=" + "x".repeat(61), "?page=-1", "?extra=1"]) {
      assert.equal(
        (await f.request("/api/admin/system-overview/users" + query, undefined, admin)).statusCode,
        400,
      );
    }
  } finally {
    await f.close();
  }
});

test("admin user search is literal, paginated, and scoped by role", async () => {
  const f = await fixture();
  try {
    const ctx = createContext(f.db);
    await bootstrapSuperadmin(ctx, {
      name: "Admin Test",
      email: "admin@search.test",
      password: "AdminStrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "admin@search.test",
      password: "AdminStrongPass123!",
    });
    assert.equal(login.statusCode, 200);
    const admin = "session=" + login.cookies[0].value;
    await f.c("users").insertMany(
      Array.from({ length: 25 }, (_, i) => ({
        _id: ctx.id(),
        name: "Teacher " + String(i + 1).padStart(2, "0"),
        email: "teacher-" + i + "@search.test",
        role: "teacher",
      })),
    );
    const first = await f.request("/api/admin/system-overview/users?role=teacher&page=1", undefined, admin);
    const second = await f.request("/api/admin/system-overview/users?role=teacher&page=2", undefined, admin);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(first.json().total, 26);
    assert.equal(first.json().items.length, 20);
    assert.equal(second.json().items.length, 6);
    assert.notEqual(first.json().items[0]._id, second.json().items[0]._id);
    const match = await f.request("/api/admin/system-overview/users?q=Teacher%2001", undefined, admin);
    assert.ok(match.json().items.some((u: { name: string }) => u.name === "Teacher 01"));
    const literal = await f.request("/api/admin/system-overview/users?q=.*", undefined, admin);
    assert.equal(literal.json().total, 0);
  } finally {
    await f.close();
  }
});
