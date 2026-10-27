import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";
import { createContext } from "../../src/server/context";
import { deliverNextMail } from "../../src/server/auth/mail-outbox";

test.use({ serviceWorkers: "block" });
test("phone-only public UI redirects legacy email verification while existing token API stays one-use", async ({page, baseURL}) => {
  const saved = Object.fromEntries(["SMTP_HOST","SMTP_USER","SMTP_PASSWORD","SMTP_FROM","APP_ORIGIN"].map(k => [k, process.env[k]]));
  Object.assign(process.env, {
    SMTP_HOST: "smtp.invalid", SMTP_USER: "fixture", SMTP_PASSWORD: "fixture",
    SMTP_FROM: "fixture@example.test", APP_ORIGIN: baseURL!,
  });
  const f = await fixture();
  try {
    await routeBackend(page, f.app);
    await page.goto("/verify-email");
    await expect(page).toHaveURL("/");
    await expect(page.getByLabel("شماره موبایل", { exact: true })).toBeVisible();
    await expect(page.getByLabel("ایمیل حساب", { exact: true })).toHaveCount(0);
    const issued = await f.request("/api/auth/email-verification/request", { email: "t@test.dev" });
    expect(issued.statusCode).toBe(200);
    let token = "";
    await deliverNextMail(createContext(f.db), async (_to, value) => {token = value;});
    expect(token).toHaveLength(64);
    const confirmed = await f.request("/api/auth/email-verification/confirm", { token });
    expect(confirmed.statusCode).toBe(200);
    expect((await f.c("users").findOne({ email: "t@test.dev" }))?.emailVerified).toBe(true);
    const replay = await f.request("/api/auth/email-verification/confirm", { token });
    expect(replay.statusCode).toBe(400);
    for (const width of [360,390,768,1280]) {
      await page.setViewportSize({width, height: 800});
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  } finally {
    await page.unrouteAll({behavior:"wait"});
    await f.close();
    for (const [key,val] of Object.entries(saved)) {
      if (val===undefined) delete process.env[key]; else process.env[key]=val;
    }
  }
});
