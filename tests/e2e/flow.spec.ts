import { test, expect } from "@playwright/test";
const pass = "StrongPass123!";
test("UI: teacher creates content and invite; student solves; both see evidence", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = Date.now(),
    teacher = `teacher${suffix}@test.dev`,
    student = `student${suffix}@test.dev`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("سارا احمدی");
  await page.getByLabel("ایمیل", { exact: true }).fill(teacher);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await page.getByRole("button", { name: "ورود به همیار" }).click();
  await expect(
    page.getByRole("heading", { name: "نمای کلی", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await page.getByLabel("نوع", { exact: true }).selectOption("subject");
  await page.getByLabel("عنوان", { exact: true }).fill("ریاضی آزمایشی");
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page.getByLabel("نوع", { exact: true }).selectOption("topic");
  await page.getByLabel("عنوان", { exact: true }).fill("جمع ساده");
  await page
    .getByLabel("زیرمجموعه")
    .selectOption({ label: "ریاضی آزمایشی (subject)" });
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page
    .getByLabel("مبحث", { exact: true })
    .selectOption({ label: "جمع ساده" });
  await page.getByLabel("صورت سؤال").fill("حاصل یک به علاوه یک چیست؟");
  await page.getByLabel("پاسخ مرجع خصوصی").fill("2");
  await page
    .getByLabel("راهنمایی‌های تأییدشده")
    .fill("از عدد یک، یک گام جلو برو.");
  await page.getByRole("button", { name: "تأیید و ذخیره سؤال" }).click();
  await expect(page.getByText("بانک سؤال خصوصی · ۱ سؤال")).toBeVisible();
  await page.getByRole("button", { name: "دانش‌آموزان", exact: true }).click();
  await page.getByLabel("ایمیل دانش‌آموز").fill(student);
  await page.getByRole("button", { name: "ایجاد دعوت" }).click();
  const token = await page.getByTestId("invitation-token").innerText();
  expect(token).toHaveLength(48);
  const studentContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    sp = await studentContext.newPage();
  sp.on("pageerror", (e) => errors.push(e.message));
  await sp.goto(`/?invite=${token}`);
  await sp.getByLabel("نام و نام خانوادگی").fill("آراد محمدی");
  await sp.getByLabel("ایمیل", { exact: true }).fill(student);
  await sp.getByLabel("رمز عبور").fill(pass);
  await sp.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(sp.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await sp.getByRole("button", { name: "ورود به همیار" }).click();
  await expect(
    sp.getByRole("heading", { name: "مسیر یادگیری من", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "به‌روزرسانی فهرست" }).click();
  await expect(page.getByRole("heading", { name: "آراد محمدی" })).toBeVisible();
  await page.getByRole("button", { name: "مأموریت‌ها", exact: true }).click();
  await page.getByLabel("عنوان مأموریت").fill("اولین گام یادگیری");
  await page
    .getByLabel("دانش‌آموز", { exact: true })
    .selectOption({ label: "آراد محمدی" });
  await page.getByText("حاصل یک به علاوه یک چیست؟", { exact: true }).click();
  await page.getByRole("button", { name: "ساخت پیش‌نویس مأموریت" }).click();
  await page.getByRole("button", { name: "انتشار برای دانش‌آموز" }).click();
  await expect(
    page.getByRole("button", { name: "گزارش و شواهد" }),
  ).toBeVisible();
  await sp.reload();
  await sp.getByRole("button", { name: "مأموریت‌های من", exact: true }).click();
  await sp.getByRole("button", { name: "شروع / ادامه تمرین" }).click();
  await expect(
    sp.getByText("حاصل یک به علاوه یک چیست؟", { exact: true }),
  ).toBeVisible();
  await sp.getByLabel("پاسخ شما", { exact: true }).fill("1");
  await sp.getByRole("button", { name: "ثبت و بررسی پاسخ" }).click();
  await expect(sp.getByText("نیازمند اصلاح · بدون دریافت کمک")).toBeVisible();
  await sp.getByRole("button", { name: "درخواست راهنمایی" }).click();
  await expect(sp.getByText("از عدد یک، یک گام جلو برو.")).toBeVisible();
  await sp.getByLabel("پاسخ شما", { exact: true }).fill("۲");
  await sp.getByRole("button", { name: "ثبت و بررسی پاسخ" }).click();
  await expect(sp.getByText("صحیح · با دریافت کمک")).toBeVisible();
  await sp
    .getByRole("button", { name: "پایان مأموریت و دریافت گزارش" })
    .click();
  await expect(
    sp.getByText(
      "از ۱ سؤال، ۰ سؤال بدون راهنمایی و ۱ سؤال با راهنمایی درست حل شده است.",
    ),
  ).toBeVisible();
  await expect(sp.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await sp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await sp.screenshot({
    path: testInfo.outputPath("student-report-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "گزارش و شواهد" }).click();
  await expect(
    page.getByRole("heading", { name: "شواهد تلاش‌ها و بازبینی" }),
  ).toBeVisible();
  await expect(page.getByText("Evidence:", { exact: false })).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("teacher-report-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await studentContext.close();
});

test("PWA shell works offline without caching private API data", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const urls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) urls.push(req.url);
    }
    return urls;
  });
  expect(urls.some((u) => new URL(u).pathname.startsWith("/api/"))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await context.setOffline(false);
});

test("Next Node.js API preserves private response and payload limits", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");
  const privateResponse = await request.get("/api/auth/me");
  expect(privateResponse.status()).toBe(401);
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  const oversized = await request.post("/api/auth/register", {
    data: {
      name: "x".repeat(70000),
      email: "oversized@test.dev",
      password: "StrongPass123!",
    },
  });
  expect(oversized.status()).toBe(413);
});

test("local Persian and Latin fonts load and layout uses Tailwind utilities", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "خوش آمدید" }).waitFor();
  const fonts = await page.evaluate(async () => {
    const style = getComputedStyle(document.documentElement);
    const persian = style.getPropertyValue("--font-persian"),
      latin = style.getPropertyValue("--font-latin");
    const loaded = await Promise.all([
      document.fonts.load(`16px ${persian}`, "سلام"),
      document.fonts.load(`16px ${latin}`, "Hello"),
    ]);
    return loaded.map((entries) => entries.length);
  });
  expect(fonts.every((count) => count > 0)).toBe(true);
  await expect(page.locator("main[style], main [style]")).toHaveCount(0);
  await expect(page.locator("section").first()).toHaveClass(/backdrop-blur/);
});
