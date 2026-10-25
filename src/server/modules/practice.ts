import { feedbackVisible } from "../../lib/practice-answer";
import type { AvalaiClient } from "../ai/avalai";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { evaluate, type HintProvider, type QuestionInput } from "../domain";
import { assertOpen, transition } from "../state";
import { guide } from "../ai/tutor";
import { recordLearning } from "../learning/service";
export function registerPractice(
  app: FastifyInstance,
  ctx: Context,
  provider: HintProvider,
  avalai?: AvalaiClient,
) {
  const { c, user, assignment, id, now, fail, atomic, boundary } = ctx;
  app.get("/api/assignments", async (r) => {
    const u = await user(r);
    if (u.role === "parent") {
      const links = await c("parentLinks").find({ parentId: u._id }).toArray();
      if (!links.length) return [];
      return c("assignments")
        .find({
          $or: links.map((l) => ({
            studentId: l.studentId,
            teacherId: l.teacherId,
          })),
        })
        .project({ _id: 1, title: 1, state: 1, studentId: 1, teacherId: 1 })
        .toArray();
    }
    return c("assignments")
      .find(u.role === "teacher" ? { teacherId: u._id } : { studentId: u._id })
      .toArray();
  });
  app.get("/api/assignments/:aid", async (r) => {
    const { u, a } = await assignment(r);
    if (u.role === "parent")
      fail(403, "اولیا گزارش را از پنل فرزند مشاهده می‌کنند");
    const questions = await c("questionVersions")
      .find({ _id: { $in: a.questionVersionIds } })
      .toArray();
    questions.sort(
      (left, right) =>
        a.questionVersionIds.indexOf(left._id) -
        a.questionVersionIds.indexOf(right._id),
    );
    return {
      ...a,
      questions: questions.map((q) => ({
        _id: q._id,
        statement: q.statement,
        ...(q.visuals ? { visuals: q.visuals } : {}),
        type: q.type,
        options: q.options,
        skillIds: q.skillIds,
        version: q.version,
      })),
      attempts: await c("attempts").find({ assignmentId: a._id }).toArray(),
      evaluations: (u.role !== "teacher" && !feedbackVisible(a.policy, a.state)
        ? []
        : await c("evaluations").find({ assignmentId: a._id }).toArray()
      ).map((e) => ({
        _id: e._id,
        attemptId: e.attemptId,
        result: e.result,
        method: e.method,
      })),
      hints: await c("hintEvents").find({ assignmentId: a._id }).toArray(),
    };
  });
  const itemSchema = z.object({ questionId: z.string().uuid() });
  async function questionFor(a: import("../db").Row, questionId: string) {
    if (!a.questionVersionIds.includes(questionId)) fail(404, "سؤال یافت نشد");
    const q = await c("questionVersions").findOne({ _id: questionId });
    if (!q) fail(404, "نسخه سؤال یافت نشد");
    return q!;
  }
  app.post("/api/assignments/:aid/attempts", async (r) => {
    const { u, a } = await assignment(r, true),
      b = itemSchema
        .extend({
          answer: z.string().trim().min(1).max(10000),
          expectedAttempt: z.number().int().min(1).max(10).optional(),
        })
        .parse(r.body),
      q = await questionFor(a, b.questionId);
    return atomic(r, u._id, `attempt:${a._id}`, b, async (session) => {
      const current = await c("assignments").findOne(
        { _id: a._id, studentId: u._id },
        { session },
      );
      assertOpen(current!.state);
      if (
        b.expectedAttempt !== undefined &&
        current!.progress[q._id].attempts !== b.expectedAttempt - 1
      )
        fail(409, "وضعیت پاسخ تغییر کرده است؛ مأموریت را به‌روز کنید");
      const key = `progress.${q._id}.attempts`;
      const reserved = await c("assignments").findOneAndUpdate(
        { _id: a._id, [key]: { $lt: current!.policy.maxAttempts } },
        { $inc: { [key]: 1, revision: 1 }, $set: { state: "in_progress" } },
        { session, returnDocument: "after" },
      );
      if (!reserved) fail(409, "تعداد تلاش مجاز پایان یافته");
      await boundary("after_attempt_counter");
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
      await c("attempts").insertOne(attempt, { session });
      await boundary("after_attempt_insert");
      let result;
      try {
        result = evaluate(q as unknown as QuestionInput, b.answer);
      } catch {
        result = { result: "pending_review", method: "evaluation_failed" };
      }
      const evaluation = {
        _id: id(),
        attemptId: attempt._id,
        assignmentId: a._id,
        ...result,
        reviews: [],
        createdAt: now(),
      };
      await c("evaluations").insertOne(evaluation, { session });
      await recordLearning(ctx, current!, q, attempt, evaluation, session);
      await c("missions").updateOne(
        { _id: a.missionId },
        { $set: { state: "in_progress" } },
        { session },
      );
      await boundary("after_evaluation_insert");
      return {
        attempt,
        ...(feedbackVisible(current!.policy, current!.state)
          ? { evaluation }
          : {}),
      };
    });
  });
  app.post("/api/assignments/:aid/hints", async (r) => {
    const { u, a } = await assignment(r, true),
      b = itemSchema
        .extend({
          expectedHintLevel: z.number().int().min(1).max(3).optional(),
          level: z.number().int().min(1).max(4).optional(),
        })
        .parse(r.body),
      q = await questionFor(a, b.questionId);
    // Provider executes before the transaction: failure never reserves quota. Replay is checked first.
    const key = r.headers["idempotency-key"];
    if (key) {
      const existing = await c("operations").findOne({
        _id: ctx.hash(JSON.stringify([u._id, `hint:${a._id}`, key])),
      });
      if (existing)
        return atomic(r, u._id, `hint:${a._id}`, b, async () => {
          throw new Error("unreachable");
        });
    }
    assertOpen(a.state);
    if (a.policy.independent) fail(409, "سنجش مستقل بدون راهنمایی است");
    if (
      b.expectedHintLevel !== undefined &&
      a.progress[q._id].hints !== b.expectedHintLevel - 1
    )
      fail(409, "وضعیت راهنمایی تغییر کرده است؛ مأموریت را به‌روز کنید");
    if (b.level === 4 && !feedbackVisible(a.policy, a.state))
      fail(409, "پاسخ کامل پس از پایان تمرین نمایش داده می‌شود");
    const level = a.progress[q._id].hints,
      requestedLevel = b.level ?? Math.min(level + 1, 3);
    if (level >= a.policy.maxHints) fail(409, "راهنمایی مجاز دیگری وجود ندارد");
    const settings = await c("aiSettings").findOne({ _id: a.teacherId });
    let hintProvider = provider;
    if (settings?.provider === "avalai" || avalai?.configured) {
      const model = settings?.model ?? process.env.AVALAI_AUTHOR_MODEL;
      if (requestedLevel !== 4 && (!avalai?.configured || !model))
        fail(
          503,
          "مدل راهنمای AvvalAI آماده نیست؛ معلم باید مدل را در تنظیمات انتخاب و اتصال سرور را تنظیم کند.",
        );
      if (avalai && model) hintProvider = avalai.tutor(model);
    }
    const guided = await guide(ctx, hintProvider, a, q, requestedLevel);
    return atomic(r, u._id, `hint:${a._id}`, b, async (session) => {
      const current = await c("assignments").findOne(
        { _id: a._id, studentId: u._id },
        { session },
      );
      assertOpen(current!.state);
      if (requestedLevel > (current!.policy.maxHintLevel ?? 3))
        fail(409, "سطح راهنمایی مجاز نیست");
      if (current!.policy.independent)
        fail(409, "سنجش مستقل بدون راهنمایی است");
      const counter = `progress.${q._id}.hints`;
      const updated = await c("assignments").updateOne(
        { _id: a._id, [counter]: level },
        { $inc: { [counter]: 1, revision: 1 } },
        { session },
      );
      if (!updated.modifiedCount)
        fail(409, "وضعیت کمک تغییر کرد؛ دوباره تلاش کنید");
      await boundary("after_hint_counter");
      const event = {
        _id: id(),
        assignmentId: a._id,
        questionVersionId: q._id,
        text: guided.text,
        level: level + 1,
        provider: guided.provider,
        model: guided.model,
        promptVersion: guided.promptVersion,
        focus: guided.focus,
        requestedLevel,
        requestId: guided.requestId,
        ...(guided.usage ? { usage: guided.usage } : {}),
        createdAt: now(),
      };
      await c("hintEvents").insertOne(event, { session });
      if (guided.provider !== "teacher-solution")
        await c("aiRequests").updateOne(
          { _id: guided.requestId },
          { $set: { state: "committed", hintEventId: event._id } },
          { session },
        );
      await boundary("after_hint_insert");
      return event;
    });
  });
  app.post("/api/assignments/:aid/hints/:hid/report", async (r) => {
    const { u, a } = await assignment(r, true),
      { hid } = r.params as { hid: string };
    const b = z
      .object({ reason: z.string().trim().min(3).max(1000) })
      .parse(r.body);
    if (!(await c("hintEvents").findOne({ _id: hid, assignmentId: a._id })))
      fail(404, "راهنما یافت نشد");
    return atomic(r, u._id, `hint-report:${hid}`, b, async (session) => {
      await c("hintReports").updateOne(
        { hintId: hid, studentId: u._id },
        {
          $setOnInsert: {
            _id: id(),
            assignmentId: a._id,
            teacherId: a.teacherId,
            studentId: u._id,
            hintId: hid,
            reason: b.reason,
            state: "pending",
            createdAt: now(),
          },
        },
        { upsert: true, session },
      );
      return { ok: true };
    });
  });
  app.post("/api/assignments/:aid/complete", async (r) => {
    const { u, a } = await assignment(r, true);
    const body = z
      .object({ allowUnanswered: z.boolean().optional() })
      .parse(r.body ?? {});
    return atomic(r, u._id, `complete:${a._id}`, body, async (session) => {
      const current = (await c("assignments").findOne(
        { _id: a._id },
        { session },
      ))!;
      if (["submitted", "completed"].includes(current.state))
        return { ok: true };
      assertOpen(current.state);
      // Every practice writer touches this document; this write serializes completion with it.
      await c("assignments").updateOne(
        { _id: a._id },
        { $inc: { revision: 1 } },
        { session },
      );
      await boundary("completion_locked");
      const attempts = await c("attempts")
        .find({ assignmentId: a._id }, { session })
        .toArray();
      if (
        !body.allowUnanswered &&
        current.questionVersionIds.some(
          (q: string) => !attempts.some((t) => t.questionVersionId === q),
        )
      )
        fail(409, "به همه سؤال‌ها پاسخ دهید");
      const evaluations = await c("evaluations")
        .find({ assignmentId: a._id }, { session })
        .toArray();
      if (evaluations.length !== attempts.length)
        fail(409, "ارزیابی تلاش‌ها کامل نشده است؛ بررسی معلم لازم است");
      const next = evaluations.some((e) => e.result === "pending_review")
        ? "submitted"
        : "completed";
      // A confirmed blank submission may finish directly from published.
      if (!(body.allowUnanswered && current.state === "published"))
        transition(current.state, next);
      await c("assignments").updateOne(
        { _id: a._id },
        { $set: { state: next } },
        { session },
      );
      await c("missions").updateOne(
        { _id: current.missionId },
        { $set: { state: next } },
        { session },
      );
      return { ok: true };
    });
  });
}
