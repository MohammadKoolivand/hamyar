import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";
test.use({ serviceWorkers: "block" });
test("password recovery UI uses one-time token and invalidates every old session (SMTP dependency controlled)", async ({
  page,
}) => {
  let deliveredToken = "";
  const f = await fixture({
    resetMailer: async (_email, token) => {
      deliveredToken = token;
    },
  });
  try {
    await routeBackend(page, f.app);
    await page.goto("/");
    await page
      .getByRole("button", { name: "رمز عبور را فراموش کرده‌اید؟" })
      .click();
    await page.getByLabel("ایمیل حساب", { exact: true }).fill("t@test.dev");
    await page
      .getByRole("button", { name: "ارسال لینک بازیابی", exact: true })
      .click();
    await expect(
      page.getByText(
        "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی ارسال خواهد شد.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect.poll(() => deliveredToken.length).toBe(64);
    await page.goto("/#reset=" + deliveredToken);
    await expect(
      page.getByRole("heading", { name: "انتخاب رمز جدید" }),
    ).toBeVisible();
    expect(page.url()).not.toContain("#reset=");
    await page
      .getByLabel("رمز جدید (حداقل ۱۰ کاراکتر)", { exact: true })
      .fill("NewStrongPass456!");
    await page
      .getByLabel("تکرار رمز جدید", { exact: true })
      .fill("NewStrongPass456!");
    await page
      .getByRole("button", { name: "ذخیره رمز جدید", exact: true })
      .click();
    await expect(
      page.getByText("رمز عبور تغییر کرد. با رمز جدید وارد شوید.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await f.request("/api/auth/me", undefined, f.teacher)).statusCode,
    ).toBe(401);
    expect(
      (
        await f.request("/api/auth/password-reset/confirm", {
          token: deliveredToken,
          password: "AnotherStrong456!",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await f.request("/api/auth/login", {
          email: "t@test.dev",
          password: "StrongPass123!",
        })
      ).statusCode,
    ).toBe(401);
    const signedIn = await f.request("/api/auth/login", {
      email: "t@test.dev",
      password: "NewStrongPass456!",
    });
    expect(signedIn.statusCode).toBe(200);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
