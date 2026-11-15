import { registerSyntheticUser } from "./auth-helpers";
import { expect, test } from "@playwright/test";

test("each navigation section resolves to a standalone URL on direct load", async ({
  page,
}) => {
  const routes = [
    "/dashboard",
    "/homeworks",
    "/students",
    "/courses",
    "/classes",
    "/content",
    "/content-new",
    "/resources",
    "/learning",
    "/student-practice",
    "/student-missions",
    "/mistakes",
    "/progress",
    "/search",
    "/practice",
    "/report",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "ورود یا ثبت‌نام در هدهد" }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(route);
  }
});

test("student navigation exposes the phase-one learning architecture with working deep links", async ({
  page,
}) => {
  await registerSyntheticUser(page, "دانش‌آموز معماری", "student");

  await expect(
    page.getByRole("heading", { name: "سلام دانش‌آموز معماری، خوش آمدی" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "جست‌وجو در درس‌ها و مأموریت‌ها",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "درس‌های من", exact: true }),
  ).toBeVisible();
  for (const section of [
    "مأموریت‌های نزدیک به موعد",
    "تمرین پیشنهادی هدهده",
    "مباحث نیازمند مرور",
    "آخرین نتیجه و روند پیشرفت",
    "محتوای تازه برای درس‌های تو",
  ]) {
    await expect(
      page.getByRole("heading", { name: section, exact: true }),
    ).toBeVisible();
  }
  for (const action of [
    "باز کردن تمرین‌های آماده",
    "باز کردن تکلیف‌های من",
    "باز کردن مرور اشتباهات",
    "باز کردن گزارش پیشرفت",
  ]) {
    await expect(
      page.getByRole("button", { name: action, exact: true }),
    ).toBeVisible();
  }

  const destinations = [
    ["خانه", "/dashboard"],
    ["تمرین و آزمون", "/student-practice"],
    ["درس‌های من", "/courses"],
    ["مأموریت‌های معلم", "/student-missions"],
    ["مرور اشتباهات", "/mistakes"],
    ["پیشرفت من", "/progress"],
    ["جست‌وجو", "/search"],
  ] as const;

  for (const [label, path] of destinations) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await page.reload();
    await expect(page.locator("main > header h1")).toHaveText(label);
  }

  await page.getByLabel("جست‌وجو در درس‌ها و مأموریت‌ها").fill("ریاضی");
  await expect(page.getByRole("status")).toContainText("۰ نتیجه پیدا شد");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("logged-in teacher navigation supports deep links, refresh, Back and Forward; header fits content", async ({
  page,
}) => {
  await registerSyntheticUser(page, "معلم مسیرها");

  await expect(
    page.getByRole("heading", { name: "نمای کلی", exact: true }),
  ).toBeVisible();
  const measured = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("header.hy-student-site-header");
    const first = document.querySelector<HTMLElement>('nav[aria-label="بخش‌های اصلی"] button');
    if (!header || !first) throw new Error("Unified site header not rendered");
    return {
      headerHeight: header.getBoundingClientRect().height,
      hasSidebar: !!document.querySelector("aside"),
      firstNavWidth: first.getBoundingClientRect().width,
      desktop: window.innerWidth,
    };
  });
  expect(measured.headerHeight).toBeLessThan(120);
  expect(measured.hasSidebar).toBe(false);
  expect(measured.firstNavWidth).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "پروفایل کاربر" })).toBeVisible();
  await expect(page.getByText("محتوا و منابع", { exact: true })).toBeVisible();

  await page.getByText("محتوا و منابع", { exact: true }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(
    page.getByRole("heading", { name: "بانک سؤال‌های شما" }),
  ).toBeVisible();

  await page.getByText("تمرین و تحلیل", { exact: true }).click();
  await page.getByRole("button", { name: "مأموریت‌ها", exact: true }).click();
  await expect(page).toHaveURL(/\/homeworks$/);
  await expect(
    page.getByRole("heading", { name: "طراحی مأموریت تمرینی" }),
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/homeworks$/);
  await expect(
    page.getByRole("heading", { name: "طراحی مأموریت تمرینی" }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/content$/);
  await expect(
    page.getByRole("heading", { name: "بانک سؤال‌های شما" }),
  ).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/homeworks$/);
  await expect(
    page.getByRole("heading", { name: "طراحی مأموریت تمرینی" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "پروفایل کاربر" }).click();
  await expect(page.getByRole("button", { name: "تنظیمات", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "تنظیمات", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("all teacher MVP pages fit 360/390/768/1280 RTL and reload without runtime errors", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/hydration|cannot be a child|cannot contain/i.test(m.text()))
      errors.push(m.text());
  });
  await registerSyntheticUser(page, "ممیزی نمایشگر");
  await expect(
    page.locator('summary[aria-label="پروفایل کاربر"]'),
  ).toBeVisible();
  for (const route of [
    "dashboard",
    "students",
    "courses",
    "classes",
    "content",
    "content-new",
    "resources",
    "homeworks",
    "learning",
    "settings",
    "exam-import",
  ]) {
    await page.goto("/" + route);
    await expect(
      page.locator('summary[aria-label="پروفایل کاربر"]'),
    ).toBeVisible();
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await page.evaluate(() => ({
        fits: document.documentElement.scrollWidth <= innerWidth,
        overflow: [...document.querySelectorAll("main *")]
          .filter(
            (el) =>
              el.getBoundingClientRect().left < -1 ||
              el.getBoundingClientRect().right > innerWidth + 1,
          )
          .slice(0, 12)
          .map((el) => ({
            tag: el.tagName,
            class: el.className,
            width: el.getBoundingClientRect().width,
          })),
      }));
      expect(
        layout.fits,
        `${width}: /${route}: ${JSON.stringify(layout.overflow)}`,
      ).toBe(true);
      expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
    }
  }
  expect(errors).toEqual([]);
});

