/** Local-only auto-login for viewing the MVP without SMS or passwords. */
import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { sessionCookieOptions, SESSION_MAX_AGE_SECONDS } from "../security/session";
import { isLocalDevLoginAllowed } from "../../../scripts/dev-login-policy.mjs";

const fixtureTag = "hodhod-local-teacher-dev-login-v1";
const fixtureId = "hodhod-dev-teacher-fixture-v1";

export function registerDevLogin(app: FastifyInstance, ctx: Context) {
  // Never even register the endpoint outside a safe local development setup.
  if (!isLocalDevLoginAllowed()) return;

  app.post("/api/auth/dev-login", async (request, reply) => {
    if (!isLocalDevLoginAllowed()) ctx.fail(404, "Not found");
    const host = (request.headers.host ?? "").toLowerCase();
    if (!/^(127\.0\.0\.1|localhost):5174$/.test(host))
      ctx.fail(403, "ورود نمایشی فقط در localhost مجاز است");
    // This is a dedicated fixture; no existing user is promoted or modified.
    const users = ctx.c("users");
    await users.updateOne(
      { _id: fixtureId, demoFixtureTag: fixtureTag },
      {
        $setOnInsert: {
          demoFixtureTag: fixtureTag,
          name: "معلم نمایشی هدهد",
          role: "teacher",
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    const demo = await users.findOne({ _id: fixtureId, demoFixtureTag: fixtureTag });
    if (!demo || demo.role !== "teacher" || demo.disabledAt)
      ctx.fail(403, "حساب نمایشی نامعتبر است");
    const token = randomBytes(32).toString("hex");
    await ctx.c("sessions").insertOne({
      _id: randomUUID(),
      tokenHash: ctx.hash(token),
      userId: demo!._id,
      securityRevision: demo!.securityRevision ?? 0,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    });
    reply.setCookie("session", token, sessionCookieOptions());
    return ctx.safe(demo!);
  });
}
