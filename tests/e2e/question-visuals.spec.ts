import { chooseTopic } from "./curriculum-helpers";
import { test, expect } from "@playwright/test";
test("teacher edits chart, diagram and formula; approved visual question persists and student sees the same media", async ({
  page,
  browser,
}, testInfo) => {
  const suffix = Date.now(),
    base = "http://127.0.0.1:5174";
  await page.goto("/content");
  await page.getByRole("button", { name: "ثبت‌نام معلم", exact: true }).click();
  await page.getByLabel("نام و نام خانوادگی").fill("معلم سؤال تصویری");
  await page
    .getByLabel("ایمیل یا شماره موبایل", { exact: true })
    .fill(`visual-${suffix}@test.dev`);
  await page.getByLabel("رمز عبور").fill("StrongPass123!");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.getByRole("button", { name: /^ورود به (همیار|هدهد)$/ }).click();
  await page
    .getByRole("button", { name: "بانک سؤال و محتوا", exact: true })
    .click();
  const topic = await (
    await page.request.post("/api/curriculum", {
      data: { title: "نمودارهای حرکت", kind: "topic" },
    })
  ).json();
  await page.getByRole("link", { name: "افزودن سؤال", exact: true }).click();
  await page.reload();
  await chooseTopic(page, topic._id);
  await page
    .getByLabel("صورت سؤال", { exact: true })
    .fill(
      "شتاب حرکت را از نمودار سرعت–زمان حساب کنید؛ $a=\\frac{\\Delta v}{\\Delta t}$",
    );
  await page.getByLabel("پاسخ مرجع خصوصی", { exact: true }).fill("2");
  await page
    .getByText("افزودن نمودار، شکل یا فرمول به سؤال دستی", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "افزودن نمودار", exact: true })
    .click();
  await page.getByRole("button", { name: "افزودن فرمول", exact: true }).click();
  await page
    .getByLabel("فرمول LaTeX 2")
    .fill(String.raw`a = \frac{\Delta v}{\Delta t}`);
  await page.getByRole("button", { name: "افزودن شکل", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "نمودار سرعت–زمان", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "مثلث ABC", exact: true }),
  ).toBeVisible();
  await expect(page.locator("mfrac")).not.toHaveCount(0);
  await page
    .getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true })
    .click();
  await expect(page.getByText("بانک سؤال خصوصی · ۱ سؤال")).toBeVisible();
  await page
    .getByRole("link", { name: "بازگشت به بانک سؤال", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("img", { name: "نمودار سرعت–زمان", exact: true }),
  ).toBeVisible();
  const questions = await (await page.request.get("/api/questions")).json();
  expect(questions[0].visuals).toHaveLength(3);
  const email = `visual-student-${suffix}@test.dev`;
  const invite = await (
    await page.request.post("/api/invitations", { data: { email } })
  ).json();
  const sc = await browser.newContext(),
    sp = await sc.newPage();
  try {
    expect(
      (
        await sc.request.post(base + "/api/invitations/accept", {
          data: {
            name: "دانش‌آموز آزمایشی",
            email,
            password: "StrongPass123!",
            token: invite.token,
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await sc.request.post(base + "/api/auth/login", {
          data: { email, password: "StrongPass123!" },
        })
      ).ok(),
    ).toBe(true);
    const students = await (await page.request.get("/api/students")).json();
    const mission = await (
      await page.request.post("/api/missions", {
        data: {
          title: "تمرین تصویری",
          studentId: students.find((s: { email: string }) => s.email === email)
            ._id,
          questionVersionIds: [questions[0]._id],
          policy: { maxAttempts: 3, maxHints: 0, independent: true },
        },
      })
    ).json();
    expect(
      (
        await page.request.post(`/api/missions/${mission._id}/publish`, {
          data: {},
        })
      ).ok(),
    ).toBe(true);
    const assignments = await (
      await page.request.get("/api/assignments")
    ).json();
    const aid = assignments.find(
      (a: { missionId: string }) => a.missionId === mission._id,
    )._id;
    await sp.goto(`${base}/practice?assignment=${aid}`);
    await expect(
      sp.getByRole("img", { name: "نمودار سرعت–زمان", exact: true }),
    ).toBeVisible();
    await expect(
      sp.getByRole("img", { name: "مثلث ABC", exact: true }),
    ).toBeVisible();
    await expect(sp.locator("mfrac")).not.toHaveCount(0);
    const publicQuestion = (
      await (await sc.request.get(`${base}/api/assignments/${aid}`)).json()
    ).questions[0];
    expect(publicQuestion.visuals).toEqual(questions[0].visuals);
    expect(publicQuestion.reference).toBeUndefined();
    await sp.screenshot({
      path: testInfo.outputPath("visual-practice-desktop.png"),
      fullPage: true,
    });
    await sp.setViewportSize({ width: 390, height: 844 });
    expect(
      await sp.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await sp.screenshot({
      path: testInfo.outputPath("visual-practice-mobile.png"),
      fullPage: true,
    });
    await sp.reload();
    await expect(
      sp.getByRole("img", { name: "نمودار سرعت–زمان", exact: true }),
    ).toBeVisible();
  } finally {
    await sc.close();
  }
});
