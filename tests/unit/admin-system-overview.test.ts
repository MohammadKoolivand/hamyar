import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { roleSchema, routeRoles } from "../../src/lib/access";
import { formatStorageBytes, questionTypeLabels } from "../../src/lib/admin-overview";
import { pageFromPath, pathForPage, routeSegments } from "../../src/lib/app-routes";

test("system monitoring endpoints are only accessible to superadmin", () => {
  for (const route of ["/api/admin/system-overview", "/api/admin/system-overview/users"]) {
    assert.deepEqual(routeRoles("GET", route), ["super_admin"]);
    assert.deepEqual(routeRoles("POST", route), []);
    for (const role of roleSchema.options.filter((value) => value !== "super_admin"))
      assert.ok(!routeRoles("GET", route)?.includes(role));
  }
});

test("system overview has its own stable deep link, without overriding other tabs", () => {
  assert.equal(pathForPage("admin-overview"), "/system-overview");
  assert.equal(pageFromPath("/system-overview"), "admin-overview");
  assert.ok(routeSegments.includes("system-overview"));
  assert.equal(pageFromPath("/management"), "access");
});

test("storage values are honest about missing privileges, zero usage, and units", () => {
  assert.equal(formatStorageBytes(null), "در دسترس نیست");
  assert.equal(formatStorageBytes(NaN), "در دسترس نیست");
  assert.equal(formatStorageBytes(0), "۰ بایت");
  assert.match(formatStorageBytes(1024 ** 2), /مگابایت/);
  assert.equal(questionTypeLabels.choice, "چهارگزینه‌ای");
});

test("admin overview only displays protected endpoints and never raw MongoDB credentials", () => {
  const screen = readFileSync("src/features/access/admin-system-overview.tsx", "utf8");
  assert.match(screen, /admin\/system-overview/);
  assert.doesNotMatch(screen, /passwordHash|MONGO_URL|tokenHash/);
});
