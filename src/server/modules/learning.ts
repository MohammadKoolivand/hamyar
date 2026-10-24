import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { progress } from "../learning/service";
import { masteryStatuses } from "../learning/model";
export function registerLearning(app: FastifyInstance, ctx: Context) {
  async function authorized(r: import("fastify").FastifyRequest) {
    const u = await ctx.user(r),
      { sid } = r.params as { sid: string };
    if (
      u.role === "parent"
        ? !(await ctx
            .c("parentLinks")
            .findOne({ parentId: u._id, studentId: sid }))
        : u.role === "student"
          ? u._id !== sid
          : !(await ctx
              .c("relations")
              .findOne({ studentId: sid, teacherId: u._id }))
    )
      ctx.fail(404, "دانش‌آموز یافت نشد");
    return { u, sid };
  }
  app.get("/api/students/:sid/progress", async (r) => {
    const { u, sid } = await authorized(r);
    return progress(ctx, sid, u);
  });
  app.get("/api/students/:sid/mistakes", async (r) => {
    const { u, sid } = await authorized(r);
    return (await progress(ctx, sid, u)).mistakes;
  });
  app.post("/api/students/:sid/mastery/:skillId/override", async (r) => {
    const { u, sid } = await authorized(r);
    if (u.role !== "teacher")
      ctx.fail(403, "فقط معلم می‌تواند وضعیت را اصلاح کند");
    const { skillId } = r.params as { skillId: string };
    const skill = await ctx.owned("curriculum", skillId, u._id);
    if (skill.kind !== "skill") ctx.fail(400, "مهارت معتبر نیست");
    const b = z
      .object({
        status: z.enum(masteryStatuses),
        reason: z.string().trim().min(3).max(1000),
      })
      .parse(r.body);
    return ctx.atomic(
      r,
      u._id,
      `mastery:${sid}:${skillId}`,
      b,
      async (session) => {
        const key = ctx.hash(JSON.stringify([u._id, sid, skillId])),
          old = await ctx
            .c("masteryOverrides")
            .findOne({ _id: key }, { session });
        const review = { ...b, reviewerId: u._id, createdAt: ctx.now() };
        await ctx.c("masteryOverrides").updateOne(
          { _id: key },
          {
            $set: {
              teacherId: u._id,
              studentId: sid,
              skillId,
              ...b,
              history: [...(old?.history ?? []), review],
            },
          },
          { upsert: true, session },
        );
        return { ok: true };
      },
    );
  });
}
