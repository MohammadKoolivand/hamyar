import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { policySchema } from "../domain";
import { transition } from "../state";
export function registerMissions(app: FastifyInstance, ctx: Context) {
  const { c, user, owned, id, now, fail } = ctx;
  app.get("/api/missions", async (r) => {
    const u = await user(r);
    return u.role === "teacher"
      ? c("missions").find({ teacherId: u._id }).toArray()
      : c("assignments").find({ studentId: u._id }).toArray();
  });
  app.post("/api/missions", async (r) => {
    const u = await user(r, "teacher"),
      b = z
        .object({
          title: z.string().min(3).max(150),
          studentId: z.string().uuid(),
          questionVersionIds: z.array(z.string().uuid()).min(1).max(30),
          policy: policySchema,
        })
        .parse(r.body);
    if (new Set(b.questionVersionIds).size !== b.questionVersionIds.length)
      fail(400, "سؤال تکراری است");
    if (
      !(await c("relations").findOne({
        teacherId: u._id,
        studentId: b.studentId,
      }))
    )
      fail(404, "دانش‌آموز یافت نشد");
    for (const q of b.questionVersionIds)
      await owned("questionVersions", q, u._id);
    const row = {
      _id: id(),
      teacherId: u._id,
      ...b,
      state: "draft",
      createdAt: now(),
    };
    await c("missions").insertOne(row);
    return row;
  });
  app.post("/api/missions/:mid/publish", async (r) => {
    const u = await user(r, "teacher"),
      { mid } = r.params as { mid: string };
    return ctx.atomic(r, u._id, `publish:${mid}`, {}, async (session) => {
      const m = await c("missions").findOne(
        { _id: mid, teacherId: u._id },
        { session },
      );
      if (!m) fail(404, "یافت نشد");
      if (
        ["published", "in_progress", "submitted", "completed"].includes(
          m!.state,
        )
      )
        return { ok: true };
      transition(m!.state, "published");
      const progress = Object.fromEntries(
        m!.questionVersionIds.map((q: string) => [
          q,
          { attempts: 0, hints: 0 },
        ]),
      );
      await c("assignments").insertOne(
        {
          _id: id(),
          missionId: mid,
          teacherId: u._id,
          studentId: m!.studentId,
          title: m!.title,
          policy: m!.policy,
          questionVersionIds: m!.questionVersionIds,
          state: "published",
          createdAt: now(),
          progress,
          revision: 0,
        },
        { session },
      );
      await ctx.boundary("after_assignment_insert");
      await c("missions").updateOne(
        { _id: mid },
        { $set: { state: "published" } },
        { session },
      );
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: u._id,
          action: "publish",
          resourceId: mid,
          createdAt: now(),
        },
        { session },
      );
      return { ok: true };
    });
  });
  app.post("/api/missions/:mid/cancel", async (r) => {
    const u = await user(r, "teacher"),
      { mid } = r.params as { mid: string };
    return ctx.atomic(r, u._id, `cancel:${mid}`, {}, async (session) => {
      const m = await c("missions").findOne(
        { _id: mid, teacherId: u._id },
        { session },
      );
      if (!m) fail(404, "یافت نشد");
      transition(m!.state, "cancelled");
      const a = await c("assignments").findOne({ missionId: mid }, { session });
      if (a) {
        transition(a.state, "cancelled");
        await c("assignments").updateOne(
          { _id: a._id },
          { $set: { state: "cancelled" }, $inc: { revision: 1 } },
          { session },
        );
      }
      await c("missions").updateOne(
        { _id: mid },
        { $set: { state: "cancelled" } },
        { session },
      );
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: u._id,
          action: "cancel",
          resourceId: mid,
          createdAt: now(),
        },
        { session },
      );
      return { ok: true };
    });
  });
}
