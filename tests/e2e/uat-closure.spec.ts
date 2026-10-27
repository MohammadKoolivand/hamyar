import { test, expect, type Page } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";
test.use({ serviceWorkers: "block" });
async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("ایمیل یا شماره موبایل", { exact: true }).fill(email);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await expect(
    page.getByRole("button", { name: "خروج", exact: true }),
  ).toBeVisible();
}
test("TEACH-003/004/005: teacher dashboard counts real students, publication and completion after reload", async ({
  page,
}, info) => {
  const f = await fixture();
  await routeBackend(page, f.app);
  try {
    await login(page, "t@test.dev");
    const stat = (name: string) =>
      page
        .locator(".glass-stat")
        .filter({ has: page.getByText(name, { exact: true }) })
        .locator("strong");
    await expect(stat("دانش‌آموز همراه")).toHaveText("۱");
    await expect(stat("مأموریت تخصیص‌یافته")).toHaveText("۱");
    await expect(stat("مأموریت تکمیل‌شده")).toHaveText("۰");
    const m = await f.create();
    await f.post(`/api/missions/${m._id}/publish`, {}, f.teacher);
    await page.reload();
    await expect(stat("مأموریت تخصیص‌یافته")).toHaveText("۲");
    await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "2" },
      f.student,
    );
    await f.post(f.path + "/complete", {}, f.student);
    await page.reload();
    await expect(stat("مأموریت تکمیل‌شده")).toHaveText("۱");
    await page.screenshot({
      path: info.outputPath("teacher-counts.png"),
      fullPage: true,
    });
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
test("QB-013: incomplete question preserves entered form text when validation fails", async ({
  page,
}) => {
  const f = await fixture();
  await routeBackend(page, f.app);
  try {
    await login(page, "t@test.dev");
    await page.goto("/content-new");
    await page.getByRole("button", { name: "سؤال آزاد", exact: true }).click();
    await page.getByLabel("روش پاسخ", { exact: true }).selectOption("numeric");
    await page
      .getByLabel("صورت سؤال", { exact: true })
      .fill("این متن نباید پس از خطای ورودی پاک شود.");
    await page
      .getByLabel("پاسخ مرجع خصوصی", { exact: true })
      .fill("not-a-number");
    await page
      .getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "اطلاعات ورودی معتبر نیست" }),
    ).toBeVisible();
    await expect(page.getByLabel("صورت سؤال", { exact: true })).toHaveValue(
      "این متن نباید پس از خطای ورودی پاک شود.",
    );
    await expect(
      page.getByLabel("پاسخ مرجع خصوصی", { exact: true }),
    ).toHaveValue("not-a-number");
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
test("PR-035/EDGE-012: second browser context sees saved response; refresh during delayed server read stays consistent", async ({
  page,
  browser,
}) => {
  const f = await fixture();
  const context = await browser.newContext();
  await context.addInitScript(() =>
    localStorage.setItem("auth-method", "password"),
  );
  const other = await context.newPage();
  await routeBackend(page, f.app);
  await routeBackend(other, f.app);
  try {
    await login(page, "s@test.dev");
    await login(other, "s@test.dev");
    await page.goto(`/practice?assignment=${f.assignment._id}`);
    await page.getByLabel("پاسخ شما", { exact: true }).fill("2");
    await page
      .getByRole("button", { name: "ثبت و بررسی پاسخ", exact: true })
      .click();
    await expect(
      page.getByText("صحیح · بدون دریافت کمک", { exact: true }),
    ).toBeVisible();
    await other.route(
      `**/api/assignments/${f.assignment._id}`,
      async (route) => {
        await new Promise((r) => setTimeout(r, 500));
        await route.fallback();
      },
    );
    await other.goto(`/practice?assignment=${f.assignment._id}`);
    await other.reload();
    await expect(
      other.getByText("صحیح · بدون دریافت کمک", { exact: true }),
    ).toBeVisible();
    expect(
      await other.evaluate(async (path) => {
        const r = await fetch(path);
        const a = await r.json();
        return a.attempts.length;
      }, f.path),
    ).toBe(1);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await other.unrouteAll({ behavior: "wait" });
    await context.close();
    await f.close();
  }
});
test("LINK-004: invitation deep link opens in signed-in student account and binds the existing account", async ({
  page,
}) => {
  const f = await fixture();
  await routeBackend(page, f.app);
  try {
    const invite = await f.post(
      "/api/invitations",
      { email: "s@test.dev" },
      f.teacher,
    );
    await login(page, "s@test.dev");
    await page.goto(`/?invite=${invite.token}`);
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("کد دعوت معلم")).toHaveValue(invite.token);
    await page
      .getByRole("button", { name: "اتصال به معلم", exact: true })
      .click();
    await expect(
      page.getByText("اتصال به معلم انجام شد.", { exact: false }),
    ).toBeVisible();
    expect(await f.c("users").countDocuments({ email: "s@test.dev" })).toBe(1);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
