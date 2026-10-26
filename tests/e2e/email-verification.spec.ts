import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";
import { createContext } from "../../src/server/context";
import { deliverNextMail } from "../../src/server/auth/mail-outbox";
test.use({ serviceWorkers: "block" });
test("email verification UI confirms ownership once, strips token and supports mobile RTL (SMTP transport controlled)", async ({
  page,
}) => {
  const saved = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    APP_ORIGIN: process.env.APP_ORIGIN,
  };
  Object.assign(process.env, {
    SMTP_HOST: "smtp.invalid",
    SMTP_USER: "fixture",
    SMTP_PASSWORD: "fixture",
    SMTP_FROM: "fixture@example.test",
    APP_ORIGIN: "http://127.0.0.1:5174",
  });
  const f = await fixture();
  try {
    await routeBackend(page, f.app);
    await page.goto("/verify-email");
    await page.getByLabel("ایمیل حساب", { exact: true }).fill("t@test.dev");
    await page
      .getByRole("button", { name: "ارسال لینک تأیید", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "اگر درخواست معتبر باشد",
    );
    let token = "";
    await deliverNextMail(createContext(f.db), async (_to, value) => {
      token = value;
    });
    expect(token).toHaveLength(64);
    await page.goto("/verify-email#token=" + token);
    await expect(page).toHaveURL(/\/verify-email$/);
    await page
      .getByRole("button", { name: "تأیید ایمیل", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("ایمیل تأیید شد");
    expect(
      (await f.c("users").findOne({ email: "t@test.dev" }))!.emailVerified,
    ).toBe(true);
    await page.goto("/verify-email#token=" + token);
    await page
      .getByRole("button", { name: "تأیید ایمیل", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "نامعتبر یا منقضی",
    );
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
