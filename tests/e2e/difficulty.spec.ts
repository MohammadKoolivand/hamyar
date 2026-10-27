import { useFixtureSession } from "./auth-helpers";
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
    await useFixtureSession(page, f.teacher);
    await expect(
      page.getByRole("button", { name: "خروج", exact: true }),
    ).toBeVisible();
    await page.goto("/homeworks");
    await page
      .getByRole("button", {
        name: "انتخاب خودکار با تعداد و سختی",
        exact: true,
      })
      .click();
    const automatic = page.getByRole("dialog", {
      name: "تنظیم انتخاب خودکار",
      exact: true,
    });
    await automatic.getByLabel("تعداد سؤال متوسط", { exact: true }).fill("0");
    await automatic.getByLabel("تعداد سؤال سخت", { exact: true }).fill("20");
    await automatic
      .getByRole("button", {
        name: "اعمال ترکیب و جایگزینی انتخاب فعلی",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("۲۰ سؤال انتخاب شده", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "انتخاب خودکار با تعداد و سختی",
        exact: true,
      })
      .click();
    await automatic.getByLabel("تعداد سؤال سخت", { exact: true }).fill("21");
    await automatic
      .getByRole("button", {
        name: "اعمال ترکیب و جایگزینی انتخاب فعلی",
        exact: true,
      })
      .click();
    await expect(automatic.getByRole("alert")).toContainText("فقط 20 سؤال");
    await expect(
      page.getByText("۲۰ سؤال انتخاب شده", { exact: true }),
    ).toBeVisible();
    await automatic.getByRole("button", { name: "بستن", exact: true }).click();
    await page.goto("/content");
    await page.getByLabel("درجه سختی", { exact: true }).selectOption("hard");
    await page
      .getByLabel("تعیین گروهی سختی نتایج فیلترشده", { exact: true })
      .selectOption("easy");
    await page
      .getByRole("button", { name: "اعمال روی ۲۰ سؤال فیلترشده", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "سختی ۲۰ سؤال ذخیره شد" }),
    ).toContainText("سختی ۲۰ سؤال ذخیره شد");
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await f.close();
  }
});
