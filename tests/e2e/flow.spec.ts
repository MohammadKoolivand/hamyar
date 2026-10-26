import { chooseTopic, chooseParent } from "./curriculum-helpers";
import { test, expect } from "@playwright/test";
const pass = "StrongPass123!";
test("UI: teacher creates content and invite; student solves; both see evidence", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = Date.now(),
    teacher = `teacher${suffix}@test.dev`,
    student = `091${String(suffix).slice(-8)}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("سارا احمدی");
  await page.getByLabel("ایمیل یا شماره موبایل", { exact: true }).fill(teacher);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await expect(
    page.getByRole("heading", { name: "نمای کلی", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".glass-hero")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("glass-teacher-dashboard.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await page.getByRole("button", { name: "منابع آموزشی", exact: true }).click();
  await page
    .getByRole("heading", { name: "ساختار آموزشی شما", exact: true })
    .click();
  await page.getByLabel("نوع", { exact: true }).selectOption("subject");
  await page.getByLabel("عنوان", { exact: true }).fill("ریاضی آزمایشی");
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page.getByLabel("نوع", { exact: true }).selectOption("topic");
  await page.getByLabel("عنوان", { exact: true }).fill("جمع ساده");
  const structureNodes = await (
    await page.request.get("/api/curriculum")
  ).json();
  await chooseParent(
    page,
    structureNodes.find((n: { title: string }) => n.title === "ریاضی آزمایشی")
      ._id,
  );
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page.getByLabel("نوع", { exact: true }).selectOption("skill");
  await page.getByLabel("عنوان", { exact: true }).fill("حل مستقل");
  const topicNodes = await (await page.request.get("/api/curriculum")).json();
  const simpleTopic = topicNodes.find(
    (n: { title: string }) => n.title === "جمع ساده",
  );
  await chooseParent(page, simpleTopic._id);
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await chooseTopic(page, simpleTopic._id);
  await page.getByLabel("حل مستقل", { exact: true }).check();
  await page.getByLabel("صورت سؤال").fill("حاصل یک به علاوه یک چیست؟");
  await page.getByLabel("پاسخ مرجع خصوصی").fill("2");
  await page
    .getByLabel("راهنمایی‌های تأییدشده")
    .fill("از عدد یک، یک گام جلو برو.");
  await page.getByRole("button", { name: "تأیید و ذخیره سؤال" }).click();
  await expect(page.getByText("بانک سؤال خصوصی · ۱ سؤال")).toBeVisible();
  await page.getByLabel("روش پاسخ").selectOption("symbolic");
  await page.getByLabel("صورت سؤال").fill("عبارت هم‌ارز با x+x را بنویسید.");
  await page.getByLabel("پاسخ مرجع خصوصی").fill("2*x");
  await page.getByLabel("متغیرهای مجاز").fill("x");
  await page.getByRole("button", { name: "تأیید و ذخیره سؤال" }).click();
  await expect(page.getByText("بانک سؤال خصوصی · ۲ سؤال")).toBeVisible();

  await page.getByRole("button", { name: "دانش‌آموزان", exact: true }).click();
  await page.getByLabel("شماره موبایل دانش‌آموز").fill(student);
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
  await sp.getByLabel("شماره موبایل دعوت‌شده", { exact: true }).fill(student);
  await sp.getByLabel("رمز عبور").fill(pass);
  await sp.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(sp.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await sp.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await expect(
    sp.getByRole("heading", { name: "مسیر یادگیری من", exact: true }),
  ).toBeVisible();
  await sp.screenshot({
    path: testInfo.outputPath("glass-student-dashboard.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "به‌روزرسانی فهرست" }).click();
  await expect(page.getByRole("heading", { name: "آراد محمدی" })).toBeVisible();
  await page.getByRole("button", { name: "مأموریت‌ها", exact: true }).click();
  await page.getByLabel("عنوان مأموریت").fill("اولین گام یادگیری");
  await page
    .getByLabel("زمان نمایش نتیجه به دانش‌آموز")
    .selectOption("immediate");
  await page
    .getByLabel("دانش‌آموز", { exact: true })
    .selectOption({ label: "آراد محمدی" });
  await page.getByText("حاصل یک به علاوه یک چیست؟", { exact: true }).click();
  await page.getByRole("button", { name: "ساخت پیش‌نویس مأموریت" }).click();
  await page.getByRole("button", { name: "انتشار برای دانش‌آموز" }).click();
  await expect(
    page.getByRole("button", { name: "گزارش و شواهد" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("glass-teacher-missions.png"),
    fullPage: true,
  });
  await sp.reload();
  await expect(sp.getByTestId("legacy-missions")).toBeVisible();
  await expect(
    sp.getByTestId("legacy-missions").getByText("اولین گام یادگیری"),
  ).toBeVisible();
  await sp.screenshot({
    path: testInfo.outputPath("student-dashboard-legacy-mobile.png"),
    fullPage: true,
  });
  await sp.getByRole("button", { name: "مأموریت‌های من", exact: true }).click();
  await sp.getByRole("button", { name: "شروع / ادامه تمرین" }).click();
  await expect(
    sp.getByText("حاصل یک به علاوه یک چیست؟", { exact: true }),
  ).toBeVisible();
  await expect(sp.locator(".practice-sheet")).toBeVisible();
  await sp.screenshot({
    path: testInfo.outputPath("glass-student-practice.png"),
    fullPage: true,
  });
  await sp.getByLabel("پاسخ شما", { exact: true }).fill("1");
  // Unsaved input survives feature unmount and a full page reload.
  await sp
    .getByRole("button", { name: "مسیر یادگیری من", exact: true })
    .click();
  await sp.getByRole("button", { name: "مأموریت‌های من", exact: true }).click();
  await sp.getByRole("button", { name: "شروع / ادامه تمرین" }).click();
  await expect(sp.getByLabel("پاسخ شما", { exact: true })).toHaveValue("1");
  await sp.reload();
  await sp.getByRole("button", { name: "مأموریت‌های من", exact: true }).click();
  await sp.getByRole("button", { name: "شروع / ادامه تمرین" }).click();
  await expect(sp.getByLabel("پاسخ شما", { exact: true })).toHaveValue("1");
  await sp.setViewportSize({ width: 360, height: 800 });
  expect(
    await sp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await sp.getByLabel("پاسخ شما", { exact: true }).focus();
  await sp.keyboard.press("Tab");
  await expect(
    sp.getByRole("button", { name: "ثبت و بررسی پاسخ" }),
  ).toBeFocused();

  await sp.getByRole("button", { name: "ثبت و بررسی پاسخ" }).click();
  await expect(sp.getByText("نیازمند اصلاح · بدون دریافت کمک")).toBeVisible();
  await sp.getByRole("button", { name: "درخواست راهنمایی" }).click();
  await expect(sp.getByText("از عدد یک، یک گام جلو برو.")).toBeVisible({
    timeout: 35000,
  });
  await sp.getByLabel("پاسخ شما", { exact: true }).fill("۲");
  await sp.getByRole("button", { name: "ثبت و بررسی پاسخ" }).click();
  await expect(sp.getByText("صحیح · با دریافت کمک")).toBeVisible();
  await sp.getByRole("button", { name: "پایان تمرین و گزارش" }).click();
  await expect(
    sp.getByText(
      "پاسخ با دریافت راهنما صحیح شده؛ یک سؤال مشابه را بدون کمک حل کنید تا استقلال یادگیری بررسی شود.",
      { exact: true },
    ),
  ).toBeVisible();
  const reportId = new URL(sp.url()).searchParams.get("assignment");
  const actualReport = await (
    await sp.request.get(`/api/assignments/${reportId}/report`)
  ).json();
  expect(actualReport.independent).toBe(0);
  expect(actualReport.assisted).toBe(1);
  expect(actualReport.questions).toHaveLength(1);
  await expect(sp.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await sp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await sp.screenshot({
    path: testInfo.outputPath("student-report-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "گزارش و شواهد" }).click();
  await page.getByText("تاریخچه تلاش‌ها و بازبینی معلم", { exact: true }).click();
  await expect(page.getByText("تلاش ۱:", { exact: false })).toBeVisible();
  await expect(page.getByText("تلاش ۲:", { exact: false })).toBeVisible();
  const teacherReport = await (await page.request.get(`/api/assignments/${reportId}/report`)).json();
  expect(teacherReport.evidence).toHaveLength(2);
  await page.screenshot({
    path: testInfo.outputPath("teacher-report-desktop.png"),
    fullPage: true,
  });
  await sp.getByRole("button", { name: "یادگیری و مرور", exact: true }).click();
  await expect(
    sp.getByRole("heading", { name: "دفترچه اشتباهات", exact: true }),
  ).toBeVisible();
  await expect(
    sp.getByRole("heading", { name: "حل مستقل", exact: true }),
  ).toBeVisible();
  await expect(sp.getByText("نیازمند تمرین", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "یادگیری و مرور", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "مقایسه مأموریت‌ها" }),
  ).toBeVisible();
  await page
    .getByLabel("دلیل تصمیم معلم")
    .fill("جلسه بعد یک سنجش مستقل دیگر لازم است.");
  await page.getByRole("button", { name: "ثبت تصمیم و تاریخچه" }).click();
  await expect(page.getByText("تصمیم معلم:", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await page
    .getByLabel("پاسخ مرجع خصوصی")
    .fill("UNPUBLISHED_PRIVATE_REFERENCE");
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await expect(
    page.getByLabel("ایمیل یا شماره موبایل", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("ایمیل یا شماره موبایل", { exact: true }).fill(teacher);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await expect(page.getByLabel("پاسخ مرجع خصوصی")).toHaveValue("");
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

test("licensed local fonts load and layout uses Tailwind utilities", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "خوش آمدید" }).waitFor();
  const fonts = await page.evaluate(async () => {
    const style = getComputedStyle(document.documentElement);
    const latin = style.getPropertyValue("--font-latin");
    const persian = style.getPropertyValue("--font-persian");
    const loaded = await Promise.all([
      document.fonts.load(`16px ${latin}`, "Hello"),
      document.fonts.load(`16px ${persian}`, "سلام"),
    ]);
    return loaded.map((entries) => entries.length);
  });
  expect(fonts.every((count) => count > 0)).toBe(true);
  await expect(page.locator("main[style], main [style]")).toHaveCount(0);
  const panel = page.locator(".glass-panel").first();
  await expect(panel).toBeVisible();
  const blur = await panel.evaluate(
    (el) => getComputedStyle(el).backdropFilter,
  );
  expect(blur).toContain("blur(");
});

test("real AI question draft → teacher edit/approve or reject; parent read-only portal", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const health = await request.get("/api/health");
  test.skip(
    !(await health.json()).ai.configured.startsWith("ollama"),
    "Real authoring requires configured Ollama; never substitute mock",
  );
  const suffix = Date.now(),
    teacher = `author${suffix}@test.dev`,
    student = `092${String(suffix).slice(-8)}`,
    parent = `093${String(suffix).slice(-8)}`;
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم تولید سؤال");
  await page.getByLabel("ایمیل یا شماره موبایل", { exact: true }).fill(teacher);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await page.getByRole("button", { name: "منابع آموزشی", exact: true }).click();
  await page
    .getByRole("heading", { name: "ساختار آموزشی شما", exact: true })
    .click();
  await page.getByLabel("نوع", { exact: true }).selectOption("topic");
  await page.getByLabel("عنوان", { exact: true }).fill("جمع در پایه دوم");
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await page
    .getByRole("button", { name: "با هوش مصنوعی", exact: true })
    .click();
  await page.getByLabel("پایه تولید سؤال").selectOption("ungraded");
  await page.getByLabel("درس یا کتاب تولید سؤال").selectOption("unassigned");
  await page.getByLabel("فصل تولید سؤال").selectOption("unchaptered");
  await page
    .getByLabel("مبحث تولید سؤال")
    .selectOption({ label: "جمع در پایه دوم" });
  await page
    .getByLabel("حوزه، پایه و هدف سؤال")
    .fill(
      "فقط یک سؤال جمع دو عدد تک‌رقمی مناسب پایه دوم ابتدایی ایران، پاسخ مرجع فقط یک عدد باشد.",
    );
  await page.getByRole("button", { name: "تولید پیش‌نویس سؤال" }).click();
  await expect(page.getByLabel("صورت سؤال پیشنهادی")).toBeVisible({
    timeout: 100000,
  });
  await expect(page.getByText("بانک سؤال خصوصی · ۰ سؤال")).toBeVisible();
  await page
    .getByLabel("صورت سؤال پیشنهادی")
    .fill("حاصل سه به اضافه چهار چیست؟");
  await page.getByLabel("پاسخ مرجع پیشنهادی خصوصی").fill("7");
  await page.getByRole("checkbox", { name: "صحت سؤال و پاسخ مرجع" }).check();
  await page
    .getByRole("button", { name: "تأیید و افزودن به بانک سؤال" })
    .click();
  await expect(page.getByText("بانک سؤال خصوصی · ۱ سؤال")).toBeVisible();
  await page.getByRole("button", { name: "تولید پیش‌نویس سؤال" }).click();
  await expect(page.getByLabel("دلیل رد پیش‌نویس")).toBeVisible({
    timeout: 100000,
  });
  await page
    .getByLabel("دلیل رد پیش‌نویس")
    .fill("نیاز به تناسب بیشتر با هدف آموزشی");
  await page.getByRole("button", { name: "رد پیش‌نویس", exact: true }).click();
  await expect(page.getByText("پیش‌نویس رد شد.")).toBeVisible();
  await expect(page.getByText("بانک سؤال خصوصی · ۱ سؤال")).toBeVisible();
  await page.getByRole("button", { name: "دانش‌آموزان", exact: true }).click();
  await page
    .getByLabel("شماره موبایل دانش‌آموز", { exact: true })
    .fill(student);
  await page.getByRole("button", { name: "ایجاد دعوت", exact: true }).click();
  const token = await page.getByTestId("invitation-token").innerText();
  const sc = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    sp = await sc.newPage();
  await sp.goto(`/?invite=${token}`);
  await sp.getByLabel("نام و نام خانوادگی").fill("دانش‌آموز آزمایشی");
  await sp.getByLabel("شماره موبایل دعوت‌شده", { exact: true }).fill(student);
  await sp.getByLabel("رمز عبور").fill(pass);
  await sp.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(sp.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await page
    .getByRole("button", { name: "به‌روزرسانی فهرست", exact: true })
    .click();
  await sp.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await page.getByRole("button", { name: "مأموریت‌ها", exact: true }).click();
  await page.getByLabel("عنوان مأموریت").fill("تمرین با سؤال تأییدشده");
  await page.getByLabel("زمان نمایش نتیجه به دانش‌آموز").selectOption("immediate");
  await page
    .getByLabel("دانش‌آموز", { exact: true })
    .selectOption({ label: "دانش‌آموز آزمایشی" });
  await page.getByText("حاصل سه به اضافه چهار چیست؟", { exact: true }).click();
  await page.getByRole("button", { name: "ساخت پیش‌نویس مأموریت" }).click();
  await page.getByRole("button", { name: "انتشار برای دانش‌آموز" }).click();
  await expect(
    page.getByRole("button", { name: "گزارش و شواهد" }),
  ).toBeVisible();
  await sp.reload();
  await sp.getByRole("button", { name: "مأموریت‌های من", exact: true }).click();
  await sp.getByRole("button", { name: "شروع / ادامه تمرین" }).click();
  await sp.getByLabel("پاسخ شما", { exact: true }).fill("7");
  await sp.getByRole("button", { name: "ثبت و بررسی پاسخ" }).click();
  await expect(sp.getByText("صحیح · بدون دریافت کمک")).toBeVisible();
  await sp.getByRole("button", { name: "پایان تمرین و گزارش" }).click();
  await expect(sp.getByText(/۱ پاسخ صحیح مستقل و ۰ پاسخ صحیح با راهنما/)).toBeVisible();
  await page.getByRole("button", { name: "دانش‌آموزان", exact: true }).click();
  await page.getByText("دسترسی اولیا", { exact: true }).click();
  await page.getByLabel("شماره موبایل ولی دانش‌آموز").fill(parent);
  await page.getByRole("button", { name: "ایجاد دعوت اولیا" }).click();
  const invite = await page.getByTestId("parent-invitation-token").innerText();
  const pc = await browser.newContext({
      viewport: { width: 360, height: 800 },
    }),
    pp = await pc.newPage();
  await pp.goto(invite);
  await pp.getByLabel("نام و نام خانوادگی").fill("ولی آزمایشی");
  await pp.getByLabel("شماره موبایل دعوت‌شده", { exact: true }).fill(parent);
  await pp.getByLabel("رمز عبور").fill(pass);
  await pp.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await pp.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await expect(pp.getByRole("heading", { name: "پنل اولیا" })).toBeVisible();
  await expect(pp.getByLabel("انتخاب فرزند")).toHaveValue(/.+/);
  await expect(
    pp.getByRole("heading", { name: "دفترچه اشتباهات" }),
  ).toBeVisible();
  await expect(
    pp.getByText("صحیح بدون کمک", { exact: true }).locator(".."),
  ).toContainText("۱");
  await expect(
    pp.getByRole("button", { name: "ثبت و بررسی پاسخ" }),
  ).toHaveCount(0);
  expect(
    await pp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "به‌روزرسانی اولیا" }).click();
  await page.getByRole("button", { name: "لغو دسترسی این ولی" }).click();
  await pp.reload();
  await expect(
    pp.getByText(
      "پس از پذیرش دعوت معتبر معلم، گزارش فرزند اینجا نمایش داده می‌شود.",
    ),
  ).toBeVisible();
  await pc.close();
  await sc.close();
});

test("public login uses bright frosted-glass surfaces", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const panel = page.locator(".glass-panel").first();
  await expect(panel).toBeVisible();
  const styles = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { backdrop: cs.backdropFilter, background: cs.backgroundImage };
  });
  expect(styles.backdrop).toContain("blur(");
  expect(styles.background).not.toBe("none");
  const bodyBackground = await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bodyBackground).toContain("radial-gradient");
  await page.screenshot({
    path: testInfo.outputPath("glass-login-desktop.png"),
    fullPage: true,
  });
});

test("student registers without invitation and later joins teacher with existing account", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = Date.now();
  const studentEmail = `094${String(suffix).slice(-8)}`;
  const teacherEmail = `mentor-${suffix}@test.dev`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام دانش‌آموز" }).click();
  await expect(
    page.getByRole("heading", { name: "ساخت حساب دانش‌آموز" }),
  ).toBeVisible();
  await expect(page.getByLabel("کد دعوت معلم")).toHaveCount(0);
  await page.getByLabel("نام و نام خانوادگی").fill("دانش‌آموز مستقل");
  await page
    .getByLabel("ایمیل یا شماره موبایل", { exact: true })
    .fill(studentEmail);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await expect(
    page.getByRole("heading", { name: "مسیر یادگیری من" }),
  ).toBeVisible();
  await expect(
    page.getByText("هنوز مأموریتی نداری.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "اتصال به معلم" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("independent-student-mobile.png"),
    fullPage: true,
  });

  const teacherContext = await browser.newContext();
  try {
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/");
    await teacherPage.getByRole("button", { name: "ثبت‌نام معلم" }).click();
    await teacherPage.getByLabel("نام و نام خانوادگی").fill("معلم آزمایشی");
    await teacherPage
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill(teacherEmail);
    await teacherPage.getByLabel("رمز عبور").fill(pass);
    await teacherPage
      .getByRole("button", { name: "ساخت حساب", exact: true })
      .click();
    await teacherPage.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await teacherPage
      .getByRole("button", { name: "درس‌های من", exact: true })
      .click();
    await teacherPage.getByLabel("نام درس").fill("ریاضی");
    await teacherPage.getByLabel("عنوان دوره").fill("ریاضی آزمایشی");
    await teacherPage.getByRole("button", { name: "ایجاد درس" }).click();
    await expect(
      teacherPage.getByRole("heading", { name: "ریاضی آزمایشی" }),
    ).toBeVisible();
    await teacherPage
      .getByRole("button", { name: "دانش‌آموزان", exact: true })
      .click();
    await teacherPage.getByLabel("شماره موبایل دانش‌آموز").fill(studentEmail);
    await teacherPage
      .getByLabel("درس دعوت")
      .selectOption({ label: "ریاضی آزمایشی · ریاضی" });
    await teacherPage.getByRole("button", { name: "ایجاد دعوت" }).click();
    const invite = await teacherPage
      .getByTestId("invitation-token")
      .innerText();

    await page.getByLabel("کد دعوت معلم").fill(invite);
    await page
      .getByRole("button", { name: "اتصال به معلم", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .getByText("اتصال به معلم انجام شد.", { exact: false }),
    ).toBeVisible();
    await teacherPage
      .getByRole("button", { name: "به‌روزرسانی فهرست" })
      .click();
    await expect(
      teacherPage.getByRole("heading", { name: "دانش‌آموز مستقل" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "مسیر یادگیری من" }),
    ).toBeVisible();
    await expect(page.getByTestId("student-course-card")).toHaveCount(1);
    await expect(
      page
        .getByTestId("student-course-card")
        .getByRole("heading", { name: "ریاضی آزمایشی" }),
    ).toBeVisible();
    await page
      .getByLabel("نمایش درس")
      .selectOption({ label: "ریاضی آزمایشی · معلم آزمایشی" });
    await expect(page.getByTestId("student-course-card")).toHaveCount(1);
    await expect(
      page.getByText("هنوز مأموریتی برای این درس منتشر نشده است."),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("student-dashboard-course-mobile.png"),
      fullPage: true,
    });
    await expect(page.getByLabel("کد دعوت معلم")).toHaveValue("");
    await page.getByRole("button", { name: "درس‌های من", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "ریاضی آزمایشی" }),
    ).toBeVisible();
    await expect(page.getByText("معلم: معلم آزمایشی")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("student-after-teacher-link-mobile.png"),
      fullPage: true,
    });
  } finally {
    await teacherContext.close();
  }
});

test("student requests a course, teacher approves, and leaving keeps history", async ({
  page,
  browser,
}, testInfo) => {
  const unique = Date.now() + "-" + Math.floor(Math.random() * 10000);
  const teacherEmail = `course-teacher-${unique}@test.dev`;
  const studentEmail = `course-student-${unique}@test.dev`;
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام معلم" }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم دوره");
  await page
    .getByLabel("ایمیل یا شماره موبایل", { exact: true })
    .fill(teacherEmail);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await page.getByRole("button", { name: "درس‌های من", exact: true }).click();
  await page.getByLabel("نام درس").fill("ریاضی");
  await page.getByLabel("عنوان دوره").fill("دوره درخواست عضویت");
  await page.getByRole("button", { name: "ایجاد درس" }).click();
  await page.getByRole("button", { name: "صدور / تغییر کد درخواست" }).click();
  const code = (await page.getByTestId("course-join-code").innerText()).trim();
  expect(code).toHaveLength(48);

  const studentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const student = await studentContext.newPage();
    await student.goto("/");
    await student.getByRole("button", { name: "ثبت‌نام دانش‌آموز" }).click();
    await student
      .getByLabel("نام و نام خانوادگی")
      .fill("دانش‌آموز درخواست‌کننده");
    await student
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill(studentEmail);
    await student.getByLabel("رمز عبور").fill(pass);
    await student
      .getByRole("button", { name: "ساخت حساب", exact: true })
      .click();
    await student.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await student
      .getByRole("button", { name: "درس‌های من", exact: true })
      .click();
    await student.getByLabel("کد درخواست عضویت").fill(code);
    await student.getByRole("button", { name: "ارسال درخواست" }).click();
    await expect(
      student.getByText("درخواست ثبت شد؛ منتظر تأیید معلم باشید."),
    ).toBeVisible();
    await expect(
      student.getByText("دوره درخواست عضویت · در انتظار تأیید"),
    ).toBeVisible();
    await expect(
      student.getByRole("heading", { name: "دوره درخواست عضویت" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "نمای کلی", exact: true }).click();
    await page.getByRole("button", { name: "درس‌های من", exact: true }).click();
    await expect(page.getByText("دانش‌آموز درخواست‌کننده")).toBeVisible();
    await page.getByRole("button", { name: "تأیید عضویت" }).click();
    await expect(page.getByText("عضویت تأیید شد.")).toBeVisible();

    await student.reload();
    await student
      .getByRole("button", { name: "درس‌های من", exact: true })
      .click();
    await expect(
      student.getByRole("heading", { name: "دوره درخواست عضویت" }),
    ).toBeVisible();
    await student.screenshot({
      path: testInfo.outputPath("course-membership-approved-mobile.png"),
      fullPage: true,
    });
    student.once("dialog", (dialog) => void dialog.accept());
    await student.getByRole("button", { name: "خروج از درس" }).click();
    await expect(
      student.getByRole("heading", { name: "تاریخچه عضویت‌های پایان‌یافته" }),
    ).toBeVisible();
    await student.screenshot({
      path: testInfo.outputPath("course-membership-ended-mobile.png"),
      fullPage: true,
    });
  } finally {
    await studentContext.close();
  }
});

test("teacher publishes one group assignment to two students and sees separate reports", async ({
  page,
  browser,
}, testInfo) => {
  const stamp = Date.now();
  const teacherEmail = `group-teacher-${stamp}@test.dev`;
  const students = [
    { email: `group-first-${stamp}@test.dev`, name: "دانش‌آموز اول" },
    { email: `group-second-${stamp}@test.dev`, name: "دانش‌آموز دوم" },
  ];
  const req = page.context().request;
  const register = await req.post("/api/auth/register", {
    data: {
      email: teacherEmail,
      name: "معلم گروه",
      password: pass,
      role: "teacher",
    },
  });
  expect(register.ok()).toBe(true);
  expect(
    (
      await req.post("/api/auth/login", {
        data: { email: teacherEmail, password: pass },
      })
    ).ok(),
  ).toBe(true);
  const courseResponse = await req.post("/api/courses", {
    data: { title: "ریاضی پایه دهم", subject: "ریاضی" },
  });
  expect(courseResponse.ok()).toBe(true);
  const course = await courseResponse.json();
  const topicResponse = await req.post("/api/curriculum", {
    data: { title: "جمع گروهی", kind: "topic" },
  });
  expect(topicResponse.ok()).toBe(true);
  const topic = await topicResponse.json();
  const questionResponse = await req.post("/api/questions", {
    data: {
      topicId: topic._id,
      statement: "حاصل یک به علاوه یک؟",
      type: "numeric",
      reference: "2",
      hints: ["دو عدد را جمع کن."],
    },
  });
  expect(questionResponse.ok()).toBe(true);

  const contexts = [];
  try {
    for (const person of students) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      contexts.push(context);
      const r = await context.request.post("/api/auth/register", {
        data: { ...person, password: pass, role: "student" },
      });
      expect(r.ok()).toBe(true);
      expect(
        (
          await context.request.post("/api/auth/login", {
            data: { email: person.email, password: pass },
          })
        ).ok(),
      ).toBe(true);
      const invitation = await req.post("/api/invitations", {
        data: { email: person.email, courseId: course._id },
      });
      expect(invitation.ok()).toBe(true);
      const token = (await invitation.json()).token;
      expect(
        (
          await context.request.post("/api/invitations/claim", {
            data: { token },
          })
        ).ok(),
      ).toBe(true);
    }
    await page.goto("/");
    await page.getByRole("button", { name: "کلاس‌های گروهی" }).click();
    await page.getByLabel("عنوان کلاس").fill("دهم الف");
    await page.getByLabel("درس کلاس").selectOption({ label: "ریاضی پایه دهم" });
    await page.getByRole("checkbox", { name: students[0].name }).check();
    await page.getByRole("checkbox", { name: students[1].name }).check();
    await page.getByRole("button", { name: "ایجاد کلاس" }).click();
    await expect(page.getByRole("heading", { name: "دهم الف" })).toBeVisible();
    await page.getByLabel("کلاس مقصد").selectOption({ label: "دهم الف" });
    await page.getByLabel("عنوان مأموریت").fill("تکلیف گروهی ریاضی");
    await page
      .getByLabel("زمان نمایش نتیجه به دانش‌آموز")
      .selectOption("immediate");
    await page.getByRole("checkbox", { name: "حاصل یک به علاوه یک؟" }).check();
    await page.getByRole("button", { name: "ساخت پیش‌نویس گروهی" }).click();
    await page
      .getByRole("button", { name: "انتشار برای تمام اعضای کلاس" })
      .click();
    await expect(
      page.getByText("مأموریت برای همه دانش‌آموزان کلاس منتشر شد."),
    ).toBeVisible();

    const firstPage = await contexts[0].newPage();
    const secondPage = await contexts[1].newPage();
    await firstPage.goto("/");
    await secondPage.goto("/");
    await firstPage.getByRole("button", { name: "مأموریت‌های من" }).click();
    await secondPage.getByRole("button", { name: "مأموریت‌های من" }).click();
    await expect(firstPage.getByText("تکلیف گروهی ریاضی")).toBeVisible();
    await expect(secondPage.getByText("تکلیف گروهی ریاضی")).toBeVisible();
    await firstPage.getByRole("button", { name: "شروع / ادامه تمرین" }).click();
    await firstPage.getByLabel("پاسخ شما").fill("2");
    await firstPage.getByRole("button", { name: "ثبت و بررسی پاسخ" }).click();
    await expect(firstPage.getByText("صحیح · بدون دریافت کمک")).toBeVisible();

    await page
      .getByRole("button", { name: "نمایش / به‌روزرسانی گزارش گروه" })
      .click();
    const report = page.getByTestId("class-group-report");
    await expect(report).toBeVisible();
    await expect(report.getByText(students[0].name)).toBeVisible();
    await expect(report.getByText(students[1].name)).toBeVisible();
    await expect(report.getByText("1/1 پاسخ", { exact: false })).toBeVisible();
    await expect(report.getByText("0/1 پاسخ", { exact: false })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("teacher-class-group-report.png"),
      fullPage: true,
    });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test("teacher assigns one corrective practice from a student's wrong answer", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  // Keep production login/register throttling intact. Earlier browser cases
  // may already have consumed the shared unauthenticated IP quota.
  async function authPost(
    requester: import("@playwright/test").APIRequestContext,
    endpoint: string,
    data: object,
  ) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await requester.post(endpoint, { data });
      if (response.status() !== 429) return response;
      const delaySeconds = Number(response.headers()["retry-after"] ?? 60);
      await new Promise<void>((resolve) =>
        setTimeout(resolve, 1000 * Math.min(65, Math.max(1, delaySeconds + 1))),
      );
    }
    throw new Error("Authentication rate-limit window did not reset");
  }
  const suffix = Date.now();
  const teacherEmail = `remedial-teacher-${suffix}@test.dev`;
  const studentEmail = `remedial-student-${suffix}@test.dev`;
  const teacherApi = page.context().request;
  expect(
    (
      await authPost(teacherApi, "/api/auth/register", {
        name: "معلم خصوصی",
        email: teacherEmail,
        password: pass,
        role: "teacher",
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await authPost(teacherApi, "/api/auth/login", {
        email: teacherEmail,
        password: pass,
      })
    ).ok(),
  ).toBe(true);
  const topicResponse = await teacherApi.post("/api/curriculum", {
    data: { title: "تمرین اشتباهات", kind: "topic" },
  });
  expect(topicResponse.ok()).toBe(true);
  const topic = await topicResponse.json();
  const questionResponse = await teacherApi.post("/api/questions", {
    data: {
      topicId: topic._id,
      statement: "حاصل دو به علاوه دو چیست؟",
      type: "numeric",
      reference: "4",
      hints: ["اعداد را با هم جمع کن."],
    },
  });
  expect(questionResponse.ok()).toBe(true);
  const question = await questionResponse.json();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const studentApi = context.request;
    const reg = await authPost(studentApi, "/api/auth/register", {
      name: "دانش‌آموز خصوصی",
      email: studentEmail,
      password: pass,
      role: "student",
    });
    expect(reg.ok()).toBe(true);
    const studentLogin = await authPost(studentApi, "/api/auth/login", {
      email: studentEmail,
      password: pass,
    });
    expect(studentLogin.ok()).toBe(true);
    const studentId = (await studentLogin.json())._id;
    const invitation = await teacherApi.post("/api/invitations", {
      data: { email: studentEmail },
    });
    expect(invitation.ok()).toBe(true);
    const token = (await invitation.json()).token;
    expect(
      (
        await studentApi.post("/api/invitations/claim", { data: { token } })
      ).ok(),
    ).toBe(true);
    const missionResponse = await teacherApi.post("/api/missions", {
      data: {
        title: "تمرین اولیه",
        studentId,
        questionVersionIds: [question._id],
        policy: { maxAttempts: 3, maxHints: 2, independent: false },
      },
    });
    expect(missionResponse.ok()).toBe(true);
    const mission = await missionResponse.json();
    expect(
      (
        await teacherApi.post("/api/missions/" + mission._id + "/publish", {
          data: {},
        })
      ).ok(),
    ).toBe(true);
    const before = await studentApi.get("/api/assignments");
    expect(before.ok()).toBe(true);
    const first = (await before.json()).find(
      (a: { missionId: string }) => a.missionId === mission._id,
    );
    expect(first).toBeTruthy();
    expect(
      (
        await studentApi.post("/api/assignments/" + first._id + "/attempts", {
          data: { questionId: question._id, answer: "3" },
        })
      ).ok(),
    ).toBe(true);

    await page.goto("/");
    await page.getByRole("button", { name: "مأموریت‌ها", exact: true }).click();
    const form = page.getByTestId("individual-remediation");
    await expect(
      form.getByRole("heading", {
        name: "تمرین تقویتی فردی از اشتباهات ثبت‌شده",
      }),
    ).toBeVisible();
    await form
      .getByLabel("دانش‌آموز برای تمرین فردی")
      .selectOption({ label: "دانش‌آموز خصوصی" });
    await expect(form.getByText("حاصل دو به علاوه دو چیست؟")).toBeVisible();
    await form
      .getByRole("checkbox", { name: /حاصل دو به علاوه دو چیست؟/ })
      .check();
    await form
      .getByRole("button", { name: "انتشار تمرین تقویتی برای این دانش‌آموز" })
      .click();
    await expect(
      form.getByText("تمرین تقویتی فقط برای این دانش‌آموز منتشر شد."),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("individual-remediation-teacher.png"),
      fullPage: true,
    });

    const studentPage = await context.newPage();
    await studentPage.goto("/");
    await studentPage.getByRole("button", { name: "مأموریت‌های من" }).click();
    await expect(
      studentPage.getByText("تمرین تقویتی اختصاصی", { exact: true }),
    ).toBeVisible();
    const after = await studentApi.get("/api/assignments");
    const rem = (await after.json()).filter(
      (a: { remediation?: boolean }) => a.remediation,
    );
    expect(rem).toHaveLength(1);
    expect(rem[0].studentId).toBe(studentId);
    await studentPage.screenshot({
      path: testInfo.outputPath("individual-remediation-student-mobile.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
