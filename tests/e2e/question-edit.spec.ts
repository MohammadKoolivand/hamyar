import { registerSyntheticUser, syntheticPhone } from "./auth-helpers";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Binary } from "mongodb";
import { connect } from "../../src/server/db";
test("teacher edits question, choices, difficulty and persistent image crop", async ({
  page,
}) => {
  const phone = syntheticPhone();
  await registerSyntheticUser(page, "معلم ویرایش سؤال", "teacher", phone);
  await expect(
    page.getByRole("heading", { name: "معلم ویرایش سؤال", exact: true }),
  ).toBeVisible();
  const { client, db } = await connect();
  const assetId = randomUUID();
  try {
    const teacher = await db.collection("users").findOne({ phone });
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
    const topicResponse = await page.request.post("/api/curriculum", {
      data: { title: "مبحث قابل انتخاب در ویرایش", kind: "topic" },
    });
    expect(topicResponse.ok(), await topicResponse.text()).toBeTruthy();
    const topic = await topicResponse.json();
    await page.goto("/content");
    await page
      .getByRole("button", { name: "کراپ تصویر سؤال", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("اتصال این سؤال به مبحث درسی").check();
    await dialog.getByLabel("پایه ویرایش سؤال").selectOption("ungraded");
    await dialog
      .getByLabel("درس یا کتاب ویرایش سؤال")
      .selectOption("unassigned");
    await dialog.getByLabel("فصل ویرایش سؤال").selectOption("unchaptered");
    await dialog.getByLabel("مبحث درسی سؤال").selectOption(topic._id);
    await dialog
      .getByLabel("متن سؤال", { exact: true })
      .fill("صورت سؤال پس از ویرایش");
    await dialog.getByLabel("درجه سختی").selectOption("hard");
    await dialog
      .getByPlaceholder("مثلاً: $\\sqrt{2}$ یا $\\frac{a}{b}$")
      .first()
      .fill("گزینه تازه");
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
      classification: "topic",
      topicId: topic._id,
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

test("bank shows formula choices, correct-answer check and plain final heh after refresh", async ({
  page,
}) => {
  await registerSyntheticUser(page, "معلم نمایش گزینه‌ها");
  const response = await page.request.post("/api/questions", {
    data: {
      classification: "free",
      statement: "معادلهٔ دارای $\\sqrt[۳]{۸}$ کدام است؟",
      type: "choice",
      options: ["گزینه اول", "$\\sqrt{۴}$"],
      reference: "$\\sqrt{۴}$",
      hints: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  await page.goto("/content");
  const choices = page.getByRole("region", { name: "گزینه‌ها و پاسخ مرجع" });
  await expect(choices.getByText("گزینه اول", { exact: true })).toBeVisible();
  await expect(choices.locator(".katex-html .sqrt svg")).toBeVisible();
  await expect(choices.getByRole("img", { name: "پاسخ صحیح" })).toHaveCount(1);
  const statement = page
    .locator(".hy-question-text")
    .filter({ hasText: "معادله" });
  await expect(statement).toContainText("معادله‌ی دارای");
  await expect(statement).not.toContainText("ة");
  await page.reload();
  await expect(choices.getByRole("img", { name: "پاسخ صحیح" })).toBeVisible();
});
