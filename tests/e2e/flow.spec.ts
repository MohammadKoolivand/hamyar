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
  await expect(page.locator(".glass-hero")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("glass-teacher-dashboard.png"), fullPage: true });
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
  await page.getByLabel("نوع", { exact: true }).selectOption("skill");
  await page.getByLabel("عنوان", { exact: true }).fill("حل مستقل");
  await page
    .getByLabel("زیرمجموعه")
    .selectOption({ label: "جمع ساده (topic)" });
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page
    .getByLabel("مبحث", { exact: true })
    .selectOption({ label: "جمع ساده" });
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
  await sp.screenshot({ path: testInfo.outputPath("glass-student-dashboard.png"), fullPage: true });
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
  await page.screenshot({ path: testInfo.outputPath("glass-teacher-missions.png"), fullPage: true });
  await sp.reload();
  await sp.getByRole("button", { name: "مأموریت‌های من", exact: true }).click();
  await sp.getByRole("button", { name: "شروع / ادامه تمرین" }).click();
  await expect(
    sp.getByText("حاصل یک به علاوه یک چیست؟", { exact: true }),
  ).toBeVisible();
  await expect(sp.locator(".practice-sheet")).toBeVisible();
  await sp.screenshot({ path: testInfo.outputPath("glass-student-practice.png"), fullPage: true });
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
  await page
    .getByLabel("پاسخ مرجع خصوصی")
    .fill("UNPUBLISHED_PRIVATE_REFERENCE");
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue("");
  await page.getByLabel("ایمیل", { exact: true }).fill(teacher);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ورود به همیار" }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
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
  const blur = await panel.evaluate((el) => getComputedStyle(el).backdropFilter);
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
    student = `child${suffix}@test.dev`,
    parent = `parent${suffix}@test.dev`;
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم تولید سؤال");
  await page.getByLabel("ایمیل", { exact: true }).fill(teacher);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: "ورود به همیار" }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await page.getByLabel("نوع", { exact: true }).selectOption("topic");
  await page.getByLabel("عنوان", { exact: true }).fill("جمع در پایه دوم");
  await page.getByRole("button", { name: "افزودن به ساختار" }).click();
  await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
  await page
    .getByLabel("مبحث تولید سؤال")
    .selectOption({ label: "جمع در پایه دوم" });
  await page
    .getByLabel("حوزه، پایه و هدف سؤال")
    .fill(
      "فقط یک سؤال جمع دو عدد تک‌رقمی مناسب پایه دوم ابتدایی ایران، پاسخ مرجع فقط یک عدد باشد.",
    );
  await page
    .getByRole("button", { name: "تولید یک پیش‌نویس با مدل محلی" })
    .click();
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
  await page
    .getByRole("button", { name: "تولید یک پیش‌نویس با مدل محلی" })
    .click();
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
  await page.getByLabel("ایمیل دانش‌آموز", { exact: true }).fill(student);
  await page.getByRole("button", { name: "ایجاد دعوت", exact: true }).click();
  const token = await page.getByTestId("invitation-token").innerText();
  const sc = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    sp = await sc.newPage();
  await sp.goto(`/?invite=${token}`);
  await sp.getByLabel("نام و نام خانوادگی").fill("دانش‌آموز آزمایشی");
  await sp.getByLabel("ایمیل", { exact: true }).fill(student);
  await sp.getByLabel("رمز عبور").fill(pass);
  await sp.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(sp.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await page
    .getByRole("button", { name: "به‌روزرسانی فهرست", exact: true })
    .click();
  await sp.getByRole("button", { name: "ورود به همیار" }).click();
  await page.getByRole("button", { name: "مأموریت‌ها", exact: true }).click();
  await page.getByLabel("عنوان مأموریت").fill("تمرین با سؤال تأییدشده");
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
  await sp
    .getByRole("button", { name: "پایان مأموریت و دریافت گزارش" })
    .click();
  await expect(
    sp.getByRole("heading", { name: "استقلال در اولین تلاش" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "دانش‌آموزان", exact: true }).click();
  await page.getByText("دسترسی اولیا", { exact: true }).click();
  await page.getByLabel("ایمیل ولی دانش‌آموز").fill(parent);
  await page.getByRole("button", { name: "ایجاد دعوت اولیا" }).click();
  const invite = await page.getByTestId("parent-invitation-token").innerText();
  const pc = await browser.newContext({
      viewport: { width: 360, height: 800 },
    }),
    pp = await pc.newPage();
  await pp.goto(invite);
  await pp.getByLabel("نام و نام خانوادگی").fill("ولی آزمایشی");
  await pp.getByLabel("ایمیل", { exact: true }).fill(parent);
  await pp.getByLabel("رمز عبور").fill(pass);
  await pp.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await pp.getByRole("button", { name: "ورود به همیار" }).click();
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

test("public login uses bright frosted-glass surfaces", async ({ page }, testInfo) => {
  await page.goto("/");
  const panel = page.locator(".glass-panel").first();
  await expect(panel).toBeVisible();
  const styles = await panel.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { backdrop: cs.backdropFilter, background: cs.backgroundImage };
  });
  expect(styles.backdrop).toContain("blur(");
  expect(styles.background).not.toBe("none");
  const bodyBackground = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bodyBackground).toContain("radial-gradient");
  await page.screenshot({ path: testInfo.outputPath("glass-login-desktop.png"), fullPage: true });
});

