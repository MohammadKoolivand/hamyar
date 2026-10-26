import { test, expect } from "@playwright/test";

test("reference-inspired luminous glass identity is consistent on login and mobile", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await expect(page.locator(".hy-brand")).toBeVisible();
  const mark = page.locator(".hy-brand img");
  await expect(mark).toHaveAttribute("src", /icon\.svg/);
  const icon = await page.request.get("/icon.svg");
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain('aria-label="هدهده"');
  expect(await icon.text()).toContain('<path fill="#171717"');

  const visual = await page.evaluate(() => {
    const tokens = getComputedStyle(document.documentElement);
    const glass = document.querySelector(".glass-panel");
    const panel = glass ? getComputedStyle(glass) : null;
    return {
      primary: tokens.getPropertyValue("--hy-primary").trim().toLowerCase(),
      teal: tokens.getPropertyValue("--hy-secondary").trim().toLowerCase(),
      background: tokens
        .getPropertyValue("--hy-background")
        .trim()
        .toLowerCase(),
      blur: panel?.backdropFilter ?? "",
      radius: panel?.borderRadius ?? "",
      direction: document.documentElement.dir,
    };
  });
  expect(visual.primary).toBe("#1f3f97");
  expect(visual.teal).toBe("#2ec8c3");
  expect(visual.background).toBe("#f8fbff");
  expect(visual.blur).toContain("blur(");
  expect(parseFloat(visual.radius)).toBeGreaterThanOrEqual(20);
  expect(visual.direction).toBe("rtl");
  await page.screenshot({
    path: testInfo.outputPath("luminous-login-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 360, height: 780 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("luminous-login-mobile.png"),
    fullPage: true,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page
    .getByRole("button", { name: /^ورود به هدهده$/ })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toMatch(/^(0s|0ms)(,\s*(0s|0ms))*$/);
});
