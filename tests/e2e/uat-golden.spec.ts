import {
  test,
  expect as baseExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { registerSyntheticUser, loginSyntheticUser, syntheticPhone } from "./auth-helpers";
import { chooseParent, chooseTopic } from "./curriculum-helpers";
import { textPdf } from "../helpers/pdf";

// A page refresh can issue 15 requests; with the deliberate 650ms pacing,
// it takes ~10s. Keep assertions strict while allowing this explicit test delay.
const expect = baseExpect.configure({ timeout: 20000 });
test.use({ actionTimeout: 20000, serviceWorkers: "block" });
function respectReadLimit(page: Page) {
  const original = page.request.get.bind(page.request);
  page.request.get = async (...args: Parameters<typeof original>) => {
    let response = await original(...args);
    if (response.status() === 429) {
      const seconds = Number(response.headers()["retry-after"] ?? 60);
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.min(65, Math.max(1, seconds + 1)) * 1000),
      );
      response = await original(...args);
    }
    return response;
  };
}
const password = "UatSyntheticPass123!";
async function signup(page: Page, role: "teacher" | "student", identity: string, name: string) {
  await registerSyntheticUser(page, name, role, identity, password);
}

for (const cohort of [1, 2])
  test(`UAT GOLD cohort ${cohort}: actual UI five questions, independent/helped results, remediation, parent and isolation`, async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(300000);
    const teacherEmail = syntheticPhone();
    const phone = `091${String(Date.now() + cohort).slice(-8)}`;
    const parentPhone = `093${String(Date.now() + cohort).slice(-8)}`;
    const contexts: BrowserContext[] = [];
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    respectReadLimit(page);
    // Real HTTP, paced below the existing 120 requests/minute user limit.
    // Do not raise the application limiter to accommodate automation.
    let nextRequest = 0;
    await page.route("**/api/**", async (route) => {
      const delay = Math.max(0, nextRequest - Date.now());
      nextRequest = Math.max(nextRequest, Date.now()) + 650;
      if (delay)
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      await route.continue();
    });

    async function personPage() {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      contexts.push(context);
      const p = await context.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      respectReadLimit(p);
      let next = 0;
      await p.route("**/api/**", async (route) => {
        const delay = Math.max(0, next - Date.now());
        next = Math.max(next, Date.now()) + 650;
        if (delay)
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        await route.continue();
      });
      return p;
    }
    try {
      await signup(page, "teacher", teacherEmail, "Teacher A UAT");
      await page.goto("/courses");
      await page.getByLabel("نام درس", { exact: true }).fill("ریاضی");
      await page
        .getByLabel("عنوان دوره", { exact: true })
        .fill("ریاضی دهم UAT");
      await page
        .getByRole("button", { name: "ایجاد درس", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "ریاضی دهم UAT", exact: true }),
      ).toBeVisible();
      const courses = await (await page.request.get("/api/courses")).json();
      const course = courses.find(
        (c: { title: string }) => c.title === "ریاضی دهم UAT",
      );
      expect(course).toBeTruthy();
      await page.goto("/resources");
      await page
        .getByRole("heading", { name: "ساختار آموزشی شما", exact: true })
        .click();
      const nodes: { _id: string; title: string }[] = [];
      for (const [kind, title] of [
        ["grade", "پایه دهم UAT"],
        ["course", "کتاب ریاضی دهم UAT"],
        ["chapter", "معادله درجه دوم"],
        ["topic", "حل معادله درجه دوم"],
        ["skill", "تشخیص ضرایب"],
      ]) {
        await page.getByLabel("نوع", { exact: true }).selectOption(kind);
        await page.getByLabel("عنوان", { exact: true }).fill(title);
        if (nodes.length) await chooseParent(page, nodes.at(-1)!._id);
        await page
          .getByRole("button", { name: "افزودن به ساختار", exact: true })
          .click();
        await expect(page.getByLabel("عنوان", { exact: true })).toHaveValue("");
        const rows = await (await page.request.get("/api/curriculum")).json();
        nodes.push(rows.find((n: { title: string }) => n.title === title));
      }
      const topic = nodes[3];
      await page.goto("/content-new");
      await chooseTopic(page, topic._id);
      await page.getByLabel("تشخیص ضرایب", { exact: true }).check();
      for (let i = 1; i <= 5; i++) {
        await page
          .getByLabel("روش پاسخ", { exact: true })
          .selectOption("numeric");
        await page
          .getByLabel("صورت سؤال", { exact: true })
          .fill(`سؤال طلایی ${i}: حاصل ${i} به اضافه یک چیست؟`);
        await page
          .getByLabel("پاسخ مرجع خصوصی", { exact: true })
          .fill(String(i + 1));
        await page
          .getByLabel("راهنمایی‌های تأییدشده")
          .fill("از عدد داده‌شده یک گام جلو برو.");
        await page
          .getByRole("button", { name: "تأیید و ذخیره سؤال", exact: true })
          .click();
        await expect(
          page.getByText(
            `بانک سؤال خصوصی · ${i.toLocaleString("fa-IR")} سؤال`,
            { exact: true },
          ),
        ).toBeVisible();
      }
      const questions = await (await page.request.get("/api/questions")).json();
      expect(questions).toHaveLength(5);
      // A sixth PDF question is actually extracted and reviewed, but is not silently included in this five-item mission.
      await page.goto("/exam-import");
      await expect(
        page.getByLabel("رشته یا گروه (اختیاری)", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByLabel("سال آزمون (اختیاری)").locator('option[value="1405"]'),
      ).toHaveText("۱۴۰۵");
      await page.getByLabel("پایه (اختیاری)").selectOption("10");
      await expect(
        page.getByLabel("رشته یا گروه (اختیاری)", { exact: true }),
      ).toBeVisible();
      await page.getByLabel("پایه (اختیاری)").selectOption("7");
      await expect(
        page.getByLabel("رشته یا گروه (اختیاری)", { exact: true }),
      ).toHaveCount(0);
      await page.getByLabel("درس آزمون", { exact: true }).selectOption("ریاضی");
      await page
        .getByRole("button", {
          name: "ثبت آزمون و ادامه به آپلود",
          exact: true,
        })
        .click();
      await page.getByLabel("دفترچه سؤال‌ها", { exact: true }).setInputFiles({
        name: "golden.pdf",
        mimeType: "application/pdf",
        buffer: textPdf(["1. What is 5 plus 5?"]),
      });
      await expect(page.getByRole("status")).toContainText(
        "فایل در سرور ذخیره شد",
      );
      await page
        .getByRole("button", {
          name: "استخراج متن و ایجاد پیش‌نویس سؤال‌ها",
          exact: true,
        })
        .click();
      await expect(page.getByLabel("صورت سؤال 1", { exact: true })).toBeVisible(
        { timeout: 30000 },
      );
      await page
        .getByLabel("صورت سؤال 1", { exact: true })
        .fill("سؤال بازبینی‌شده PDF: پنج به اضافه پنج؟");
      await page
        .getByLabel("روش پاسخ سؤال 1", { exact: true })
        .selectOption("numeric");
      await page.getByLabel("پاسخ مرجع سؤال 1", { exact: true }).fill("10");
      await page
        .getByRole("checkbox", { name: /متن، پاسخ، تقسیم سؤال/ })
        .first()
        .check();
      const reviewCommitted = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/items\/[^/]+\/review$/.test(new URL(response.url()).pathname),
        { timeout: 60000 },
      );
      await page
        .getByRole("button", {
          name: "تأیید و ورود سؤال ۱ به بانک",
          exact: true,
        })
        .click();
      expect((await reviewCommitted).status()).toBe(200);
      await expect
        .poll(
          async () =>
            (await (await page.request.get("/api/questions")).json()).length,
        )
        .toBe(6);

      const studentPage = await personPage();
      await signup(studentPage, "student", phone, "Student A UAT");
      await page.goto("/students");
      await page
        .getByLabel("شماره موبایل دانش‌آموز", { exact: true })
        .fill(phone);
      await page
        .getByLabel("درس دعوت", { exact: true })
        .selectOption(course._id);
      await page
        .getByRole("button", { name: "ایجاد دعوت", exact: true })
        .click();
      const token = await page.getByTestId("invitation-token").innerText();
      await studentPage
        .getByLabel("شماره موبایل دعوت‌شده", { exact: true })
        .fill(phone);
      await studentPage.getByLabel("کد دعوت معلم", { exact: true }).fill(token);
      await studentPage
        .getByRole("button", { name: "اتصال به معلم", exact: true })
        .click();
      await expect(studentPage.getByRole("status")).toContainText(
        "اتصال به معلم انجام شد",
      );
      await page.reload();
      const students = await (await page.request.get("/api/students")).json();
      const student = students.find(
        (s: { name: string }) => s.name === "Student A UAT",
      );
      await page.goto("/homeworks");
      await page
        .getByLabel("عنوان مأموریت", { exact: true })
        .fill("مأموریت طلایی پنج‌سؤالی");
      await page
        .getByLabel("درس مأموریت", { exact: true })
        .selectOption(course._id);
      await page
        .getByLabel("دانش‌آموز", { exact: true })
        .selectOption(student._id);
      await page
        .getByLabel("زمان نمایش نتیجه به دانش‌آموز", { exact: true })
        .selectOption("immediate");
      for (const q of questions)
        await page.getByText(q.statement, { exact: true }).click();
      await page
        .getByRole("button", { name: "ساخت پیش‌نویس مأموریت", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "پیش‌نویس ساخته شد" }),
      ).toBeVisible();
      await page.reload();
      await page
        .getByRole("button", { name: "انتشار برای دانش‌آموز", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "گزارش و شواهد", exact: true }),
      ).toBeVisible();
      await studentPage.goto("/homeworks");
      await studentPage
        .getByRole("button", { name: "شروع / ادامه تمرین", exact: true })
        .click();
      await expect(studentPage).toHaveURL(
        /\/practice\?assignment=[a-f0-9-]{36}/,
      );
      const assignment = new URL(studentPage.url()).searchParams.get(
        "assignment",
      )!;
      const path = `/api/assignments/${assignment}`;
      for (let i = 0; i < 5; i++) {
        await expect(
          studentPage.getByText(questions[i].statement, { exact: true }),
        ).toBeVisible();
        if (i === 2) {
          await studentPage
            .getByRole("button", { name: "درخواست راهنمایی", exact: true })
            .click();
          await expect(
            studentPage
              .locator(".glass-note")
              .filter({ hasText: "از عدد داده‌شده یک گام جلو برو." }),
          ).toBeVisible();
        }
        await studentPage
          .getByLabel("پاسخ شما", { exact: true })
          .fill(i === 1 ? "99" : String(i + 2));
        await studentPage
          .getByRole("button", { name: "ثبت و بررسی پاسخ", exact: true })
          .click();
        await expect(
          studentPage.getByText(
            i === 1
              ? "نیازمند اصلاح · بدون دریافت کمک"
              : i === 2
                ? "صحیح · با دریافت کمک"
                : "صحیح · بدون دریافت کمک",
            { exact: true },
          ),
        ).toBeVisible();
        if (i < 4)
          await studentPage
            .getByRole("button", { name: "سؤال بعدی", exact: true })
            .click();
      }
      await studentPage
        .getByRole("button", { name: "پایان تمرین و گزارش", exact: true })
        .click();
      await expect(studentPage).toHaveURL(
        new RegExp(`/report\\?assignment=${assignment}`),
      );
      const report = await (
        await studentPage.request.get(path + "/report")
      ).json();
      expect(report).toMatchObject({
        total: 5,
        answered: 5,
        independent: 3,
        assisted: 1,
        incorrect: 1,
        hints: 1,
        pending: 0,
      });
      expect(report.evidence).toHaveLength(5);
      await studentPage.reload();
      expect(
        await (await studentPage.request.get(path + "/report")).json(),
      ).toEqual(report);
      await page.goto(`/report?assignment=${assignment}`);
      const teacherBaseline = await (
        await page.request.get(path + "/report")
      ).json();
      // Privileged evidence differs; every public counter must be identical.
      expect(teacherBaseline).toMatchObject({
        total: 5,
        answered: 5,
        independent: 3,
        assisted: 1,
        incorrect: 1,
        hints: 1,
        pending: 0,
      });
      await page.screenshot({
        path: info.outputPath("golden-teacher-report.png"),
        fullPage: true,
      });
      await studentPage.screenshot({
        path: info.outputPath("golden-student-report.png"),
        fullPage: true,
      });
      const candidates = await (
        await page.request.get(
          `/api/students/${student._id}/remediation-candidates?courseId=${course._id}`,
        )
      ).json();
      expect(
        candidates.items.map(
          (q: { questionVersionId: string }) => q.questionVersionId,
        ),
      ).toEqual([questions[1]._id]);
      await page.goto("/homeworks");
      const remedial = page.getByTestId("individual-remediation");
      await remedial
        .getByLabel("دانش‌آموز برای تمرین فردی")
        .selectOption(student._id);
      await remedial
        .getByRole("checkbox", { name: new RegExp(questions[1].statement) })
        .check();
      await remedial
        .getByRole("checkbox", {
          name: "سنجش مستقل (یک تلاش، بدون راهنمایی)",
          exact: true,
        })
        .check();
      await remedial
        .getByRole("button", {
          name: "انتشار تمرین تقویتی برای این دانش‌آموز",
          exact: true,
        })
        .click();
      await expect(
        remedial.getByText("تمرین تقویتی فقط برای این دانش‌آموز منتشر شد."),
      ).toBeVisible();
      const remedialAssignment = (
        await (await studentPage.request.get("/api/assignments")).json()
      ).find((a: { remediation?: boolean }) => a.remediation);
      await studentPage.goto(`/practice?assignment=${remedialAssignment._id}`);
      await studentPage.getByLabel("پاسخ شما", { exact: true }).fill("3");
      await studentPage
        .getByRole("button", { name: "ثبت و بررسی پاسخ", exact: true })
        .click();
      await studentPage
        .getByRole("button", { name: "پایان تمرین و گزارش", exact: true })
        .click();
      expect(
        await (
          await studentPage.request.get(
            `/api/assignments/${remedialAssignment._id}/report`,
          )
        ).json(),
      ).toMatchObject({ independent: 1, assisted: 0, hints: 0 });
      expect(
        (
          await (
            await page.request.get(
              `/api/students/${student._id}/remediation-candidates?courseId=${course._id}`,
            )
          ).json()
        ).items,
      ).toHaveLength(0);
      expect(await (await page.request.get(path + "/report")).json()).toEqual(
        teacherBaseline,
      );
      await page.goto("/students");
      await page.getByText("دسترسی اولیا", { exact: true }).click();
      await page.getByLabel("شماره موبایل ولی دانش‌آموز").fill(parentPhone);
      await page
        .getByRole("button", { name: "ایجاد دعوت اولیا", exact: true })
        .click();
      const parentInvite = await page
        .getByTestId("parent-invitation-token")
        .innerText();
      const parentPage = await personPage();
      const parentInviteToken = new URL(parentInvite).searchParams.get("invite");
      expect(parentInviteToken).toBeTruthy();
      const parentClaim = await parentPage.request.post("/api/invitations/accept", {
        data: { name: "Parent A UAT", phone: parentPhone, password, token: parentInviteToken },
      });
      expect(parentClaim.ok(), await parentClaim.text()).toBe(true);
      await loginSyntheticUser(parentPage, parentPhone, password);
      await expect(
        parentPage.getByRole("heading", { name: "پنل اولیا", exact: true }),
      ).toBeVisible();
      expect((await parentPage.request.get(path + "/report")).status()).toBe(
        200,
      );
      expect(
        (
          await parentPage.request.post(path + "/attempts", {
            data: { questionId: questions[0]._id, answer: "2" },
          })
        ).status(),
      ).toBe(403);
      const other = await personPage();
      await signup(
        other,
        "teacher",
        syntheticPhone(),
        "Teacher B UAT",
      );
      expect((await other.request.get(path + "/report")).status()).toBe(404);
      expect(
        await (await other.request.get("/api/questions")).json(),
      ).toHaveLength(0);
      await studentPage
        .getByRole("button", { name: "خروج", exact: true })
        .click();
      await loginSyntheticUser(studentPage, phone, password);
      await expect(
        studentPage.getByRole("button", { name: "خروج", exact: true }),
      ).toBeVisible();
      await studentPage.goto(`/report?assignment=${assignment}`);
      const restoredReport = await studentPage.request.get(path + "/report");
      expect(restoredReport.status()).toBe(200);
      expect(await restoredReport.json()).toEqual(report);
      expect(errors).toEqual([]);
      await info.attach("golden-result", {
        body: JSON.stringify({
          cohort,
          assignment,
          courseId: course._id,
          expected: {
            answered: 5,
            independent: 3,
            assisted: 1,
            incorrect: 1,
            hints: 1,
          },
          report,
        }),
        contentType: "application/json",
      });
    } finally {
      for (const context of contexts) await context.close();
    }
  });
