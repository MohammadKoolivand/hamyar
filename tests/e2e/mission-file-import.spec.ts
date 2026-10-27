import { registerSyntheticUser } from "./auth-helpers";
import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("mission keeps its draft while image OCR is reviewed and approved questions are added", async ({
  page,
}) => {
  test.setTimeout(120000);
  await registerSyntheticUser(page, "معلم ورود فایل");
  await expect(
    page.getByRole("button", { name: "خروج", exact: true }),
  ).toBeVisible();
  await page.goto("/homeworks");
  await page
    .getByLabel("عنوان مأموریت", { exact: true })
    .fill("مأموریت حفظ‌شده هنگام اسکن");
  await page
    .getByRole("button", { name: "افزودن سؤال از PDF یا عکس", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "ورود فایل برای مأموریت",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await modal.getByLabel("درس آزمون", { exact: true }).selectOption("ریاضی");
  await modal
    .getByText("عنوان دلخواه و زبان اسکن (اختیاری)", { exact: true })
    .click();
  await modal.getByLabel("زبان OCR", { exact: true }).selectOption("eng");
  await modal
    .getByRole("button", { name: "ثبت آزمون و ادامه به آپلود", exact: true })
    .click();
  await expect(page).toHaveURL(/\/homeworks$/);
  const image = await sharp(
    Buffer.from(
      '<svg width="1200" height="800"><rect width="100%" height="100%" fill="white"/><text x="100" y="180" font-family="Arial" font-size="48" fill="black">1. What is two plus two?</text></svg>',
    ),
  )
    .png()
    .toBuffer();
  await modal.getByLabel("دفترچه سؤال‌ها", { exact: true }).setInputFiles({
    name: "mission.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(modal.getByRole("status")).toContainText(
    "فایل در سرور ذخیره شد",
  );
  await modal
    .getByRole("button", {
      name: "استخراج متن و ایجاد پیش‌نویس سؤال‌ها",
      exact: true,
    })
    .click();
  await expect(modal.getByLabel("صورت سؤال 1", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(modal.getByLabel("صورت سؤال 1", { exact: true })).toHaveValue(
    /two plus two/i,
  );
  expect(await (await page.request.get("/api/questions")).json()).toHaveLength(
    0,
  );
  await modal
    .getByLabel("صورت سؤال 1", { exact: true })
    .fill("حاصل دو به اضافه دو چند است؟");
  await modal
    .getByLabel("روش پاسخ سؤال 1", { exact: true })
    .selectOption("numeric");
  await modal.getByLabel("پاسخ مرجع سؤال 1", { exact: true }).fill("4");
  await modal
    .getByLabel("درجه سختی سؤال 1", { exact: true })
    .selectOption("easy");
  await modal
    .getByRole("checkbox", { name: /متن، پاسخ، تقسیم سؤال/ })
    .first()
    .check();
  await modal
    .getByRole("button", { name: "تأیید و ورود سؤال ۱ به بانک", exact: true })
    .click();
  await expect(
    modal.getByRole("button", { name: /افزودن سؤال‌های تأییدشده به مأموریت/ }),
  ).toBeEnabled();
  await modal
    .getByRole("button", { name: /افزودن سؤال‌های تأییدشده به مأموریت/ })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByLabel("عنوان مأموریت", { exact: true })).toHaveValue(
    "مأموریت حفظ‌شده هنگام اسکن",
  );
  await expect(page).toHaveURL(/\/homeworks$/);
  await expect(
    page.getByText("۱ سؤال انتخاب شده", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("حاصل دو به اضافه دو چند است؟", { exact: true }),
  ).toBeVisible();
});
