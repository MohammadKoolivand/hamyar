import { test, expect } from "@playwright/test";
import { chooseTopic } from "./curriculum-helpers";
test("bank-focused page separates resources and authoring; metadata and dependent filters persist", async ({
  page,
}, testInfo) => {
  await page.goto("/content");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم بانک سؤال");
  await page
    .getByLabel("ایمیل یا شماره موبایل", { exact: true })
    .fill(`bank-${Date.now()}@test.dev`);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  await expect(page.getByLabel("صورت سؤال", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "کتاب‌ها و مباحث درسی", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await expect(page).toHaveURL(/\/content-new$/);
  await page.getByRole("button", { name: "سؤال آزاد", exact: true }).click();
  await page.getByLabel("درجه سختی", { exact: true }).selectOption("hard");
  await page.getByLabel("سال سؤال (شمسی)", { exact: true }).fill("1404");
  await page
    .getByLabel("صورت سؤال", { exact: true })
    .fill("حاصل دو به اضافه سه چیست؟");
  await page.getByLabel("پاسخ مرجع خصوصی", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true })
    .click();
  await expect(
    page.getByText("نسخه ثابت سؤال ذخیره شد.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await expect(
    page.getByText("حاصل دو به اضافه سه چیست؟", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("درجه سختی", { exact: true }).selectOption("easy");
  await expect(
    page.getByText("سؤالی با این فیلترها پیدا نشد", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("درجه سختی", { exact: true }).selectOption("hard");
  await page.getByLabel("سال سؤال", { exact: true }).selectOption("1404");
  await page.getByLabel("دسته سؤال", { exact: true }).selectOption("free");
  await expect(
    page.getByText("حاصل دو به اضافه سه چیست؟", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /پاک‌کردن فیلترها/ }).click();
  await page.getByRole("link", { name: "منابع آموزشی", exact: true }).click();
  await expect(page).toHaveURL(/\/resources$/);
  await page
    .getByRole("heading", { name: "کتاب‌ها و مباحث درسی", exact: true })
    .click();
  await expect(page.getByLabel("پایه فهرست")).toBeVisible();
  const ids: string[] = [];
  for (const [title, kind] of [
    ["پایه آزمایشی", "grade"],
    ["کتاب آزمایشی", "course"],
    ["فصل آزمایشی", "chapter"],
    ["جمع آزمایشی", "topic"],
  ]) {
    const r = await page.request.post("/api/curriculum", {
      data: { title, kind, ...(ids.length ? { parentId: ids.at(-1) } : {}) },
    });
    expect(r.ok()).toBe(true);
    ids.push((await r.json())._id);
  }
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await page.reload();
  await chooseTopic(page, ids[3]);
  await page.getByLabel("درجه سختی", { exact: true }).selectOption("easy");
  await page.getByLabel("سال سؤال (شمسی)", { exact: true }).fill("1405");
  await page
    .getByLabel("صورت سؤال", { exact: true })
    .fill("حاصل یک به اضافه یک چیست؟");
  await page.getByLabel("پاسخ مرجع خصوصی", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true })
    .click();
  await expect(
    page.getByText("نسخه ثابت سؤال ذخیره شد.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.getByLabel("پایه", { exact: true }).selectOption(ids[0]);
  await page.getByLabel("درس / کتاب", { exact: true }).selectOption(ids[1]);
  await page.getByLabel("فصل", { exact: true }).selectOption(ids[2]);
  await page.getByLabel("مبحث", { exact: true }).selectOption(ids[3]);
  await expect(
    page.getByText("حاصل یک به اضافه یک چیست؟", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("حاصل دو به اضافه سه چیست؟", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("پایه", { exact: true }).selectOption("");
  await expect(page.getByLabel("مبحث", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("فصل", { exact: true })).toHaveValue("");
  await page.screenshot({
    path: testInfo.outputPath("question-bank-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("question-bank-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await page
    .getByRole("button", { name: "با هوش مصنوعی", exact: true })
    .click();
  await expect(page.getByLabel("حوزه، پایه و هدف سؤال")).toBeVisible();
  const data = await (await page.request.get("/api/questions")).json();
  expect(data).toHaveLength(2);
  expect(
    data.find((q: { classification: string }) => q.classification === "free"),
  ).toMatchObject({ difficulty: "hard", year: 1404 });
});
