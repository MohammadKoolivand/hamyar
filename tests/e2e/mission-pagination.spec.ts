import { test, expect } from "@playwright/test";
test("question collection filters, pages, modal and bulk add preserve all selected questions", async ({
  page,
}) => {
  await page.goto("/homeworks");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم صفحه‌بندی");
  const stamp = Date.now();
  await page
    .getByLabel("ایمیل", { exact: true })
    .fill(`pages-${stamp}@test.dev`);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /^ورود به (همیار|هدهد)$/ }).click();
  await expect(
    page.getByRole("button", { name: "مأموریت‌ها", exact: true }),
  ).toBeVisible();
  const ids = [];
  for (let i = 1; i <= 35; i++) {
    const response = await page.request.post("/api/questions", {
      data: {
        classification: "free",
        statement: `سؤال صفحه‌بندی شماره ${String(i).padStart(2, "0")}`,
        type: "choice",
        options: ["الف", "ب", "ج", "د"],
        reference: "ب",
        source: {
          family: "mock",
          organizer: "مؤسسه آزمایشی تست",
          sourceTitle: "مجموعه تست ۳۵ سؤال",
          sourceUrl: "https://konkur.in/fixture-only.pdf",
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    ids.push((await response.json())._id);
  }
  await page.request.post("/api/questions", {
    data: {
      classification: "free",
      statement: "سؤال تشریحی دسته دیگر",
      type: "essay",
      reference: "مرجع تست",
      source: { family: "practice", practice: "teacher" },
    },
  });
  await page.goto("/homeworks");
  const picker = page.getByRole("group", {
    name: "انتخاب سؤال‌های مأموریت",
    exact: true,
  });
  await picker
    .getByLabel("دسته‌بندی سؤال برای مأموریت", { exact: true })
    .selectOption("mock");
  await picker
    .getByLabel("نوع سؤال برای مأموریت", { exact: true })
    .selectOption("choice");
  await picker
    .getByLabel("مجموعه یا آزمون", { exact: true })
    .selectOption("https://konkur.in/fixture-only.pdf");
  await expect(picker.getByRole("button", { name: /مشاهده سؤال/ })).toHaveCount(
    10,
  );
  await picker.getByRole("checkbox").nth(1).check();
  await picker.getByRole("button", { name: "صفحه بعد", exact: true }).click();
  await expect(
    picker.getByText("سؤال صفحه‌بندی شماره 11", { exact: true }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: /مشاهده سؤال/ })
    .first()
    .click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(
    modal.getByText("سؤال صفحه‌بندی شماره 11", { exact: true }),
  ).toBeVisible();
  await expect(modal.getByText("۲. ب", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
  await picker.getByRole("button", { name: "صفحه قبل", exact: true }).click();
  await expect(picker.getByRole("checkbox").nth(1)).toBeChecked();
  await picker.getByRole("button", { name: /افزودن کل مجموعه/ }).click();
  await expect(picker.getByRole("status")).toHaveText("۳۵ سؤال انتخاب شده");
  await picker.getByRole("button", { name: /افزودن کل مجموعه/ }).click();
  await expect(picker.getByRole("status")).toHaveText("۳۵ سؤال انتخاب شده");
  await picker
    .getByLabel("صفحه انتخاب سؤال", { exact: true })
    .selectOption("3");
  await expect(
    picker.getByText("سؤال صفحه‌بندی شماره 21", { exact: true }),
  ).toBeVisible();
  await picker
    .getByLabel("جست‌وجوی سؤال برای مأموریت", { exact: true })
    .fill("شماره 35");
  await expect(
    picker.getByText("سؤال صفحه‌بندی شماره 35", { exact: true }),
  ).toBeVisible();
  await expect(picker.getByRole("navigation")).toHaveCount(0);
  await picker
    .getByLabel("جست‌وجوی سؤال برای مأموریت", { exact: true })
    .fill("");
  await expect(
    picker.getByText("سؤال صفحه‌بندی شماره 01", { exact: true }),
  ).toBeVisible();
  await picker
    .getByLabel("جست‌وجوی سؤال برای مأموریت", { exact: true })
    .fill("شماره 35");
  await picker.getByRole("button", { name: /مشاهده سؤال/ }).click();
  await expect(
    modal.getByRole("button", { name: "حذف از مأموریت", exact: true }),
  ).toBeVisible();
  await modal
    .getByRole("button", { name: "بستن مشاهده سؤال", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/content");
  await expect(
    page.getByRole("navigation", { name: "صفحه‌بندی بانک سؤال", exact: true }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(10);
});
