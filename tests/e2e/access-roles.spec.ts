import { useFixtureSession } from "./auth-helpers";
import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import { bootstrapSuperadmin } from "../../src/server/access-bootstrap";
test.use({ serviceWorkers: "block" });
test("super admin creates scoped secretary and secretary uses a separate operational panel", async ({
  page,
}, testInfo) => {
  let smsCode = "";
  const f = await fixture({
    sms: { name: "controlled_sms", configured: () => true,
      sendOtp: async (_phone, code) => { smsCode = code; } },
  });
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
    const firstAdmin = await f.request("/api/auth/login", {
      email: "admin@ui.test", password: "AdminStrongPass123!",
    });
    expect(firstAdmin.statusCode).toBe(200);
    const adminCookie = "session=" + firstAdmin.cookies[0].value;
    await page.goto("/");
    await useFixtureSession(page, adminCookie );
    await expect(
      page.getByRole("heading", {
        name: "مدیریت سامانه و دسترسی‌ها",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("نام کاربر", { exact: true }).fill("منشی آزمایشی");
    await page
      .getByLabel("شماره موبایل کاربر", { exact: true })
      .fill("09120000177");
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
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: testInfo.outputPath("superadmin.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    const secretaryOtp = await f.post("/api/auth/otp/request", { phone: "09120000177" });
    const secretaryLogin = await f.request("/api/auth/otp/verify", {
      phone: "09120000177", challengeId: secretaryOtp.challengeId, code: smsCode,
    });
    expect(secretaryLogin.statusCode).toBe(200);
    await useFixtureSession(page, "session=" + secretaryLogin.cookies[0].value );
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
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
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
    const studentOtp = await f.post("/api/auth/otp/request", { phone: "09123456789" });
    const studentLogin = await f.request("/api/auth/otp/verify", {
      phone: "09123456789", challengeId: studentOtp.challengeId, code: smsCode,
      name: "دانش‌آموز دعوت موبایلی", invitationToken: inviteToken,
    });
    expect(studentLogin.statusCode).toBe(200, studentLogin.body);
    await useFixtureSession(page, "session=" + studentLogin.cookies[0].value );
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
    const parentLogin = await f.request("/api/auth/login", {
      email: "09120000092", password: "StrongPass123!",
    });
    expect(parentLogin.statusCode).toBe(200, parentLogin.body);
    await page.goto("/");
    await useFixtureSession(page, "session=" + parentLogin.cookies[0].value );
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
