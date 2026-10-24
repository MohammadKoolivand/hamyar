import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "mongodb";
import { z } from "zod";
import { MockProvider, type HintProvider } from "./domain";
import { createContext } from "./context";
import { registerIdentity } from "./modules/identity";
import { registerContent } from "./modules/content";
import { registerMissions } from "./modules/missions";
import { registerPractice } from "./modules/practice";
import { registerAnalytics } from "./modules/analytics";
export async function buildApp(
  db: Db,
  provider: HintProvider = new MockProvider(),
) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    bodyLimit: 65536,
  });
  await app.register(cookie);
  const ctx = createContext(db);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    async keyGenerator(request) {
      const token = request.cookies.session;
      if (token) {
        const session = await ctx.c("sessions").findOne({
          tokenHash: ctx.hash(token),
          expiresAt: { $gt: new Date() },
        });
        if (session) return "user:" + session.userId;
      }
      return "ip:" + request.ip;
    },
  });
  const { fail } = ctx;
  app.setErrorHandler((e, _r, reply) => {
    if (e instanceof z.ZodError)
      return reply
        .code(400)
        .send({ message: "اطلاعات ورودی معتبر نیست", issues: e.issues });
    const err = e as Error & { statusCode?: number; code?: number };
    reply.code(err.code === 11000 ? 409 : (err.statusCode ?? 500)).send({
      message:
        err.code === 11000
          ? "این رکورد قبلاً ثبت شده است"
          : err.statusCode
            ? err.message
            : "خطای داخلی؛ دوباره تلاش کنید",
    });
  });
  app.addHook("onRequest", async (r) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(r.method) && r.headers.origin) {
      let origin: URL;
      try {
        origin = new URL(r.headers.origin);
      } catch {
        fail(403, "مبدأ نامعتبر است");
        return;
      }
      if (
        origin.host !== r.headers.host &&
        origin.origin !== (process.env.APP_ORIGIN ?? "http://127.0.0.1:5174")
      )
        fail(403, "مبدأ درخواست مجاز نیست");
    }
  });
  app.get("/api/health", async () => {
    await db.command({ ping: 1 });
    return { status: "ok", provider: provider.name };
  });
  registerIdentity(app, ctx);
  registerContent(app, ctx);
  registerMissions(app, ctx);
  registerPractice(app, ctx, provider);
  registerAnalytics(app, ctx, provider);
  return app;
}
