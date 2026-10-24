import { expect, test } from "@playwright/test";

test("each navigation section resolves to a standalone URL on direct load", async ({ page }) => {
  const routes = [
    "/dashboard", "/homeworks", "/students", "/courses",
    "/classes", "/content", "/content-new", "/resources", "/learning", "/practice", "/report",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(route);
  }
});

test("logged-in teacher navigation supports deep links, refresh, Back and Forward; header fits content", async ({ page }) => {
  const suffix = Date.now();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم مسیرها");
  await page.getByLabel("ایمیل", { exact: true }).fill(`nav-teacher-${suffix}@test.dev`);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: "ورود به همیار", exact: true }).click();

  await expect(page.getByRole("heading", { name: "نمای کلی", exact: true })).toBeVisible();
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
      sidebarItemWidth: Math.max(...Array.from(
        document.querySelectorAll<HTMLElement>("aside nav button"),
      ).map((el) => el.scrollWidth)),
      desktop: window.innerWidth,
    };
  });
  expect(measured.headerHeight).toBeLessThan(100);
  expect(measured.headerPaddingTop).toBe(10);
  expect(measured.headerPaddingBottom).toBe(10);
  expect(measured.sidebarWidth).toBeGreaterThanOrEqual(measured.sidebarItemWidth);

  await page.getByRole("button", { name: "بانک سؤال و محتوا", exact: true }).click();
  await expect(page).toHaveURL(/\/content$/);
  await expect(page.getByRole("heading", { name: "بانک سؤال‌های شما" })).toBeVisible();

  await page.getByRole("button", { name: "مأموریت‌ها", exact: true }).click();
  await expect(page).toHaveURL(/\/homeworks$/);
  await expect(page.getByRole("heading", { name: "طراحی مأموریت تمرینی" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/homeworks$/);
  await expect(page.getByRole("heading", { name: "طراحی مأموریت تمرینی" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/content$/);
  await expect(page.getByRole("heading", { name: "بانک سؤال‌های شما" })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/homeworks$/);
  await expect(page.getByRole("heading", { name: "طراحی مأموریت تمرینی" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
