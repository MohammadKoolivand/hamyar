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
    ["درس‌های من", "/courses"],
    ["تمرین و آزمون", "/student-practice"],
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
    const header = document.querySelector<HTMLElement>("main > header");
    const aside = document.querySelector<HTMLElement>("aside");
    const first = document.querySelector<HTMLElement>("aside nav button");
    if (!header || !aside || !first) throw new Error("App shell not rendered");
    return {
      headerHeight: header.getBoundingClientRect().height,
      headerPaddingTop: parseFloat(getComputedStyle(header).paddingTop),
      headerPaddingBottom: parseFloat(getComputedStyle(header).paddingBottom),
      sidebarWidth: aside.getBoundingClientRect().width,
      sidebarItemWidth: Math.max(
        ...Array.from(
          document.querySelectorAll<HTMLElement>("aside nav button"),
        ).map((el) => el.scrollWidth),
      ),
      desktop: window.innerWidth,
    };
  });
  expect(measured.headerHeight).toBeLessThan(100);
  expect(measured.headerPaddingTop).toBe(10);
  expect(measured.headerPaddingBottom).toBe(10);
  expect(measured.sidebarWidth).toBeGreaterThanOrEqual(
    measured.sidebarItemWidth,
  );

  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(
    page.getByRole("heading", { name: "بانک سؤال‌های شما" }),
  ).toBeVisible();

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
    page.getByRole("button", { name: "خروج", exact: true }),
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
      page.getByRole("button", { name: "خروج", exact: true }),
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
