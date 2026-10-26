import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend } from "../helpers/browser-backend";
import { AvalaiClient } from "../../src/server/ai/avalai";
test.use({ serviceWorkers: "block" });
test("teacher selects an AvalAI model with controlled external catalog transport, persists it and sees it in authoring", async ({
  page,
}, testInfo) => {
  const f = await fixture({
    avalai: new AvalaiClient({ apiKey: "catalog-fixture-key" }, async () =>
      Response.json({
        data: [
          { id: "fixture-chat-a", owned_by: "fixture-provider", mode: "chat" },
          { id: "fixture-image", owned_by: "fixture-provider", mode: "image" },
        ],
      }),
    ),
  });
  await routeBackend(page, f.app);
  try {
    await page.goto("/settings");
    await page
      .getByRole("button", { name: "ثبت‌نام معلم", exact: true })
      .click();
    await page.getByLabel("نام و نام خانوادگی").fill("معلم تنظیم مدل");
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill(`model-${Date.now()}@test.dev`);
    await page.getByLabel("رمز عبور").fill("StrongPass123!");
    await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
    await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await page.getByRole("button", { name: "تنظیمات", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    const owner = page.getByLabel("ارائه‌دهنده مدل AvvalAI");
    await expect(owner).toBeEnabled({ timeout: 25000 });
    const firstOwner = await owner
      .locator("option")
      .nth(1)
      .getAttribute("value");
    await owner.selectOption(firstOwner!);
    const select = page.getByLabel("مدل تولید سؤال و راهنمای AvvalAI");
    await expect(select).toBeEnabled({ timeout: 25000 });
    const model = await select.locator("option").nth(1).getAttribute("value");
    expect(model).toBeTruthy();
    await select.selectOption(model!);
    await page
      .getByRole("button", { name: "ذخیره مدل هوش مصنوعی", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "مدل تولید سؤال و راهنمای تمرین ذخیره شد",
    );
    const selectedOwner = await owner.inputValue();
    await owner.selectOption("");
    await expect(select).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "ذخیره مدل هوش مصنوعی", exact: true }),
    ).toBeDisabled();
    await page.reload();
    await expect(owner).toHaveValue(selectedOwner);

    await expect(select).toHaveValue(model!);
    const settings = await page.evaluate(async () => {
      const response = await fetch("/api/settings/authoring");
      if (!response.ok) throw new Error("Settings unavailable");
      return response.json();
    });
    expect(settings.model).toBe(model);
    expect(Object.keys(settings).sort()).toEqual([
      "keyConfigured",
      "model",
      "provider",
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("avalai-settings-mobile.png"),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "بازگشت به بانک سؤال و محتوا" })
      .click();
    await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
    await page
      .getByRole("button", { name: "با هوش مصنوعی", exact: true })
      .click();
    await expect(page.getByText(`مدل انتخاب‌شده: ${model}`)).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
  // No paid provider call: actual provider request selection is tested with an injected transport.
});
