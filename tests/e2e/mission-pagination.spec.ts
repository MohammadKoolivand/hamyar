import { registerSyntheticUser } from "./auth-helpers";
import { test, expect } from "@playwright/test";
test("question collection filters, pages, modal and bulk add preserve all selected questions", async ({
  page,
}) => {
  const stamp = Date.now();
  await registerSyntheticUser(page, "معلم صفحه‌بندی");
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
      source: {
        family: "practice",
        practice: "teacher",
        sourceTitle: "مجموعه تشریحی",
      },
    },
  });
  await page.goto("/homeworks");
  const picker = page.getByRole("group", {
    name: "انتخاب سؤال‌های مأموریت",
    exact: true,
  });
  // Each filter accepts multiple values, unions within a filter and intersects across filters.
  for (const [label, choices] of [
    ["دسته‌بندی سؤال برای مأموریت", ["آزمون آزمایشی", "تمرین و تألیف"]],
    ["نوع سؤال برای مأموریت", ["چندگزینه‌ای", "تشریحی"]],
    ["منابع / مجموعه‌ها", ["مجموعه تست ۳۵ سؤال", "مجموعه تشریحی"]],
  ] as [string, string[]][]) {
    const filter = picker
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: label }) });
    await filter.locator("summary").click();
    for (const choice of choices)
      await filter.getByRole("checkbox", { name: choice, exact: true }).check();
    await expect(filter.locator("summary")).toContainText("۲ انتخاب");
    await filter.locator("summary").click();
  }
  await picker
    .getByLabel("جست‌وجوی سؤال برای مأموریت", { exact: true })
    .fill("سؤال تشریحی دسته دیگر");
  await expect(
    picker.getByText("سؤال تشریحی دسته دیگر", { exact: true }),
  ).toBeVisible();
  await picker
    .getByLabel("جست‌وجوی سؤال برای مأموریت", { exact: true })
    .fill("");
  for (const label of [
    "دسته‌بندی سؤال برای مأموریت",
    "نوع سؤال برای مأموریت",
    "منابع / مجموعه‌ها",
  ]) {
    const filter = picker
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: label }) });
    await filter.locator("summary").click();
    await filter
      .getByRole("button", { name: "همه / پاک‌کردن فیلتر", exact: true })
      .click();
    await filter.locator("summary").click();
  }
  await picker
    .locator("summary")
    .filter({ hasText: "دسته‌بندی سؤال برای مأموریت" })
    .click();
  await picker
    .getByRole("checkbox", { name: "آزمون آزمایشی", exact: true })
    .check();
  await picker
    .locator("summary")
    .filter({ hasText: "دسته‌بندی سؤال برای مأموریت" })
    .click();
  await picker
    .locator("summary")
    .filter({ hasText: "نوع سؤال برای مأموریت" })
    .click();
  await picker
    .getByRole("checkbox", { name: "چندگزینه‌ای", exact: true })
    .check();
  await picker
    .locator("summary")
    .filter({ hasText: "نوع سؤال برای مأموریت" })
    .click();
  await picker
    .locator("summary")
    .filter({ hasText: "منابع / مجموعه‌ها" })
    .click();
  await picker
    .getByRole("checkbox", { name: "مجموعه تست ۳۵ سؤال", exact: true })
    .check();
  await picker
    .locator("summary")
    .filter({ hasText: "منابع / مجموعه‌ها" })
    .click();
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
