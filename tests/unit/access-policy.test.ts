import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  registeredAccessRoutes,
  routeRoles,
  roleSchema,
} from "../../src/lib/access";

const allRoles = [...roleSchema.options];

test("authentication endpoints are public but every unknown API route fails closed", () => {
  assert.equal(routeRoles("POST", "/api/auth/otp/request"), null);
  assert.equal(routeRoles("POST", "/api/auth/otp/verify"), null);
  assert.deepEqual(routeRoles("GET", "/api/unknown"), []);
  assert.deepEqual(routeRoles("POST", "/api/unknown"), []);
});

test("role matrix separates student, teacher, parent, admin and secretary routes", () => {
  assert.deepEqual(routeRoles("GET", "/api/auth/me"), allRoles);
  assert.deepEqual(routeRoles("GET", "/api/admin/users"), ["super_admin"]);
  assert.deepEqual(routeRoles("GET", "/api/staff/workspaces"), ["secretary"]);
  assert.deepEqual(routeRoles("GET", "/api/student/dashboard"), ["student"]);
  assert.deepEqual(routeRoles("POST", "/api/questions"), [
    "teacher",
    "super_admin",
    "secretary",
  ]);
  assert.deepEqual(routeRoles("GET", "/api/assignments"), [
    "teacher",
    "student",
    "super_admin",
  ]);
  assert.deepEqual(routeRoles("GET", "/api/assignments/:aid"), [
    "teacher",
    "student",
    "super_admin",
  ]);
  assert.deepEqual(routeRoles("GET", "/api/assignments/:aid/report"), [
    "teacher",
    "student",
    "parent",
    "super_admin",
  ]);
  assert.deepEqual(routeRoles("POST", "/api/assignments/:aid/attempts"), [
    "student",
  ]);
  assert.deepEqual(routeRoles("GET", "/api/students/:sid/progress"), [
    "teacher",
    "student",
    "parent",
    "super_admin",
  ]);
  assert.deepEqual(
    routeRoles("POST", "/api/students/:sid/mastery/:skillId/override"),
    ["teacher", "super_admin"],
  );
});

test("method changes never widen a protected resource", () => {
  assert.deepEqual(routeRoles("GET", "/api/questions"), [
    "teacher",
    "super_admin",
    "secretary",
  ]);
  assert.deepEqual(routeRoles("POST", "/api/questions"), [
    "teacher",
    "super_admin",
    "secretary",
  ]);
  assert.deepEqual(routeRoles("DELETE", "/api/questions"), []);
  assert.deepEqual(routeRoles("POST", "/api/assignments/:aid/complete"), [
    "student",
  ]);
  assert.deepEqual(routeRoles("DELETE", "/api/assignments/:aid"), []);
  assert.deepEqual(routeRoles("GET", "/api/questions/not-registered"), []);
  assert.deepEqual(routeRoles("POST", "/api/admin/not-registered"), []);
});

test("every registered Fastify route has an explicit access policy", () => {
  const serverDir = join(process.cwd(), "src/server");
  const files = [
    join(serverDir, "app.ts"),
    ...readdirSync(join(serverDir, "modules")).map((name) =>
      join(serverDir, "modules", name),
    ),
  ].filter((name) => name.endsWith(".ts"));
  const routePattern = /app\.(get|post|put|patch|delete)\(\s*["`]([^"`]+)["`]/g;
  const discovered = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(routePattern))
      discovered.add(`${match[1].toUpperCase()} ${match[2]}`);
  }
  assert.deepEqual(
    [...discovered].filter((route) => !registeredAccessRoutes.has(route)),
    [],
  );
  assert.deepEqual(
    [...registeredAccessRoutes].filter((route) => !discovered.has(route)),
    [],
  );
});
