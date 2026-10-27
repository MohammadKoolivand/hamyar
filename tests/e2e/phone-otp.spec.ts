import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";
test.use({
  serviceWorkers: "block",
  storageState: { cookies: [], origins: [] },
});
test("public phone OTP signup verifies mobile and enters real student dashboard (SMS controlled)", async ({
  page,
}) => {
  process.env.AUTH_OTP_SECRET = Buffer.alloc(32, 19).toString("base64");
  let code = "";
  const f = await fixture({
    sms: {
      name: "controlled_sms",
      configured: () => true,
      sendOtp: async (_phone, value) => {
        code = value;
      },
    },
  });
  try {
    await routeBackend(page, f.app);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "ورود یا ثبت‌نام در هدهد" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "حساب جدید می‌سازم" }).click();
    await page.getByLabel("شماره موبایل", { exact: true }).fill("۰۹۱۲۳۴۵۶۷۸۹");
    await page.getByLabel("نام و نام خانوادگی").fill("دانش‌آموز آزمایشی");
    await page
      .getByRole("button", { name: "دریافت کد تأیید", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("کد تأیید");
    expect(code).toMatch(/^\d{6}$/);
    await expect(
      page.getByRole("button", { name: /ارسال دوباره تا/ }),
    ).toBeDisabled();
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.getByLabel("کد یک‌بارمصرف").fill(code);
    await page
      .getByRole("button", { name: "تأیید کد و ورود", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const user = await page.evaluate(async () =>
      (await fetch("/api/auth/me")).json(),
    );
    expect(user.phoneVerified).toBe(true);
    expect(user.role).toBe("student");
    expect(user.phone).toBe("09123456789");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    await expect(
      page.getByLabel("شماره موبایل", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});


test("public teacher self-registration creates a dedicated teacher session and workspace", async ({
  page,
}) => {
  process.env.AUTH_OTP_SECRET = Buffer.alloc(32, 19).toString("base64");
  let code = "";
  const f = await fixture({
    sms: {
      name: "controlled_sms",
      configured: () => true,
      sendOtp: async (_phone, value) => {
        code = value;
      },
    },
  });
  try {
    await routeBackend(page, f.app);
    await page.goto("/");
    await page.getByRole("button", { name: "حساب جدید می‌سازم" }).click();
    await page.getByLabel("شماره موبایل", { exact: true }).fill("۰۹۱۲۰۰۰۰۰۸۸");
    await page.getByLabel("نام و نام خانوادگی").fill("معلم آزمایشی مستقل");
    await page.getByLabel("نقش شما").selectOption("teacher");
    await page.getByRole("button", { name: "دریافت کد تأیید" }).click();
    expect(code).toMatch(/^\\d{6}$/);
    await page.getByLabel("کد یک‌بارمصرف").fill(code);
    await page.getByRole("button", { name: "تأیید کد و ورود" }).click();
    await expect(page).toHaveURL(/\\/dashboard$/);
    await expect(page.getByText("فضای کار معلم", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "دانش‌آموزان", exact: true })).toBeVisible();
    const me = await page.evaluate(async () => (await fetch("/api/auth/me")).json());
    expect(me.role).toBe("teacher");
    expect(me.name).toBe("معلم آزمایشی مستقل");
    expect(me.phone).toBe("09120000088");
    expect(me.phoneVerified).toBe(true);
    expect(await page.evaluate(async () => (await fetch("/api/students")).status)).toBe(200);
    await page.reload();
    await expect(page.getByText("فضای کار معلم", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "خروج", exact: true }).click();
    await expect(page.getByLabel("شماره موبایل", { exact: true })).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
