import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import type { HintProvider } from "../domain";
export function registerAnalytics(
  app: FastifyInstance,
  ctx: Context,
  provider: HintProvider,
) {
  const { c, user, assignment, now, audit, fail } = ctx;
  app.get("/api/assignments/:aid/report", async (r) => {
    const { u, a } = await assignment(r);
    const attempts = await c("attempts")
        .find({ assignmentId: a._id })
        .sort({ sequence: 1 })
        .toArray(),
      evals = await c("evaluations").find({ assignmentId: a._id }).toArray();
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
      hints: await c("hintEvents").countDocuments({ assignmentId: a._id }),
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
    };
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
    const ev = await c("evaluations").findOne({ _id: eid });
    if (
      !ev ||
      !(await c("assignments").findOne({
        _id: ev.assignmentId,
        teacherId: u._id,
      }))
    )
      fail(404, "یافت نشد");
    await c("evaluations").updateOne({ _id: eid }, [
      {
        $set: {
          result: b.result,
          method: "teacher_verified",
          reviews: {
            $concatArrays: [
              { $ifNull: ["$reviews", []] },
              [
                {
                  reviewerId: { $literal: u._id },
                  previousResult: "$result",
                  result: { $literal: b.result },
                  note: { $literal: b.note },
                  createdAt: { $literal: now() },
                },
              ],
            ],
          },
        },
      },
    ]);
    const pending = await c("evaluations").countDocuments({
      assignmentId: ev!.assignmentId,
      result: "pending_review",
    });
    if (!pending)
      await c("assignments").updateOne(
        { _id: ev!.assignmentId, state: "submitted" },
        { $set: { state: "completed" } },
      );
    await audit(u._id, "review", eid);
    return { ok: true };
  });
}
