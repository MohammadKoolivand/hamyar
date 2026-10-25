import { feedbackVisible } from "../../lib/practice-answer";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import type { HintProvider } from "../domain";
import { recordLearning } from "../learning/service";
export function registerAnalytics(
  app: FastifyInstance,
  ctx: Context,
  provider: HintProvider,
) {
  const { c, user, assignment, now, fail } = ctx;
  app.get("/api/assignments/:aid/report", async (r) => {
    const { u, a } = await assignment(r);
    if (u.role !== "teacher" && !feedbackVisible(a.policy, a.state))
      fail(409, "نتیجه پس از پایان تمرین نمایش داده می‌شود");
    return ctx.transaction(async (session) => {
      const attempts = await c("attempts")
          .find({ assignmentId: a._id }, { session })
          .sort({ sequence: 1 })
          .toArray(),
        evals = await c("evaluations")
          .find({ assignmentId: a._id }, { session })
          .toArray();
      const evidence = attempts.map((t) => ({
        ...t,
        answer: t.answer as string,
        sequence: t.sequence as number,
        questionVersionId: t.questionVersionId as string,
        hintsUsed: t.hintsUsed as number,
        evaluation: evals.find((e) => e.attemptId === t._id),
      }));
      const first = evidence.filter(
        (t) =>
          t.sequence === 1 &&
          t.evaluation &&
          t.evaluation.result !== "pending_review",
      );
      const latest = a.questionVersionIds
        .map((q: string) =>
          evidence.filter((t) => t.questionVersionId === q).at(-1),
        )
        .filter(Boolean) as typeof evidence;
      const independent = latest.filter(
          (t) => t.hintsUsed === 0 && t.evaluation?.result === "correct",
        ).length,
        assisted = latest.filter(
          (t) => t.hintsUsed > 0 && t.evaluation?.result === "correct",
        ).length;
      const versions = await c("questionVersions")
        .find({ _id: { $in: a.questionVersionIds } }, { session })
        .toArray();
      const nodes = await c("curriculum")
        .find({ ownerId: a.teacherId }, { session })
        .project({ _id: 1, title: 1 })
        .toArray();
      const revealKey =
        u.role === "teacher" || ["submitted", "completed"].includes(a.state);
      const questions = a.questionVersionIds.map(
        (qid: string, index: number) => {
          const q = versions.find((q) => q._id === qid);
          const history = evidence.filter((t) => t.questionVersionId === qid);
          const last = history.at(-1);
          const result = !last
            ? "unanswered"
            : (last.evaluation?.result ?? "pending_review");
          const topic =
            nodes.find((n) => n._id === q?.topicId)?.title ?? "بدون مبحث مشخص";
          return {
            _id: qid,
            number: index + 1,
            statement: q?.statement ?? "سؤال در دسترس نیست",
            type: q?.type ?? "short",
            options: q?.options ?? [],
            visuals: q?.visuals ?? [],
            ...(revealKey && q ? { reference: q.reference } : {}),
            answer: last?.answer ?? null,
            result,
            hintsUsed: last?.hintsUsed ?? 0,
            attempts: history.length,
            topic,
            difficulty: q?.difficulty ?? null,
            analysis:
              result === "unanswered"
                ? "پاسخی ثبت نشده؛ ابتدا یک تلاش مستقل برای این مبحث انجام دهید."
                : result === "correct"
                  ? last!.hintsUsed > 0
                    ? "پاسخ با دریافت راهنما صحیح شده؛ یک سؤال مشابه را بدون کمک حل کنید تا استقلال یادگیری بررسی شود."
                    : history.length > 1
                      ? "پاسخ در تلاش بعدی اصلاح شده؛ با یک سؤال تازه، یادگیری را بررسی کنید."
                      : "پاسخ در اولین تلاش و بدون راهنما صحیح بوده؛ برای بررسی پایداری، مرور فاصله‌دار انجام دهید."
                  : result === "pending_review"
                    ? "ارزیابی قطعی نیست و بررسی معلم لازم است؛ این پاسخ را غلط قطعی حساب نمی‌کنیم."
                    : "پاسخ با معیار ارزیابی تطابق کامل ندارد؛ پاسخ ثبت‌شده را با پاسخ مرجع مقایسه و یک تمرین مشابه از همین مبحث حل کنید. علت خطا از انتخاب گزینه به‌تنهایی مشخص نمی‌شود.",
          };
        },
      );
      const topics = [
        ...new Set(questions.map((q: { topic: string }) => q.topic)),
      ].map((topic) => {
        const rows = questions.filter(
          (q: { topic: string }) => q.topic === topic,
        );
        return {
          title: topic,
          total: rows.length,
          correct: rows.filter(
            (q: { result: string }) => q.result === "correct",
          ).length,
          incorrect: rows.filter((q: { result: string }) =>
            ["incorrect", "partially_correct"].includes(q.result),
          ).length,
          unanswered: rows.filter(
            (q: { result: string }) => q.result === "unanswered",
          ).length,
        };
      });
      return {
        questions,
        topics,
        unanswered: questions.filter(
          (q: { result: string }) => q.result === "unanswered",
        ).length,
        incorrect: questions.filter((q: { result: string }) =>
          ["incorrect", "partially_correct"].includes(q.result),
        ).length,
        total: a.questionVersionIds.length,
        answered: latest.length,
        independent,
        assisted,
        pending: latest.filter((t) => t.evaluation?.result === "pending_review")
          .length,
        hints: await c("hintEvents").countDocuments(
          { assignmentId: a._id },
          { session },
        ),
        eligibleFirstAttempts: first.length,
        independentSuccessRate: first.length
          ? first.filter(
              (t) => t.hintsUsed === 0 && t.evaluation?.result === "correct",
            ).length / first.length
          : null,
        evidence:
          u.role === "teacher"
            ? evidence
            : latest.map((t) => ({
                ...t,
                evaluation: t.evaluation
                  ? {
                      _id: t.evaluation._id,
                      attemptId: t.evaluation.attemptId,
                      result: t.evaluation.result,
                      method: t.evaluation.method,
                    }
                  : undefined,
              })),
        recommendation: !latest.length
          ? "هنوز پاسخی برای پیشنهاد آموزشی ثبت نشده است."
          : latest.some((t) => t.evaluation?.result !== "correct")
            ? "جلسه بعد، سؤال‌های نیازمند بررسی را مرور کنید و دو سؤال تشخیصی بدون کمک حل کنید."
            : "برای بررسی پایداری یادگیری، یک سنجش مستقل در جلسه بعد پیشنهاد می‌شود.",
        provider: provider.name,
        ai: provider.status?.(),
        ...(u.role === "teacher"
          ? {
              hintFeedback: await c("hintReports")
                .find({ assignmentId: a._id, teacherId: u._id }, { session })
                .toArray(),
            }
          : {}),
      };
    });
  });
  app.post("/api/evaluations/:eid/review", async (r) => {
    const u = await user(r, "teacher"),
      { eid } = r.params as { eid: string },
      b = z
        .object({
          result: z.enum(["correct", "incorrect"]),
          note: z.string().min(2).max(2000),
        })
        .parse(r.body);
    const found = await c("evaluations").findOne({ _id: eid });
    if (
      !found ||
      !(await c("assignments").findOne({
        _id: found.assignmentId,
        teacherId: u._id,
      }))
    )
      fail(404, "یافت نشد");
    return ctx.atomic(r, u._id, `review:${eid}`, b, async (session) => {
      const ev = (await c("evaluations").findOne({ _id: eid }, { session }))!;
      const a = (await c("assignments").findOne(
        { _id: ev.assignmentId, teacherId: u._id },
        { session },
      ))!;
      if (a.state === "cancelled") fail(409, "مأموریت لغو شده است");
      await c("assignments").updateOne(
        { _id: a._id },
        { $inc: { revision: 1 } },
        { session },
      );
      const review = {
        reviewerId: u._id,
        previousResult: ev.result,
        ...b,
        createdAt: now(),
      };
      await c("evaluations").updateOne(
        { _id: eid },
        {
          $set: {
            result: b.result,
            method: "teacher_verified",
            reviews: [...(ev.reviews ?? []), review],
          },
        },
        { session },
      );
      const source = await c("attempts").findOne(
          { _id: ev.attemptId },
          { session },
        ),
        question = source
          ? await c("questionVersions").findOne(
              { _id: source.questionVersionId },
              { session },
            )
          : null;
      if (source && question)
        await recordLearning(
          ctx,
          a,
          question,
          source,
          { ...ev, result: b.result, method: "teacher_verified" },
          session,
        );
      await ctx.boundary("after_teacher_review");
      const pending = await c("evaluations").countDocuments(
        { assignmentId: a._id, result: "pending_review" },
        { session },
      );
      if (!pending && a.state === "submitted") {
        await c("assignments").updateOne(
          { _id: a._id },
          { $set: { state: "completed" } },
          { session },
        );
        await c("missions").updateOne(
          { _id: a.missionId },
          { $set: { state: "completed" } },
          { session },
        );
      }
      await c("auditLogs").insertOne(
        {
          _id: ctx.id(),
          actorId: u._id,
          action: "review",
          resourceId: eid,
          createdAt: now(),
        },
        { session },
      );
      return { ok: true };
    });
  });
}