test("mobile teacher navigation stays at the bottom and opens role-aware More destinations", async ({ page }) => {
  await registerSyntheticUser(page, "معلم ناوبری موبایل");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByRole("navigation", { name: "ناوبری پایین صفحه" });
  await expect(mobile).toBeVisible();
  await expect(page.getByRole("navigation", { name: "بخش‌های اصلی" })).toBeHidden();
  await expect(mobile.getByRole("button")).toHaveCount(5);

  const bounds = await mobile.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { bottom: rect.bottom, innerWidth: document.documentElement.scrollWidth };
  });
  expect(Math.abs(bounds.bottom - 844)).toBeLessThan(3);
  expect(bounds.innerWidth).toBeLessThanOrEqual(390);

  await mobile.getByRole("button", { name: "بانک من" }).click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(mobile.getByRole("button", { name: "بانک من" })).toHaveAttribute("aria-current", "page");

  await mobile.getByRole("button", { name: "بیشتر" }).click();
  const sheet = page.getByRole("dialog", { name: "سایر بخش‌ها" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "منابع آموزشی و PDF" }).click();
  await expect(page).toHaveURL(/\/resources$/);
  await expect(sheet).toHaveCount(0);

  await page.reload();
  await expect(mobile).toBeVisible();
  await mobile.getByRole("button", { name: "بیشتر" }).click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("public mobile keeps practice and login in one bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/dashboard");
  const mobile = page.getByRole("navigation", { name: "ناوبری پایین صفحه" });
  await expect(mobile).toBeVisible();
  await expect(mobile.getByRole("button")).toHaveCount(3);
  await mobile.getByRole("button", { name: "ورود" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "ورود یا ثبت‌نام در هدهد" })).toBeVisible();
});


test("Home is centered on mobile and consistently opens sample-question selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "تمرین و نمونه‌سؤال", exact: true })).toBeVisible();
  const mobile = page.getByRole("navigation", { name: "ناوبری پایین صفحه" });
  await expect(mobile.getByRole("button").nth(1)).toHaveAttribute("aria-label", "خانه");
  await expect(mobile.getByRole("button", { name: "خانه" })).toHaveAttribute("aria-current", "page");

  await registerSyntheticUser(page, "معلم تست خانه");
  await page.setViewportSize({ width: 390, height: 844 });
  await mobile.getByRole("button").nth(2).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "تمرین و نمونه‌سؤال", exact: true })).toBeVisible();
  await expect(mobile.getByRole("button").nth(2)).toHaveAttribute("aria-label", "خانه");
  await expect(mobile.getByRole("button").nth(2)).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.getByRole("heading", { name: "تمرین و نمونه‌سؤال", exact: true })).toBeVisible();
});

test("desktop header dropdowns close after outside click, next menu and Escape", async ({ page }) => {
  await registerSyntheticUser(page, "معلم منوی هدر");
  await page.setViewportSize({ width: 1280, height: 850 });
  const contentMenu = page.locator("details.hy-header-menu").filter({ hasText: "محتوا و منابع" });
  const analysisMenu = page.locator("details.hy-header-menu").filter({ hasText: "تمرین و تحلیل" });
  await contentMenu.locator("summary").click();
  await expect(contentMenu).toHaveAttribute("open", "");
  await page.locator("main").click({ position: { x: 10, y: 10 } });
  await expect(contentMenu).not.toHaveAttribute("open", "");

  await contentMenu.locator("summary").click();
  await analysisMenu.locator("summary").click();
  await expect(contentMenu).not.toHaveAttribute("open", "");
  await expect(analysisMenu).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(analysisMenu).not.toHaveAttribute("open", "");
});
