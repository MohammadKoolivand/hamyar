import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";
test.use({ serviceWorkers: "block" });

test("UAT unknown route returns 404 and reduced-motion disables transition", async ({
  page,
}) => {
  const response = await page.goto("/uat-nonexistent-route");
  expect(response?.status()).toBe(404);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const button = page.getByRole("button", { name: /^ورود به هدهده$/ });
  await expect(button).toBeVisible();
  expect(
    await button.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});

test("UAT formula options render MathML, invalid formula stays readable and hostile HTML remains text", async ({
  page,
}) => {
  const f = await fixture();
  try {
    const q = await f.post(
      "/api/questions",
      {
        classification: "free",
        statement:
          "عبارت $x+x$ را ساده کنید. <script>window.__uatXss=1</script>",
        type: "choice",
        options: ["$x^2$", "$2x$", "$x$", "$\\href{javascript:alert(1)}{bad}$"],
        reference: "$2x$",
      },
      f.teacher,
    );
    const mission = await f.post(
      "/api/missions",
      {
        title: "فرمول گزینه‌ها",
        studentId: f.assignment.studentId,
        questionVersionIds: [q._id],
        policy: {
          maxAttempts: 2,
          maxHints: 0,
          independent: true,
          feedbackMode: "immediate",
        },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${mission._id}/publish`, {}, f.teacher);
    const a = await f.c("assignments").findOne({ missionId: mission._id });
    await routeBackend(page, f.app);
    await page.goto("/");
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill("s@test.dev");
    await page.getByLabel("رمز عبور").fill("StrongPass123!");
    await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    await page.goto(`/practice?assignment=${a!._id}`);
    await expect(page.locator(".practice-sheet math")).toHaveCount(1);
    await expect(page.locator("fieldset math")).toHaveCount(3);
    await expect(
      page.getByText("فرمول نامعتبر:", { exact: false }),
    ).toBeVisible();
    expect(await page.evaluate(() => Object.hasOwn(window, "__uatXss"))).toBe(
      false,
    );
    expect(await page.locator('a[href^="javascript:"]').count()).toBe(0);
    const radio = page.getByRole("radio").nth(1);
    await radio.focus();
    await page.keyboard.press("Space");
    await expect(radio).toBeChecked();
    await page
      .getByRole("button", { name: "ثبت و بررسی پاسخ", exact: true })
      .click();
    await expect(
      page.getByText("صحیح · بدون دریافت کمک", { exact: true }),
    ).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});

test("UAT remembered session survives closing and relaunching a real persistent Chrome profile", async ({
  baseURL,
}) => {
  const { chromium } = await import("@playwright/test");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const f = await fixture();
  const profile = await mkdtemp(join(tmpdir(), "hodhod-uat-browser-"));
  let context;
  try {
    const options = {
      headless: true,
      baseURL,
      executablePath: process.env.CHROME_PATH,
      serviceWorkers: "block" as const,
    };
    context = await chromium.launchPersistentContext(profile, options);
    await context.addInitScript(() =>
      localStorage.setItem("auth-method", "password"),
    );
    let page = await context.newPage();
    await routeBackend(page, f.app);
    await page.goto("/");
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill("s@test.dev");
    await page.getByLabel("رمز عبور").fill("StrongPass123!");
    await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    const before = await f.c("sessions").countDocuments();
    await context.close();
    context = await chromium.launchPersistentContext(profile, options);
    page = await context.newPage();
    await routeBackend(page, f.app);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    expect(await f.c("sessions").countDocuments()).toBe(before);
  } finally {
    await context?.close();
    await f.close();
    await rm(profile, { recursive: true, force: true });
  }
});
