import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Binary } from "mongodb";
import { connect } from "../../src/server/db";
test("teacher edits question, choices, difficulty and persistent image crop", async ({
  page,
}) => {
  const email = `edit-${Date.now()}@test.dev`;
  await page.goto("/content");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم ویرایش سؤال");
  await page.getByLabel("ایمیل", { exact: true }).fill(email);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /ورود به (همیار|هدهد)/ }).click();
  await expect(
    page.getByRole("heading", { name: "معلم ویرایش سؤال", exact: true }),
  ).toBeVisible();
  const { client, db } = await connect();
  const assetId = randomUUID();
  try {
    const teacher = await db.collection("users").findOne({ email });
    expect(teacher).toBeTruthy();
    await db.collection("questionAssets").insertOne({
      _id: assetId as never,
      ownerId: teacher!._id,
      mime: "image/png",
      data: new Binary(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
          "base64",
        ),
      ),
    });
    const response = await page.request.post("/api/questions", {
      data: {
        classification: "free",
        statement: "صورت سؤال اولیه",
        type: "choice",
        options: ["اول", "دوم"],
        reference: "دوم",
        visuals: [
          {
            kind: "image",
            assetId,
            width: 100,
            height: 100,
            caption: "تصویر تست سؤال",
          },
        ],
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const old = await response.json();
    await page.goto("/content");
    await page
      .getByRole("button", { name: "کراپ تصویر سؤال", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("متن سؤال", { exact: true })
      .fill("صورت سؤال پس از ویرایش");
    await dialog.getByLabel("درجه سختی").selectOption("hard");
    await dialog.getByLabel("گزینه 1", { exact: true }).fill("گزینه تازه");
    await dialog.getByRole("radio").first().check();
    const surface = dialog.getByRole("group", {
      name: "انتخاب محدوده برش تصویر",
    });
    await surface.scrollIntoViewIfNeeded();
    const box = (await surface.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, {
      steps: 5,
    });
    await page.mouse.up();
    expect(
      Number(await dialog.getByLabel("عرض برش (%)").inputValue()),
    ).toBeGreaterThan(65);
    await dialog.getByLabel("فاصله از چپ (%)").fill("10");
    await dialog.getByLabel("فاصله از بالا (%)").fill("0");
    await dialog.getByLabel("ارتفاع برش (%)").fill("100");
    await dialog.getByLabel("عرض برش (%)").fill("70");
    await dialog
      .getByRole("button", { name: "اعمال برش", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "ذخیره نسخه جدید", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByText("صورت سؤال پس از ویرایش", { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('svg[aria-label="تصویر تست سؤال"]'),
    ).toHaveAttribute("viewBox", "10 0 70 100");
    const bank = await (await page.request.get("/api/questions")).json();
    expect(bank).toHaveLength(1);
    expect(bank[0]).toMatchObject({
      version: 2,
      reference: "گزینه تازه",
      difficulty: "hard",
    });
    expect(bank[0].visuals[0].crop).toEqual({
      x: 10,
      y: 0,
      width: 70,
      height: 100,
    });
    const original = await (
      await page.request.get(`/api/questions/${old._id}`)
    ).json();
    expect(original.statement).toBe("صورت سؤال اولیه");
    await page
      .getByRole("button", { name: "ویرایش سؤال", exact: true })
      .click();
    await page.getByRole("button", { name: "کراپ تصویر", exact: true }).click();
    await expect(page.getByLabel("عرض برش (%)")).toHaveValue("70");
    await page.getByLabel("عرض برش (%)").fill("50");
    await page
      .getByRole("button", { name: "انصراف از برش", exact: true })
      .click();
    await page.getByRole("button", { name: "کراپ تصویر", exact: true }).click();
    await expect(page.getByLabel("عرض برش (%)")).toHaveValue("70");
  } finally {
    await client.close();
  }
});
