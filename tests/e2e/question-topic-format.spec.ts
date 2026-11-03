import { test, expect } from "@playwright/test";
import { registerSyntheticUser } from "./auth-helpers";

test("question topic can be connected and reconnected; selected underline persists and renders after reload", async ({
  page,
}) => {
  await registerSyntheticUser(page, "معلم ویرایش مبحث و زیرخط");
  const topics = [];
  for (const title of ["مبحث اول زیرخط", "مبحث دوم زیرخط"]) {
    const response = await page.request.post("/api/curriculum", {
      data: { title, kind: "topic" },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    topics.push(await response.json());
  }
  const response = await page.request.post("/api/questions", {
    data: {
      classification: "free",
      statement: "کدام عبارت نادرست است؟",
      type: "choice",
      options: ["الف", "ب"],
      reference: "ب",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  await page.goto("/content");
  await page.getByRole("button", { name: "ویرایش سؤال", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("اتصال این سؤال به مبحث درسی", { exact: true })
    .check();
  await dialog.getByLabel("پایه ویرایش سؤال").selectOption("ungraded");
  await dialog.getByLabel("درس یا کتاب ویرایش سؤال").selectOption("unassigned");
  await dialog.getByLabel("فصل ویرایش سؤال").selectOption("unchaptered");
  await dialog
    .getByLabel("مبحث درسی سؤال", { exact: true })
    .selectOption(topics[0]._id);
  const textarea = dialog.getByLabel("متن سؤال", { exact: true });
  await textarea.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    const start = el.value.indexOf("نادرست");
    el.setSelectionRange(start, start + 6);
  });
  await dialog
    .getByRole("button", { name: "زیرخط متن انتخاب‌شده", exact: true })
    .click();
  await expect(textarea).toHaveValue("کدام عبارت <u>نادرست</u> است؟");
  await expect(dialog.locator("u").filter({ hasText: "نادرست" })).toBeVisible();
  await dialog
    .getByRole("button", { name: "ذخیره نسخه جدید", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator("article u")).toHaveText("نادرست");
  await page.getByRole("button", { name: "ویرایش سؤال", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("مبحث درسی سؤال", { exact: true }),
  ).toHaveValue(topics[0]._id);
  await dialog
    .getByLabel("مبحث درسی سؤال", { exact: true })
    .selectOption(topics[1]._id);
  await dialog
    .getByRole("button", { name: "ذخیره نسخه جدید", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.locator("article")).toContainText("مبحث دوم زیرخط");
  await expect(page.locator("article u")).toHaveText("نادرست");
});
