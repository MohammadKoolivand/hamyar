import { test, expect } from "@playwright/test";
test("exam taxonomy is visible in bank and saved from authoring with category-specific filters", async ({
  page,
}, testInfo) => {
  await page.goto("/content");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم دسته‌بندی");
  await page
    .getByLabel("ایمیل یا شماره موبایل", { exact: true })
    .fill(`taxonomy-${Date.now()}@test.dev`);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  for (const name of [
    "کنکور",
    "امتحان نهایی",
    "امتحان مدرسه‌ای",
    "امتحان هماهنگ",
    "ورودی مدارس",
    "آزمون آزمایشی",
    "المپیاد",
    "تمرین و تألیف",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await page.getByRole("button", { name: "سؤال آزاد", exact: true }).click();
  await page
    .getByLabel("دسته‌بندی آزمون / منبع", { exact: true })
    .selectOption("konkur");
  await page
    .getByLabel("گروه کنکور", { exact: true })
    .selectOption("experimental");
  await page
    .getByLabel("دسته‌بندی آزمون / منبع", { exact: true })
    .selectOption("school");
  await expect(page.getByLabel("گروه کنکور", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("نوبت ارزشیابی مدرسه", { exact: true }).locator("option"),
  ).toHaveCount(9);
  await page
    .getByLabel("نوبت ارزشیابی مدرسه", { exact: true })
    .selectOption("mid_first");
  await page
    .getByLabel("دسته‌بندی آزمون / منبع", { exact: true })
    .selectOption("konkur");
  await expect(page.getByLabel("گروه کنکور", { exact: true })).toHaveValue("");
  await page
    .getByLabel("گروه کنکور", { exact: true })
    .selectOption("mathematics");
  await page
    .getByLabel("محل برگزاری کنکور", { exact: true })
    .selectOption("international");
  await page.getByLabel("نوبت آزمون", { exact: true }).fill("نوبت اول");
  await page
    .getByText("مشخصات منبع و دفترچه (اختیاری)", { exact: true })
    .click();
  await page
    .getByLabel("تاریخ آزمون (مثال 1405/08/01)", { exact: true })
    .fill("1404/02/11");
  await page
    .getByLabel("تاریخ انتشار منبع (میلادی)", { exact: true })
    .fill("2025-05-02");
  await page
    .getByLabel("صفحهٔ معرفی منبع", { exact: true })
    .fill("https://konkur.in/fixture-article");
  await page.getByLabel("شماره صفحه در PDF", { exact: true }).fill("3");
  await page.getByLabel("سال سؤال (شمسی)", { exact: true }).fill("1404");
  await page
    .getByLabel("صورت سؤال", { exact: true })
    .fill("سؤال نمونه برای آزمون دسته‌بندی کنکور");
  await page.getByLabel("پاسخ مرجع خصوصی", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true })
    .click();
  await expect(
    page.getByText("نسخه ثابت سؤال ذخیره شد.", { exact: true }),
  ).toBeVisible();
  const body = {
    classification: "free",
    statement: "سؤال امتحان نهایی آزمایشی",
    type: "numeric",
    reference: "2",
    source: { family: "school", administration: "final", session: "خرداد" },
  };
  expect((await page.request.post("/api/questions", { data: body })).ok()).toBe(
    true,
  );
  expect(
    (
      await page.request.post("/api/questions", {
        data: {
          ...body,
          statement: "سؤال هماهنگ کشوری آزمایشی",
          source: { family: "school", administration: "national" },
        },
      })
    ).ok(),
  ).toBe(true);
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "کنکور", exact: true }).click();
  await expect(page.getByText("تاریخ آزمون: 1404/02/11")).toBeVisible();
  await expect(page.getByText("انتشار منبع:")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "صفحهٔ منبع", exact: true }),
  ).toHaveAttribute("href", "https://konkur.in/fixture-article");
  await expect(
    page.getByText("سؤال نمونه برای آزمون دسته‌بندی کنکور", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("سؤال امتحان نهایی آزمایشی", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("فیلتر گروه کنکور", { exact: true })
    .selectOption("experimental");
  await expect(
    page.getByText("سؤالی با این فیلترها پیدا نشد", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("فیلتر گروه کنکور", { exact: true })
    .selectOption("mathematics");
  await page
    .getByLabel("فیلتر محل برگزاری کنکور", { exact: true })
    .selectOption("international");
  await expect(
    page.getByText("سؤال نمونه برای آزمون دسته‌بندی کنکور", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "امتحان نهایی", exact: true }).click();
  await expect(
    page.getByText("سؤال امتحان نهایی آزمایشی", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("سؤال هماهنگ کشوری آزمایشی", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "امتحان هماهنگ", exact: true })
    .click();
  await page
    .getByLabel("فیلتر سطح آزمون هماهنگ", { exact: true })
    .selectOption("national");
  await expect(
    page.getByText("سؤال هماهنگ کشوری آزمایشی", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("exam-categories-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("exam-categories-mobile.png"),
    fullPage: true,
  });
  const q = (await (await page.request.get("/api/questions")).json()).find(
    (q: { source?: { family: string } }) => q.source?.family === "konkur",
  );
  expect(q.source).toMatchObject({
    family: "konkur",
    group: "mathematics",
    location: "international",
    session: "نوبت اول",
  });
  expect(q.source.schoolStage).toBeUndefined();
});
