import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import { bootstrapSuperadmin } from "../../src/server/access-bootstrap";
test.use({ serviceWorkers: "block" });
test("super admin creates scoped secretary and secretary uses a separate operational panel", async ({
  page,
}, testInfo) => {
  const f = await fixture();
  try {
    await bootstrapSuperadmin(createContext(f.db), {
      name: "مدیر آزمایشی",
      email: "admin@ui.test",
      password: "AdminStrongPass123!",
    });
    // Browser uses the real Fastify backend and MongoDB fixture. Only transport is redirected;
    // no responses or authorization decisions are mocked and production users are untouched.
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const reply = await f.app.inject({
        method: req.method() as "GET" | "POST" | "DELETE",
        url: url.pathname + url.search,
        headers: req.headers(),
        ...(req.postDataBuffer() ? { payload: req.postDataBuffer()! } : {}),
      });
      await route.fulfill({
        status: reply.statusCode,
        headers: Object.fromEntries(
          Object.entries(reply.headers).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(",") : String(v),
          ]),
        ),
        body: reply.rawPayload,
      });
    });
    await page.goto("/");
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill("admin@ui.test");
    await page.getByLabel("رمز عبور").fill("AdminStrongPass123!");
    await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "مدیریت سامانه و دسترسی‌ها",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("نام کاربر", { exact: true }).fill("منشی آزمایشی");
    await page
      .getByLabel("ایمیل کاربر", { exact: true })
      .fill("secretary@ui.test");
    await page.getByLabel("رمز اولیه", { exact: true }).fill("StaffStrong123!");
    await page.getByRole("button", { name: "ایجاد حساب", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("حساب ساخته شد");
    await page
      .getByLabel("منشی", { exact: true })
      .selectOption({ label: "منشی آزمایشی" });
    await page
      .getByLabel("معلم مسئول", { exact: true })
      .selectOption({ label: "Teacher" });
    await page
      .getByLabel("ایجاد دعوت دانش‌آموز و والدین", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "ذخیره دسترسی منشی", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("واگذار شد");
    await page.screenshot({
      path: testInfo.outputPath("superadmin.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill("secretary@ui.test");
    await page.getByLabel("رمز عبور").fill("StaffStrong123!");
    await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await expect(
      page.getByRole("heading", { name: "امور اجرایی", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "مدیریت سامانه و دسترسی‌ها",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByLabel("انتخاب حوزه معلم", { exact: true })
      .selectOption({ label: "Teacher" });
    await expect(page.getByText("Student", { exact: true })).toBeVisible();
    await page
      .getByLabel("شماره موبایل دعوت", { exact: true })
      .fill("09123456789");
    await page.getByRole("button", { name: "ساخت دعوت", exact: true }).click();
    await expect(page.getByText(/\?invite=/)).toBeVisible();
    expect(
      await page.evaluate(async () => (await fetch("/api/questions")).status),
    ).toBe(403);
    expect(
      await page.evaluate(async () => (await fetch("/api/admin/users")).status),
    ).toBe(403);
    const invitationText = await page.getByText(/\?invite=/).innerText();
    const inviteToken = invitationText.match(/invite=([a-f0-9]+)/)![1];
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath("secretary-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    await expect(
      page.getByLabel("ایمیل یا شماره موبایل", { exact: true }),
    ).toBeVisible();
    await page.goto("/?invite=" + inviteToken);
    await page.getByLabel("نام و نام خانوادگی").fill("دانش‌آموز دعوت موبایلی");
    await page
      .getByLabel("شماره موبایل دعوت‌شده", { exact: true })
      .fill("۰۹۱۲۳۴۵۶۷۸۹");
    await page.getByLabel("رمز عبور").fill("StrongPass123!");
    await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
    await expect(
      page.getByLabel("ایمیل یا شماره موبایل", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill("+989123456789");
    await page.getByLabel("رمز عبور").fill("StrongPass123!");
    await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        async () => (await (await fetch("/api/auth/me")).json()).phone,
      ),
    ).toBe("09123456789");
  } finally {
    await f.close();
  }
});

test("parent portal has a valid child selector without hydration errors and revocation removes data", async ({
  page,
}) => {
  const { routeBackend } = await import("../helpers/browser-backend");
  const f = await fixture();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (/hydration|cannot be a child|cannot contain/i.test(message.text()))
      errors.push(message.text());
  });
  try {
    const invite = await f.post(
      "/api/invitations",
      {
        phone: "09120000092",
        role: "parent",
        studentId: f.assignment.studentId,
      },
      f.teacher,
    );
    await f.post("/api/invitations/accept", {
      phone: "09120000092",
      name: "ولی تست مرورگر",
      password: "StrongPass123!",
      token: invite.token,
    });
    await routeBackend(page, f.app);
    await page.goto("/");
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill("09120000092");
    await page.getByLabel("رمز عبور").fill("StrongPass123!");
    await page
      .getByRole("button", { name: "ورود به هدهده", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "پنل اولیا", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("انتخاب فرزند").locator("option")).toHaveText([
      "Student",
    ]);
    expect(
      await page
        .getByLabel("انتخاب فرزند")
        .evaluate((el) => el.querySelectorAll("div, nav, button").length),
    ).toBe(0);
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    const parent = await f.c("users").findOne({ phone: "09120000092" });
    await f.post(
      `/api/students/${f.assignment.studentId}/parents/${parent!._id}/revoke`,
      {},
      f.teacher,
    );
    await page.reload();
    await expect(page.getByLabel("انتخاب فرزند").locator("option")).toHaveCount(
      0,
    );
    expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
