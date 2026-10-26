import { test, expect } from "@playwright/test";
import { textPdf } from "../helpers/pdf";
test("PDF exam upload persists, extracts real text, saves corrections and approves/rejects into the actual bank", async ({
  page,
}, testInfo) => {
  await page.goto("/exam-import");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم ورود آزمون");
  await page
    .getByLabel("ایمیل یا شماره موبایل", { exact: true })
    .fill(`exam-${Date.now()}@test.dev`);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /ورود به هدهده/ }).click();
  await page.getByRole("button", { name: "ورود آزمون", exact: true }).click();
  await page
    .getByLabel("عنوان آزمون", { exact: true })
    .fill("آزمون PDF مرورگر");
  await page.getByLabel("درس آزمون", { exact: true }).fill("ریاضی");
  await page.getByLabel("سال آزمون (شمسی)", { exact: true }).fill("1405");
  await page.getByLabel("نوبت آزمون", { exact: true }).fill("خرداد");
  await page
    .getByRole("button", { name: "ثبت آزمون و ادامه به آپلود", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "آزمون PDF مرورگر", exact: true }),
  ).toBeVisible();
  await page.getByLabel("دفترچه سؤال‌ها", { exact: true }).setInputFiles({
    name: "invalid.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "PDF" }),
  ).toContainText("PDF");
  const pdf = textPdf(["1. What is 1 + 1?", "2. What is 2 + 2?"], 75000);
  await page.getByLabel("دفترچه سؤال‌ها", { exact: true }).setInputFiles({
    name: "exam.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(page.getByRole("status")).toContainText("فایل در سرور ذخیره شد");
  await page.getByLabel("پاسخ‌نامه", { exact: true }).setInputFiles({
    name: "answers.pdf",
    mimeType: "application/pdf",
    buffer: textPdf(["1. 2", "2. 4"]),
  });
  await expect(
    page.getByRole("link", {
      name: "دریافت فایل ذخیره‌شده: answers.pdf",
      exact: true,
    }),
  ).toBeVisible();
  const url = await page
    .getByRole("link", { name: "دریافت فایل ذخیره‌شده: exam.pdf", exact: true })
    .getAttribute("href");
  const download = await page.request.get(url!);
  expect(download.headers()["cache-control"]).toContain("no-store");
  expect(await download.body()).toEqual(pdf);
  await page.reload();
  await page
    .getByRole("button", {
      name: "استخراج متن و ایجاد پیش‌نویس سؤال‌ها",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("صورت سؤال 1", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByLabel("صورت سؤال 2", { exact: true })).toBeVisible();
  expect(await (await page.request.get("/api/questions")).json()).toHaveLength(
    0,
  );
  await page
    .getByLabel("صورت سؤال 1", { exact: true })
    .fill("حاصل یک به اضافه یک در آزمون مرورگر چیست؟");
  await page
    .getByRole("button", { name: "ذخیره اصلاحات سؤال ۱", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("نتیجه بررسی ذخیره شد");
  await page.reload();
  await expect(page.getByLabel("صورت سؤال 1", { exact: true })).toHaveValue(
    "حاصل یک به اضافه یک در آزمون مرورگر چیست؟",
  );
  await page
    .getByLabel("روش پاسخ سؤال 1", { exact: true })
    .selectOption("numeric");
  await page
    .getByLabel("شماره سؤال در دفترچه 1 (اختیاری)", { exact: true })
    .fill("7");
  await page.getByLabel("پاسخ مرجع سؤال 1", { exact: true }).fill("2");
  await page
    .getByLabel("درجه سختی سؤال 1", { exact: true })
    .selectOption("easy");
  await page
    .getByRole("checkbox", { name: /متن، پاسخ، تقسیم سؤال/ })
    .first()
    .check();
  await page
    .getByRole("button", { name: "تأیید و ورود سؤال ۱ به بانک", exact: true })
    .click();
  await page.getByLabel("فیلتر بازبینی", { exact: true }).selectOption("all");
  await expect(
    page.getByText("سؤال ۱ · تأیید و وارد بانک شد", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("دلیل رد سؤال 2", { exact: true })
    .fill("برای این تمرین مناسب نیست");
  await page
    .getByRole("button", { name: "رد پیش‌نویس سؤال ۲", exact: true })
    .click();
  await expect(page.getByText("سؤال ۲ · رد شد", { exact: true })).toBeVisible();
  await page
    .getByLabel("افزودن سؤال دستی به این آزمون", { exact: true })
    .fill("پیش‌نویس دستی مکمل از PDF");
  await page
    .getByRole("button", { name: "افزودن پیش‌نویس دستی", exact: true })
    .click();
  await expect(page.getByLabel("صورت سؤال 3", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("exam-review-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("exam-review-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "بانک سؤال", exact: true }).click();
  await page.getByRole("button", { name: "امتحان نهایی", exact: true }).click();
  await expect(
    page.getByText("حاصل یک به اضافه یک در آزمون مرورگر چیست؟", {
      exact: true,
    }),
  ).toBeVisible();
  const rows = await (await page.request.get("/api/questions")).json();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    year: 1405,
    source: {
      family: "school",
      administration: "final",
      session: "خرداد",
      questionNumber: 7,
    },
    origin: "exam_import_reviewed",
    difficulty: "easy",
  });
});
