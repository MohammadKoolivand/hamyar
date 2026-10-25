import { test, expect } from "@playwright/test";
for (const scenario of [
  "immediate",
  "end",
  "legacy-drafts",
  "unanswered",
] as const) {
  const feedbackMode = scenario === "immediate" ? "immediate" : "end";
  test(`answers save on navigation and finish with ${scenario} feedback`, async ({
    page,
    playwright,
    baseURL,
  }) => {
    const teacher = await playwright.request.newContext({ baseURL });
    const suffix = Date.now();
    const password = "StrongPass123!";
    const t = `practice-teacher-${suffix}@test.dev`,
      s = `practice-student-${suffix}@test.dev`;
    const post = async (context: typeof teacher, url: string, data: object) => {
      const r = await context.post("/api" + url, { data });
      expect(r.ok(), await r.text()).toBeTruthy();
      return r.json();
    };
    try {
      await post(teacher, "/auth/register", {
        name: "معلم تست انتخاب",
        email: t,
        password,
      });
      await post(teacher, "/auth/login", { email: t, password });
      const invite = await post(teacher, "/invitations", { email: s });
      await post(page.request, "/invitations/accept", {
        name: "دانش‌آموز تست انتخاب",
        email: s,
        password,
        token: invite.token,
      });
      await post(page.request, "/auth/login", { email: s, password });
      const students = await (await teacher.get("/api/students")).json();
      const topic = await post(teacher, "/curriculum", {
        title: "مبحث تست گزارش",
        kind: "topic",
      });
      const skill = await post(teacher, "/curriculum", {
        title: "مهارت حل مستقل آزمایشی",
        kind: "skill",
        parentId: topic._id,
      });
      const q1 = await post(teacher, "/questions", {
        classification: "topic",
        topicId: topic._id,
        skillIds: [skill._id],
        statement: "سؤال اول تست انتخاب",
        type: "choice",
        reference: "دو",
        options: ["یک", "دو"],
        hints: [],
      });
      const q2 = await post(teacher, "/questions", {
        classification: "topic",
        topicId: topic._id,
        skillIds: [skill._id],
        statement: "سؤال دوم برای عبور",
        type: "choice",
        reference: "چهار",
        options: ["سه", "چهار"],
        hints: [],
      });
      const mission = await post(teacher, "/missions", {
        title: "تست انتخاب و عبور",
        studentId: students[0]._id,
        questionVersionIds: [q1._id, q2._id],
        policy: {
          maxHints: 0,
          maxAttempts: 1,
          independent: true,
          feedbackMode,
        },
      });
      await post(teacher, `/missions/${mission._id}/publish`, {});
      const assignments = await (
        await page.request.get("/api/missions")
      ).json();
      const assignment = assignments.find(
        (a: { missionId: string }) => a.missionId === mission._id,
      );
      await page.goto(`/practice?assignment=${assignment._id}`);
      if (scenario === "legacy-drafts") {
        const me = await (await page.request.get("/api/auth/me")).json();
        await page.evaluate(
          ({ studentId, assignmentId, firstId, secondId }) => {
            localStorage.setItem(
              `draft:${studentId}:${assignmentId}:${firstId}`,
              "یک",
            );
            localStorage.setItem(
              `draft:${studentId}:${assignmentId}:${secondId}`,
              "چهار",
            );
          },
          {
            studentId: me._id,
            assignmentId: assignment._id,
            firstId: q1._id,
            secondId: q2._id,
          },
        );
        await page.reload();
        await expect(
          page.getByRole("radio", { name: "یک", exact: true }),
        ).toBeChecked();
        await page
          .getByRole("button", { name: "پایان تمرین و گزارش", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "محیط تمرین", exact: true }),
        ).not.toBeVisible();
        const result = await (
          await page.request.get(`/api/assignments/${assignment._id}`)
        ).json();
        expect(result.state).toBe("completed");
        expect(result.attempts).toHaveLength(2);
        return;
      }

      await expect(
        page.getByRole("button", { name: "سؤال بعدی", exact: true }),
      ).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "رد کردن و سؤال بعدی", exact: true }),
      ).toHaveCount(0);
      if (feedbackMode === "end")
        await expect(
          page.getByRole("button", { name: "ثبت و بررسی پاسخ", exact: true }),
        ).toHaveCount(0);
      await page.getByText("یک", { exact: true }).click();
      await page
        .getByRole("button", { name: "سؤال بعدی", exact: true })
        .click();
      await expect(
        page.getByText("سؤال دوم برای عبور", { exact: true }),
      ).toBeVisible();
      if (feedbackMode === "immediate")
        await expect(page.getByText(/نتیجه سؤال ۱:/)).toBeVisible();
      else await expect(page.getByText(/نتیجه سؤال ۱:/)).toHaveCount(0);
      const firstDetail = await (
        await page.request.get(`/api/assignments/${assignment._id}`)
      ).json();
      expect(firstDetail.progress[q1._id].attempts).toBe(1);
      if (feedbackMode === "end") {
        expect(firstDetail.evaluations).toEqual([]);
        expect(
          (
            await page.request.get(`/api/assignments/${assignment._id}/report`)
          ).status(),
        ).toBe(409);
      }
      await page
        .getByRole("button", { name: "سؤال قبلی", exact: true })
        .click();
      await expect(
        page.getByRole("radio", { name: "یک", exact: true }),
      ).toBeChecked();
      await page.reload();
      await expect(
        page.getByRole("radio", { name: "یک", exact: true }),
      ).toBeChecked();
      await page
        .getByRole("button", { name: "سؤال بعدی", exact: true })
        .click();
      if (scenario === "unanswered") {
        page.once("dialog", (dialog) => dialog.accept());
        await page
          .getByRole("button", { name: "پایان تمرین و گزارش", exact: true })
          .click();
        await expect(page.locator(`#report-question-${q2._id}`)).toContainText(
          "نزده",
        );
        await expect(page.locator(`#report-question-${q2._id}`)).toHaveClass(
          /border-blue-200/,
        );
        await expect(
          page
            .locator(`#report-question-${q2._id}`)
            .getByText("نزده", { exact: true }),
        ).toHaveClass(/border-amber-200/);
        await expect(page.locator(`#report-question-${q1._id}`)).toHaveClass(
          /border-blue-200/,
        );
        const report = await (
          await page.request.get(`/api/assignments/${assignment._id}/report`)
        ).json();
        expect(report.unanswered).toBe(1);
        return;
      }
      await page.getByText("چهار", { exact: true }).click();
      await page
        .getByRole("button", { name: "پایان تمرین و گزارش", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "محیط تمرین", exact: true }),
      ).not.toBeVisible();
      const detail = await (
        await page.request.get(`/api/assignments/${assignment._id}`)
      ).json();
      expect(detail.state).toBe("completed");
      expect(detail.attempts).toHaveLength(2);
      const report = await (
        await page.request.get(`/api/assignments/${assignment._id}/report`)
      ).json();
      expect(report.answered).toBe(2);
      expect(report.independent).toBe(1);
      await expect(page.locator(`#report-question-${q1._id}`)).toHaveClass(
        /border-blue-200/,
      );
      await expect(page.locator(`#report-question-${q2._id}`)).toHaveClass(
        /border-blue-200/,
      );
      await expect(
        page
          .locator(`#report-question-${q1._id}`)
          .getByText("انتخاب شما", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator(`#report-question-${q1._id}`)
          .getByText("✓ پاسخ صحیح", { exact: true }),
      ).toBeVisible();
      if (scenario === "end") {
        await page
          .getByLabel("فیلتر نتیجه", { exact: true })
          .selectOption("incorrect");
        await expect(page.locator(`#report-question-${q2._id}`)).toHaveCount(0);
        await page
          .getByLabel("فیلتر نتیجه", { exact: true })
          .selectOption("all");
        await page.screenshot({
          path: "/tmp/hamyar-report-preview.png",
          fullPage: true,
        });
        await page.goto("/learning");
        await expect(
          page.getByRole("heading", { name: "در یک نگاه", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: "تمرین‌های اخیر و نتیجه واقعی",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", {
            name: "مهارت حل مستقل آزمایشی",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("progressbar", {
            name: "نسبت موفقیت مستقل مهارت حل مستقل آزمایشی",
            exact: true,
          }),
        ).toHaveAttribute("value", "1");
        await page.screenshot({
          path: "/tmp/hamyar-learning-preview.png",
          fullPage: true,
        });
      }
    } finally {
      await teacher.dispose();
    }
  });
}
