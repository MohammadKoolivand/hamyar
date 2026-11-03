import { test, expect } from "@playwright/test";
import { registerSyntheticUser } from "./auth-helpers";
import { connect, collection } from "../../src/server/db";

test("existing Arabic-letter question text displays in Persian and new saves keep option/answer matching", async ({
  page,
}) => {
  await registerSyntheticUser(page, "معلم نویسه فارسی");
  const response = await page.request.post("/api/questions", {
    data: {
      classification: "free",
      statement: "كدام جملة درباره سوالها صحيح است؟",
      type: "choice",
      options: ["اولي", "دومي"],
      reference: "دومي",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const saved = await response.json();
  expect(saved.statement).toBe("كدام جمله درباره سوال‌ها صحیح است؟");
  expect(saved.options).toEqual(["اولی", "دومی"]);
  expect(saved.reference).toBe("دومی");
  // Simulate an immutable legacy version: display must normalize without a migration.
  const { client, db } = await connect();
  try {
    await collection(db, "questionVersions").updateOne(
      { _id: saved._id },
      {
        $set: {
          statement: "كدام جملة درباره سوالها صحيح است؟",
          options: ["اولي", "دومي"],
          reference: "دومي",
        },
      },
    );
    await page.goto("/content");
    const card = page.locator("article");
    await expect(card).toContainText("كدام جمله درباره سوال‌ها صحیح است؟");
    await expect(card).toContainText("اولی");
    await expect(card).toContainText("دومی");
    expect(await card.textContent()).not.toMatch(/[يىة]/);
    await card
      .getByRole("button", { name: "ویرایش سؤال", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("متن سؤال", { exact: true }),
    ).toHaveValue("كدام جمله درباره سوال‌ها صحیح است؟");
    await expect(
      page.getByRole("dialog").getByLabel("گزینه 1", { exact: true }),
    ).toHaveValue("اولی");
    expect(
      (await collection(db, "questionVersions").findOne({ _id: saved._id }))!
        .statement,
    ).toBe("كدام جملة درباره سوالها صحيح است؟");
  } finally {
    await client.close();
  }
});
