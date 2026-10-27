import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";

test.use({ serviceWorkers: "block" });
test("legacy recovery API preserves one-use, non-enumerating reset while phone-only UI offers no email form", async ({ page }) => {
  let deliveredToken = "";
  const f = await fixture({
    resetMailer: async (_email, token) => { deliveredToken = token; },
  });
  try {
    await routeBackend(page, f.app);
    await page.goto("/");
    await expect(page.getByLabel("شماره موبایل", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "رمز عبور را فراموش کرده‌اید؟" })).toHaveCount(0);
    const request = await f.request("/api/auth/password-reset/request", { email: "t@test.dev" });
    expect(request.statusCode).toBe(200);
    expect(request.body).not.toContain("t@test.dev");
    await expect.poll(() => deliveredToken.length).toBe(64);
    const confirm = await f.request("/api/auth/password-reset/confirm", {
      token: deliveredToken, password: "NewStrongPass456!",
    });
    expect(confirm.statusCode).toBe(200, confirm.body);
    expect((await f.request("/api/auth/me", undefined, f.teacher)).statusCode).toBe(401);
    expect((await f.request("/api/auth/password-reset/confirm", {
      token: deliveredToken, password: "AnotherStrong456!",
    })).statusCode).toBe(400);
    expect((await f.request("/api/auth/login", {
      email: "t@test.dev", password: "StrongPass123!",
    })).statusCode).toBe(401);
    expect((await f.request("/api/auth/login", {
      email: "t@test.dev", password: "NewStrongPass456!",
    })).statusCode).toBe(200);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
