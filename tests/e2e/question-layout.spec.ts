import { test, expect } from "@playwright/test";
import { registerSyntheticUser } from "./auth-helpers";
import { visualTemplate } from "../../src/lib/question-visuals";

test("bank edit icon and automatic option/figure placement survive refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await registerSyntheticUser(page, "معلم چیدمان");
  for (const long of [false, true]) {
    const response = await page.request.post("/api/questions", {
      data: {
        classification: "free",
        statement: long ? "سؤال گزینه‌های بلند" : "سؤال گزینه‌های کوتاه",
        type: "choice",
        options: long
          ? Array.from(
              { length: 4 },
              (_, i) =>
                `گزینه ${i + 1}: این متن طولانی برای بررسی نمایش گزینه‌ها به صورت عمودی در کنار شکل و حفظ فاصله استاندارد نوشته شده است.`,
            )
          : ["$۲$", "$۴$", "$۶$", "$۸$"],
        reference: long
          ? "گزینه 1: این متن طولانی برای بررسی نمایش گزینه‌ها به صورت عمودی در کنار شکل و حفظ فاصله استاندارد نوشته شده است."
          : "$۴$",
        visuals: [visualTemplate("geometry")],
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  await page.goto("/content");
  const short = page
    .locator("article")
    .filter({ hasText: "سؤال گزینه‌های کوتاه" });
  const long = page
    .locator("article")
    .filter({ hasText: "سؤال گزینه‌های بلند" });
  await expect(short.locator("[data-options-layout]")).toHaveAttribute(
    "data-options-layout",
    "row",
  );
  await expect(long.locator("[data-options-layout]")).toHaveAttribute(
    "data-options-layout",
    "stack",
  );
  const icon = short.getByRole("button", { name: "ویرایش سؤال", exact: true });
  await expect(icon).toHaveText("");
  const [card, button] = await Promise.all([
    short.boundingBox(),
    icon.boundingBox(),
  ]);
  expect(button!.x - card!.x).toBeLessThan(25);
  expect(button!.y - card!.y).toBeLessThan(25);
  const [options, figure] = await Promise.all([
    long.getByRole("region").boundingBox(),
    long.locator("figure").boundingBox(),
  ]);
  expect(figure!.x).toBeLessThan(options!.x);
  await page.reload();
  await expect(
    short.getByRole("img", { name: "پاسخ صحیح", exact: true }),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("resource title can be edited manually and remains after refresh", async ({
  page,
}) => {
  await registerSyntheticUser(page, "معلم سرفصل");
  const created = await page.request.post("/api/curriculum", {
    data: { title: "مبحث دستی اولیه", kind: "topic" },
  });
  expect(created.ok()).toBeTruthy();
  await page.goto("/resources");
  await page.getByRole("heading", { name: "ساختار آموزشی شما", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept("مبحث دستی اصلاح‌شده"));
  await page
    .getByRole("button", { name: "ویرایش سرفصل مبحث دستی اولیه", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "ویرایش سرفصل مبحث دستی اصلاح‌شده",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("heading", { name: "ساختار آموزشی شما", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "ویرایش سرفصل مبحث دستی اصلاح‌شده",
      exact: true,
    }),
  ).toBeVisible();
});
