import { chooseTopic } from "./curriculum-helpers";
import { test, expect } from "@playwright/test";
test("secondary catalog filter → import → preserved after reload → author a real question", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم فهرست درسی");
  await page
    .getByLabel("ایمیل", { exact: true })
    .fill(`catalog-${Date.now()}@test.dev`);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page
    .getByRole("button", { name: "ورود به همیار", exact: true })
    .click();
  await page.getByRole("button", { name: "منابع آموزشی", exact: true }).click();
  await page
    .getByRole("heading", { name: "کتاب‌ها و مباحث درسی", exact: true })
    .click();
  await expect(page.getByText("۳۴ کتاب؛", { exact: false })).toBeVisible();
  await page.getByLabel("پایه فهرست").selectOption("12");
  await page.getByLabel("رشته فهرست").selectOption("mathematics");
  await expect(page.getByText("۴ کتاب؛", { exact: false })).toBeVisible();
  await page
    .getByRole("button", {
      name: "افزودن کتاب‌های این فیلتر به مباحث من",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("عنوان افزوده شد");
  await page
    .getByRole("button", {
      name: "افزودن کتاب‌های این فیلتر به مباحث من",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("۰ عنوان افزوده شد");
  const nodes = await (await page.request.get("/api/curriculum")).json();
  const topic = nodes.find(
    (n: { title: string; kind: string; catalogBookId: string }) =>
      n.kind === "topic" &&
      n.title === "استدلال ریاضی" &&
      n.catalogBookId === "riaziat-g12",
  );
  expect(topic).toBeTruthy();
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await expect(page.getByLabel("مبحث", { exact: true })).toBeDisabled();
  await chooseTopic(page, topic._id);
  await page.getByLabel("فصل ثبت سؤال").selectOption("");
  await expect(page.getByLabel("مبحث", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true }),
  ).toBeDisabled();
  await chooseTopic(page, topic._id);
  await page
    .getByLabel("صورت سؤال", { exact: true })
    .fill("سؤال آزمایشی معلم در مبحث واردشده");
  await page.getByLabel("پاسخ مرجع خصوصی", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true })
    .click();
  await expect(page.getByText("بانک سؤال خصوصی · ۱ سؤال")).toBeVisible();
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByText("سؤال آزمایشی معلم در مبحث واردشده", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await page
    .getByRole("button", { name: "با هوش مصنوعی", exact: true })
    .click();
  await chooseTopic(page, topic._id, "تولید سؤال", "مبحث تولید سؤال");
  await expect(page.getByLabel("مبحث تولید سؤال", { exact: true })).toHaveValue(
    topic._id,
  );
  const custom = await page.request.post("/api/curriculum", {
    data: { title: "مبحث شخصی بدون ساختار", kind: "topic" },
  });
  expect(custom.ok()).toBe(true);
  const customId = (await custom.json())._id;
  await page.reload();
  await page
    .getByRole("button", { name: "با هوش مصنوعی", exact: true })
    .click();
  await chooseTopic(page, customId, "تولید سؤال", "مبحث تولید سؤال");
  await expect(page.getByLabel("مبحث تولید سؤال", { exact: true })).toHaveValue(
    customId,
  );
});
