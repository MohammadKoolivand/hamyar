import { test, expect } from "@playwright/test";
import { fixture } from "../helpers/fixture";
import { routeBackend, drainBackendRoutes } from "../helpers/browser-backend";
import { useFixtureSession } from "./auth-helpers";

test.use({ serviceWorkers: "block" });
test("unified discovery preserves dependent filters and exports only selected public questions", async ({
  page,
}) => {
  const f = await fixture();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    let parentId: string | undefined;
    const nodes: Record<string, string> = {};
    for (const [kind, title] of [
      ["level", "متوسطه دوم"],
      ["grade", "پایه دوازدهم"],
      ["course", "ریاضی"],
      ["chapter", "تابع"],
      ["topic", "دامنه"],
    ]) {
      const node = await f.post(
        "/api/curriculum",
        { kind, title, ...(parentId ? { parentId } : {}) },
        f.teacher,
      );
      nodes[kind] = node._id;
      parentId = node._id;
    }
    const q = await f.post(
      "/api/questions",
      {
        topicId: nodes.topic,
        visibility: "public",
        statement: "دامنهٔ عبارت $\\sqrt{x}$ چیست؟",
        type: "choice",
        options: ["$x \\ge ۰$", "$x < ۰$"],
        reference: "$x \\ge ۰$",
        source: {
          family: "konkur",
          group: "mathematics",
          location: "domestic",
          session: "اول",
          academicYear: "۱۴۰۵",
          sourceTitle: "آزمون آزمایشی تست مرورگر",
        },
      },
      f.teacher,
    );
    await f
      .c("questionVersions")
      .updateOne({ _id: q._id }, { $set: { difficultyScore: 50 } });
    await f.post(
      "/api/questions",
      {
        classification: "free",
        visibility: "public",
        statement: "نمونه سؤال نهایی مستقل",
        type: "short",
        reference: "کلید محرمانه",
        source: {
          family: "school",
          administration: "final",
          session: "خرداد",
          academicYear: "۱۴۰۴",
        },
      },
      f.teacher,
    );
    await routeBackend(page, f.app);
    await page.goto("/");
    await expect(page.locator(".hy-student-site-header")).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "بخش‌های اصلی" })
        .getByRole("button"),
    ).toHaveCount(2);
    await expect(page.locator(".hy-student-nav-link svg")).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: "تمرین و نمونه‌سؤال", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ورود / ثبت‌نام", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("نمونه سؤال نهایی مستقل", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByLabel("شماره موبایل", { exact: true })).toHaveCount(
      0,
    );
    await page
      .getByRole("button", { name: "ورود برای تمرین آنلاین", exact: true })
      .first()
      .click();
    await expect(
      page.getByLabel("شماره موبایل", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "ادامهٔ مرور بدون ورود", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "تمرین و نمونه‌سؤال", exact: true }),
    ).toBeVisible();
    await useFixtureSession(page, f.student);
    await expect(
      page.getByRole("heading", { name: "تمرین و نمونه‌سؤال", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("نمونه سؤال نهایی مستقل", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "مقطع", exact: true })
      .selectOption("متوسطه دوم");
    await page
      .getByRole("combobox", { name: "پایه", exact: true })
      .selectOption("پایه دوازدهم");
    await page
      .getByRole("combobox", { name: "درس", exact: true })
      .selectOption("ریاضی");
    await page
      .getByRole("combobox", { name: "فصل", exact: true })
      .selectOption("تابع");
    await page
      .getByRole("combobox", { name: "مبحث", exact: true })
      .selectOption("دامنه");
    await page
      .getByRole("combobox", { name: "نوع سؤال / آزمون", exact: true })
      .selectOption("konkur");
    await page
      .getByRole("combobox", { name: "درجهٔ سختی", exact: true })
      .selectOption("medium");
    await expect(
      page.getByRole("combobox", { name: "گروه کنکور", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "گروه کنکور", exact: true })
      .selectOption("mathematics");
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "مبحث", exact: true }),
    ).toHaveValue("دامنه");
    await expect(
      page.getByRole("combobox", { name: "گروه کنکور", exact: true }),
    ).toHaveValue("mathematics");
    await expect(
      page.getByText("نمونه سؤال نهایی مستقل", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("checkbox", { name: /انتخاب برای PDF/ }).check();
    await page.evaluate(() => {
      const original = document.createElement.bind(document);
      document.createElement = ((
        tag: string,
        options?: ElementCreationOptions,
      ) => {
        const element = original(tag, options);
        if (tag === "iframe") {
          element.addEventListener("load", () => {
            const win = (element as HTMLIFrameElement).contentWindow;
            if (win)
              win.print = () =>
                win.document.documentElement.setAttribute(
                  "data-print-requested",
                  "true",
                );
          });
        }
        return element;
      }) as typeof document.createElement;
    });
    await page.getByRole("button", { name: /خروجی PDF/ }).click();
    const printElement = page.locator('iframe[title="خروجی PDF سؤال‌ها"]');
    await expect(printElement).toHaveCount(1);
    const frame = await (await printElement.elementHandle())!.contentFrame();
    await expect(frame!.locator("article")).toHaveCount(1);
    await expect(frame!.locator(".pdf-source")).toHaveText("سراسری ریاضی ۱۴۰۵");
    await expect(frame!.locator(".pdf-option")).toHaveCount(2);
    expect(
      await frame!
        .locator(".pdf-question")
        .evaluate((el) => getComputedStyle(el).borderTopWidth),
    ).toBe("0px");
    expect(
      await frame!
        .locator("body")
        .evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain("questionText");
    expect(
      await frame!.evaluate(() =>
        document.fonts.check("700 16px questionText"),
      ),
    ).toBe(true);
    await expect(frame!.locator(".katex").first()).toBeVisible();
    expect(
      await frame!
        .locator(".katex-mathml")
        .first()
        .evaluate((el) => getComputedStyle(el).position),
    ).toBe("absolute");
    const pdfPage = await page.context().newPage();
    await routeBackend(pdfPage, f.app);
    await pdfPage.goto("/dashboard");
    await pdfPage.setContent(
      await frame!.evaluate(() => document.documentElement.outerHTML),
    );
    await pdfPage.evaluate(() => document.fonts.ready);
    expect(
      await pdfPage
        .locator(".katex-mathml")
        .first()
        .evaluate((el) => getComputedStyle(el).position),
    ).toBe("absolute");
    await pdfPage.screenshot({
      path: "/private/tmp/hodhod-print-page.png",
      fullPage: true,
    });
    await pdfPage.pdf({
      path: "/private/tmp/hodhod-practice-export.pdf",
      format: "A4",
      printBackground: true,
    });
    await pdfPage.close();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page
      .getByRole("button", { name: "فیلتر سؤال‌ها", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "مبحث", exact: true }),
    ).toHaveValue("دامنه");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/private/tmp/hodhod-practice-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await drainBackendRoutes(page);
    await f.close();
  }
});
