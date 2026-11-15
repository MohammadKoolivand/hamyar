import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mobileDestinations } from "../../src/components/mobile-bottom-nav";

test("mobile destinations are small, stable and appropriate for each user role", () => {
  const roles = ["guest", "student", "teacher", "super_admin", "secretary", "parent"] as const;
  for (const role of roles) {
    const { primary, additional } = mobileDestinations(role);
    assert.ok(primary.length >= 2 && primary.length <= 5, role);
    assert.equal(new Set(primary.map((item) => item.page)).size, primary.length, role);
    assert.ok(primary.every((item) => item.label.length > 0), role);
    assert.ok(primary.every((item) => item.icon), role);
    assert.equal(primary.some((item) => item.page === "more"), additional.length > 0, role);
  }
  assert.deepEqual(mobileDestinations("guest").primary.map((item) => item.page), ["courses", "home", "login"]);
  assert.deepEqual(mobileDestinations("parent").primary.map((item) => item.page), ["dashboard", "home", "public-bank"]);
  for (const role of roles) {
    const items = mobileDestinations(role).primary;
    assert.equal(items[Math.floor(items.length / 2)].page, "home", role);
    assert.equal(items[Math.floor(items.length / 2)].icon != null, true);
  }
  assert.ok(!mobileDestinations("student").additional.some((item) => item.page === "access"));
  assert.ok(!mobileDestinations("teacher").additional.some((item) => item.page === "admin-overview"));
  assert.ok(mobileDestinations("super_admin").additional.some((item) => item.page === "admin-overview"));
  assert.ok(mobileDestinations("secretary").additional.some((item) => item.page === "access"));
});

test("mobile bar uses fixed safe-area layout and keeps content above itself", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const shell = readFileSync("src/components/hamyar-app.tsx", "utf8");
  assert.match(css, /\.hy-mobile-bottom-nav\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.hy-site-main\s*\{\s*padding-bottom:/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.match(shell, /<MobileBottomNav role="guest"/);
  assert.match(shell, /<MobileBottomNav role="parent"/);
  assert.match(shell, /<MobileBottomNav role=\{me\.role\}/);
});

test("shared educational visual language uses clear surfaces and readable UI fonts", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(css, /--hy-background: #f7f9fc/);
  assert.match(css, /--hy-radius-card: 18px/);
  assert.match(css, /--hy-glass-border: #e0e6ef/);
  assert.match(css, /font-family: "Hodhod UI"/);
  assert.match(css, /BNazanin-Regular\\.ttf/);
  assert.match(css, /BNazanin-Bold\\.ttf/);
  assert.match(css, /Poppins-Regular\\.ttf/);
  assert.doesNotMatch(layout, /font-family:var\(--font-persian\),Tahoma,sans-serif/);
});
