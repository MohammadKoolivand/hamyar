import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import type { AvalaiClient } from "../ai/avalai";
import { z } from "zod";
export function registerAiSettings(
  app: FastifyInstance,
  ctx: Context,
  avalai: AvalaiClient,
) {
  app.get("/api/settings/authoring", async (r) => {
    const u = await ctx.user(r, "teacher");
    const saved = await ctx.c("aiSettings").findOne({ _id: u._id });
    return {
      provider: "avalai",
      model: saved?.model ?? process.env.AVALAI_AUTHOR_MODEL ?? "",
      keyConfigured: avalai.configured,
    };
  });
  app.get("/api/settings/authoring/models", async (r) => {
    await ctx.user(r, "teacher");
    try {
      return { models: await avalai.models() };
    } catch {
      ctx.fail(503, "فهرست مدل‌های AvvalAI در دسترس نیست؛ دوباره تلاش کنید.");
    }
  });
  app.post("/api/settings/authoring", async (r) => {
    const u = await ctx.user(r, "teacher");
    const b = z
      .object({ model: z.string().trim().min(1).max(200) })
      .strict()
      .parse(r.body);
    let models;
    try {
      models = await avalai.models();
    } catch {
      ctx.fail(
        503,
        "امکان بررسی مدل انتخاب‌شده وجود ندارد؛ تنظیمات ذخیره نشد.",
      );
    }
    if (!models!.some((m) => m.id === b.model))
      ctx.fail(400, "یک مدل متنی از فهرست AvvalAI انتخاب کنید.");
    return ctx.atomic(r, u._id, "authoring-settings", b, async (session) => {
      await ctx.c("aiSettings").updateOne(
        { _id: u._id },
        {
          $set: {
            ownerId: u._id,
            provider: "avalai",
            model: b.model,
            updatedAt: ctx.now(),
          },
        },
        { upsert: true, session },
      );
      await ctx.c("auditLogs").insertOne(
        {
          _id: ctx.id(),
          actorId: u._id,
          action: "authoring.settings",
          model: b.model,
          at: ctx.now(),
        },
        { session },
      );
      return {
        provider: "avalai",
        model: b.model,
        keyConfigured: avalai.configured,
      };
    });
  });
}
