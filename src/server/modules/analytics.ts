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
      return {
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
