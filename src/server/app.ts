import { registerPhoneAuth } from "./modules/phone-auth";
import { MelipayamakProvider, type SmsProvider } from "./auth/sms";
import { registerEmailVerification } from "./modules/email-verification";
import Fastify from "fastify";
import { routeRoles } from "../lib/access";
import { registerAccessManagement } from "./modules/access-management";
import { AvalaiClient } from "./ai/avalai";
import { registerAiSettings } from "./modules/ai-settings";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "mongodb";
import { z } from "zod";
import { MockProvider, type HintProvider } from "./domain";
import { createContext } from "./context";
import { requireTransactions, type WriteHooks } from "./transactions";
import { registerIdentity } from "./modules/identity";
import { registerPasswordReset } from "./modules/password-reset";
import {
  sendPasswordResetEmail,
  type PasswordResetMailer,
} from "./auth/reset-mail";
import { registerExamImports } from "./modules/exam-imports";
import { registerContent } from "./modules/content";
import { registerMissions } from "./modules/missions";
import { registerRemediation } from "./modules/remediation";
import { registerCourses } from "./modules/courses";
import { registerClassGroups } from "./modules/class-groups";
import { registerCourseMembership } from "./modules/course-membership";
import { registerStudentDashboard } from "./modules/student-dashboard";
import { registerPractice } from "./modules/practice";
import { registerAnalytics } from "./modules/analytics";
import { registerLearning } from "./modules/learning";
import { registerAuthoring } from "./modules/authoring";
import type { QuestionGenerator } from "./ai/question-generator";
export async function buildApp(
  db: Db,
  provider: HintProvider = new MockProvider(),
  hooks: WriteHooks = {},
  questionGenerator?: QuestionGenerator,
  avalai = new AvalaiClient(),
  resetMailer: PasswordResetMailer = sendPasswordResetEmail,
  sms: SmsProvider = new MelipayamakProvider(),
) {
  await requireTransactions(db);
  const app = Fastify({
    logger:
      process.env.NODE_ENV !== "test"
        ? {
            serializers: {
              req: (r) => ({
                method: r.method,
                path: (r.url ?? "").split("?")[0],
              }),
              res: (r) => ({ statusCode: r.statusCode }),
            },
            redact: [
              "req.headers.cookie",
              "req.headers.authorization",
              "body",
              "password",
              "token",
            ],
          }
        : false,
    bodyLimit: 65536,
  });
  await app.register(cookie);
  const ctx = createContext(db, hooks);
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
    if (!err.statusCode || err.statusCode >= 500)
      app.log.error(
        {
          requestId: _r.id,
          route: _r.routeOptions.url,
          event: "request_failed",
        },
        "Request failed; details withheld",
      );
    reply.code(err.code === 11000 ? 409 : (err.statusCode ?? 500)).send({
      message:
        err.code === 11000
          ? "این رکورد قبلاً ثبت شده است"
          : err.statusCode
            ? err.message
            : "خطای داخلی؛ دوباره تلاش کنید",
    });
  });
  const allowedOrigin = new URL(
    process.env.APP_ORIGIN ?? "http://127.0.0.1:5174",
  );
  if (
    process.env.NODE_ENV === "production" &&
    allowedOrigin.protocol !== "https:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(allowedOrigin.hostname)
  )
    throw new Error("Production APP_ORIGIN must use HTTPS");
  app.addHook("onRequest", async (r, reply) => {
    reply.header("X-Request-Id", r.id);
    if (["GET", "HEAD", "OPTIONS"].includes(r.method)) return;
    if (r.headers["sec-fetch-site"] === "cross-site")
      fail(403, "درخواست بین‌سایتی مجاز نیست");
    if (r.headers.origin) {
      let origin: URL;
      try {
        origin = new URL(r.headers.origin);
      } catch {
        fail(403, "مبدأ نامعتبر است");
        return;
      }
      if (origin.origin !== allowedOrigin.origin)
        fail(403, "مبدأ درخواست مجاز نیست");
    }
  });
  app.get("/api/health", async () => {
    await db.command({ ping: 1 });
    return {
      status: "ok",
      provider: provider.name,
      ai: provider.status?.() ?? {
        configured: provider.name,
        active: provider.name,
        state: provider.name.includes("mock") ? "mock" : "configured",
      },
    };
  });
  app.addHook("preHandler", async (r) => {
    const route = r.routeOptions.url;
    if (!route) return;
    const roles = routeRoles(r.method, route);
    if (roles === null) return;
    const actor = await ctx.user(r);
    if (!roles.includes(actor.role))
      ctx.fail(403, "دسترسی این نقش به این عملیات مجاز نیست");
  });
  registerAccessManagement(app, ctx);
  const { linkInvitation } = registerIdentity(app, ctx);
  registerPhoneAuth(app, ctx, sms, linkInvitation);
  registerPasswordReset(app, ctx, resetMailer);
  registerEmailVerification(app, ctx);
  registerCourses(app, ctx);
  registerClassGroups(app, ctx);
  registerCourseMembership(app, ctx);
  registerStudentDashboard(app, ctx);
  registerContent(app, ctx);
  registerExamImports(app, ctx);
  registerAiSettings(app, ctx, avalai);
  registerAuthoring(app, ctx, questionGenerator, avalai);
  registerMissions(app, ctx);
  registerRemediation(app, ctx);
  registerPractice(app, ctx, provider, avalai);
  registerAnalytics(app, ctx, provider);
  registerLearning(app, ctx);
  return app;
}
