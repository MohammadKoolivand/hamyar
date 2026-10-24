import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { evaluate, type HintProvider, type QuestionInput } from "../domain";
import type { Row } from "../db";
export function registerPractice(
  app: FastifyInstance,
  ctx: Context,
  provider: HintProvider,
) {
  const { c, user, assignment, id, now, fail } = ctx;
  app.get("/api/assignments", async (r) => {
    const u = await user(r);
    return c("assignments")
      .find(u.role === "teacher" ? { teacherId: u._id } : { studentId: u._id })
      .toArray();
  });
  app.get("/api/assignments/:aid", async (r) => {
    const { a } = await assignment(r);
    const questions = await c("questionVersions")
      .find({ _id: { $in: a.questionVersionIds } })
      .toArray();
    return {
      ...a,
      questions: questions.map((q) => ({
        _id: q._id,
        statement: q.statement,
        type: q.type,
        options: q.options,
        skillIds: q.skillIds,
        version: q.version,
      })),
      attempts: await c("attempts").find({ assignmentId: a._id }).toArray(),
      evaluations: (
        await c("evaluations").find({ assignmentId: a._id }).toArray()
      ).map((e) => ({
        _id: e._id,
        attemptId: e.attemptId,
        result: e.result,
        method: e.method,
      })),
      hints: await c("hintEvents").find({ assignmentId: a._id }).toArray(),
    };
  });
  async function questionFor(a: Row, body: unknown) {
    const b = z.object({ questionId: z.string().uuid() }).parse(body);
    if (!a.questionVersionIds.includes(b.questionId))
      fail(404, "سؤال یافت نشد");
    if (["submitted", "completed"].includes(a.state))
      fail(409, "مأموریت پایان یافته است");
    return (await c("questionVersions").findOne({ _id: b.questionId }))!;
  }
  app.post("/api/assignments/:aid/attempts", async (r) => {
    const { u, a } = await assignment(r, true),
      b = z
        .object({
          questionId: z.string().uuid(),
          answer: z.string().min(1).max(10000),
        })
        .parse(r.body),
      q = await questionFor(a, b);
    const key = `progress.${q._id}.attempts`;
    const reserved = await c("assignments").findOneAndUpdate(
      {
        _id: a._id,
        state: { $nin: ["completed", "submitted"] },
        [key]: { $lt: a.policy.maxAttempts },
      },
      { $inc: { [key]: 1 }, $set: { state: "in_progress" } },
      { returnDocument: "after" },
    );
    if (!reserved) fail(409, "تعداد تلاش مجاز پایان یافته");
    const p = reserved!.progress[q._id],
      attempt = {
        _id: id(),
        assignmentId: a._id,
        studentId: u._id,
        questionVersionId: q._id,
        answer: b.answer,
        sequence: p.attempts,
        hintsUsed: p.hints,
        createdAt: now(),
      };
    await c("attempts").insertOne(attempt);
    let result;
    try {
      result = evaluate(q as unknown as QuestionInput, b.answer);
    } catch {
      result = { result: "pending_review", method: "evaluation_failed" };
    }
    const ev = {
      _id: id(),
      attemptId: attempt._id,
      assignmentId: a._id,
      ...result,
      reviews: [],
      createdAt: now(),
    };
    await c("evaluations").insertOne(ev);
    return { attempt, evaluation: ev };
  });
  app.post("/api/assignments/:aid/hints", async (r) => {
    const { a } = await assignment(r, true),
      q = await questionFor(a, r.body);
    if (a.policy.independent) fail(409, "سنجش مستقل بدون راهنمایی است");
    const p = a.progress[q._id],
      approvedHint = q.hints[p.hints];
    if (p.hints >= a.policy.maxHints || !approvedHint)
      fail(409, "راهنمایی مجاز دیگری وجود ندارد");
    let text;
    try {
      text = z
        .string()
        .min(1)
        .max(1000)
        .parse(await provider.hint({ approvedHint, level: p.hints + 1 }));
      if (text !== approvedHint) fail(503, "خروجی تأییدنشده مسدود شد");
    } catch {
      fail(503, "همیار در دسترس نیست؛ پاسخ‌های شما محفوظ‌اند");
    }
    const key = `progress.${q._id}.hints`;
    const res = await c("assignments").updateOne(
      {
        _id: a._id,
        state: { $nin: ["completed", "submitted"] },
        [key]: p.hints,
      },
      { $inc: { [key]: 1 } },
    );
    if (!res.modifiedCount) fail(409, "وضعیت تغییر کرد؛ دوباره تلاش کنید");
    const event = {
      _id: id(),
      assignmentId: a._id,
      questionVersionId: q._id,
      text,
      level: p.hints + 1,
      provider: provider.name,
      createdAt: now(),
    };
    await c("hintEvents").insertOne(event);
    return event;
  });
  app.post("/api/assignments/:aid/complete", async (r) => {
    const { a } = await assignment(r, true);
    const attempts = await c("attempts")
      .find({ assignmentId: a._id })
      .toArray();
    if (
      a.questionVersionIds.some(
        (q: string) => !attempts.some((t) => t.questionVersionId === q),
      )
    )
      fail(409, "به همه سؤال‌ها پاسخ دهید");
    const pending = await c("evaluations").countDocuments({
      assignmentId: a._id,
      result: "pending_review",
    });
    await c("assignments").updateOne(
      { _id: a._id },
      { $set: { state: pending ? "submitted" : "completed" } },
    );
    return { ok: true };
  });
}
