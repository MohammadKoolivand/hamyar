import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
test.use({ serviceWorkers: "block" });
test("teacher selects 20 hard questions and edits filtered difficulty", async ({
  page,
}) => {
  const f = await fixture();
  try {
    for (let i = 0; i < 20; i++)
      await f.post(
        "/api/questions",
        {
          statement: `تمرین سخت مرورگری شماره ${i + 1}`,
          classification: "free",
          type: "numeric",
          reference: "2",
          difficulty: "hard",
        },
        f.teacher,
      );
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const response = await f.app.inject({
        method: request.method() as "GET" | "POST",
        url: url.pathname + url.search,
        headers: request.headers(),
        ...(request.postDataBuffer()
          ? { payload: request.postDataBuffer()! }
          : {}),
      });
      await route.fulfill({
        status: response.statusCode,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(",") : String(v),
          ]),
        ),
        body: response.rawPayload,
      });
    });
    await page.goto("/");
    await page
      .getByLabel("ایمیل یا شماره موبایل", { exact: true })
      .fill("t@test.dev");
    await page.getByLabel("رمز عبور").fill("StrongPass123!");
    await page.getByRole("button", { name: /^ورود به هدهده$/ }).click();
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    await page.goto("/homeworks");
    await page
      .getByLabel("سختی تمرین پیشنهادی", { exact: true })
      .selectOption("hard");
    await page.getByLabel("تعداد سؤال تمرین", { exact: true }).fill("20");
    await page
      .getByRole("button", {
        name: "انتخاب خودکار با تعداد و سختی",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("۲۰ سؤال انتخاب شده", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("تعداد سؤال تمرین", { exact: true }).fill("21");
    await page
      .getByRole("button", {
        name: "انتخاب خودکار با تعداد و سختی",
        exact: true,
      })
      .click();
    await expect(page.getByRole("alert").filter({ hasText: "فقط 20 سؤال" })).toContainText("فقط 20 سؤال");
    await page.goto("/content");
    await page.getByLabel("درجه سختی", { exact: true }).selectOption("hard");
    await page
      .getByLabel("تعیین گروهی سختی نتایج فیلترشده", { exact: true })
      .selectOption("easy");
    await page
      .getByRole("button", { name: "اعمال روی ۲۰ سؤال فیلترشده", exact: true })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "سختی ۲۰ سؤال ذخیره شد" })).toContainText(
      "سختی ۲۰ سؤال ذخیره شد",
    );
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