test("student registers without invitation and later joins teacher with existing account", async ({ page, browser }, testInfo) => {
  const suffix = Date.now();
  const studentEmail = `standalone-${suffix}@test.dev`;
  const teacherEmail = `mentor-${suffix}@test.dev`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام دانش‌آموز" }).click();
  await expect(page.getByRole("heading", { name: "ساخت حساب دانش‌آموز" })).toBeVisible();
  await expect(page.getByLabel("کد دعوت معلم")).toHaveCount(0);
  await page.getByLabel("نام و نام خانوادگی").fill("دانش‌آموز مستقل");
  await page.getByLabel("ایمیل", { exact: true }).fill(studentEmail);
  await page.getByLabel("رمز عبور").fill(pass);
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await page.getByRole("button", { name: "ورود به همیار" }).click();
  await expect(page.getByRole("heading", { name: "مسیر یادگیری من" })).toBeVisible();
  await expect(page.getByText("هنوز مأموریتی نداری.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "اتصال به معلم" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("independent-student-mobile.png"), fullPage: true });

  const teacherContext = await browser.newContext();
  try {
    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto("/");
    await teacherPage.getByRole("button", { name: "ثبت‌نام معلم" }).click();
    await teacherPage.getByLabel("نام و نام خانوادگی").fill("معلم آزمایشی");
    await teacherPage.getByLabel("ایمیل", { exact: true }).fill(teacherEmail);
    await teacherPage.getByLabel("رمز عبور").fill(pass);
    await teacherPage.getByRole("button", { name: "ساخت حساب", exact: true }).click();
    await teacherPage.getByRole("button", { name: "ورود به همیار" }).click();
    await teacherPage.getByRole("button", { name: "دانش‌آموزان", exact: true }).click();
    await teacherPage.getByLabel("ایمیل دانش‌آموز").fill(studentEmail);
    await teacherPage.getByRole("button", { name: "ایجاد دعوت" }).click();
    const invite = await teacherPage.getByTestId("invitation-token").innerText();

    await page.getByLabel("کد دعوت معلم").fill(invite);
    await page.getByRole("button", { name: "اتصال به معلم", exact: true }).click();
    await expect(page.getByRole("status").getByText("اتصال به معلم انجام شد.", { exact: false })).toBeVisible();
    await teacherPage.getByRole("button", { name: "به‌روزرسانی فهرست" }).click();
    await expect(teacherPage.getByRole("heading", { name: "دانش‌آموز مستقل" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "مسیر یادگیری من" })).toBeVisible();
    await expect(page.getByLabel("کد دعوت معلم")).toHaveValue("");
    await page.screenshot({ path: testInfo.outputPath("student-after-teacher-link-mobile.png"), fullPage: true });
  } finally {
    await teacherContext.close();
  }
});
