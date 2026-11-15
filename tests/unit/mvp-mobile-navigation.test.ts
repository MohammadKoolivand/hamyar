import assert from "node:assert/strict";
import { test } from "node:test";
import { mobileDestinations } from "../../src/components/mobile-bottom-nav";
import { pageFromPath, pathForPage } from "../../src/lib/app-routes";

test("MVP bottom navigation shows five destinations and Home exactly in the center", () => {
  const student = mobileDestinations("student").primary;
  const teacher = mobileDestinations("teacher").primary;
  for (const items of [student, teacher]) {
    assert.equal(items.length, 5);
    assert.equal(items[2].page, "home");
    assert.equal(items[2].label, "خانه");
    assert.equal(items[4].page, "account");
    assert.ok(items.every((item) => item.page !== "more"));
    assert.equal(new Set(items.map((item) => item.page)).size, items.length);
  }
  assert.deepEqual(student.map((item) => item.label), [
    "تمرین‌ها", "تکلیف‌ها", "خانه", "پیشرفت", "حساب",
  ]);
  assert.deepEqual(teacher.map((item) => item.label), [
    "کلاس‌ها", "تکلیف‌ها", "خانه", "سؤال و PDF", "حساب",
  ]);
});

test("routes for student practice and account survive refresh and deep links", () => {
  assert.equal(pathForPage("student-practice"), "/student-practice");
  assert.equal(pageFromPath("/student-practice"), "student-practice");
  assert.equal(pathForPage("account"), "/account");
  assert.equal(pageFromPath("/account"), "account");
  assert.equal(pathForPage("home"), "/home");
  assert.equal(pageFromPath("/home"), "home");
});

test("more specialized roles retain their own menus", () => {
  assert.equal(mobileDestinations("guest").primary[1].page, "home");
  assert.equal(mobileDestinations("parent").primary[1].page, "home");
  assert.equal(mobileDestinations("secretary").primary[2].page, "home");
  assert.ok(mobileDestinations("super_admin").additional.some((item) => item.page === "admin-overview"));
});
