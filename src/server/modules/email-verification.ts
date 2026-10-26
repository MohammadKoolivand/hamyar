import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { encryptMail, outboxKey } from "../auth/mail-outbox";
import { smtpConfigured } from "../auth/reset-mail";

const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const generic = {
  message:
    "اگر درخواست معتبر باشد، لینک تأیید ارسال خواهد شد. دریافت لینک به تنظیم سرویس ایمیل وابسته است.",
};
export function registerEmailVerification(app: FastifyInstance, ctx: Context) {
  async function queue(
    userId: string,
    target: string,
    source: string | undefined,
    passwordHash: string,
  ) {
    if (!smtpConfigured()) return;
    try {
      outboxKey();
    } catch {
      return;
    }
    const at = new Date();
    // Both address requests and authenticated changes share a durable user throttle.
    const throttle = await ctx.c("emailVerificationThrottle").findOneAndUpdate(
      { _id: userId },
      {
        $setOnInsert: {
          nextAllowedAt: new Date(0),
          expiresAt: new Date(at.getTime() + 86400000),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (throttle!.nextAllowedAt > at) return;
    const claimed = await ctx.c("emailVerificationThrottle").updateOne(
      { _id: userId, nextAllowedAt: { $lte: at } },
      {
        $set: {
          nextAllowedAt: new Date(at.getTime() + 60000),
          expiresAt: new Date(at.getTime() + 86400000),
        },
      },
    );
    if (!claimed.modifiedCount) return;
    const token = ctx.randomBytes(32).toString("hex");
    const tokenHash = ctx.hash(token);
    const id = ctx.id();
    const payload = encryptMail({ email: target, token }, id);
    await ctx.transaction(async (session) => {
      // Serialize with reset/admin disable/email changes before issuing a capability.
      const valid = await ctx.c("users").updateOne(
        {
          _id: userId,
          passwordHash,
          email: source ?? { $exists: false },
          disabledAt: { $exists: false },
        },
        { $inc: { authRevision: 1 } },
        { session },
      );
      if (!valid.matchedCount) return;
      const expiresAt = new Date(Date.now() + 1800000);
      await ctx.c("emailVerificationTokens").replaceOne(
        { _id: userId },
        {
          _id: userId,
          tokenHash,
          email: target,
          sourceEmail: source ?? null,
          passwordHash,
          usedAt: null,
          expiresAt,
        },
        { upsert: true, session },
      );
      await ctx
        .c("mailOutbox")
        .deleteMany({ userId, purpose: "email_verification" }, { session });
      await ctx.c("mailOutbox").insertOne(
        {
          _id: id,
          userId,
          purpose: "email_verification",
          tokenHash,
          payload,
          state: "queued",
          attempts: 0,
          availableAt: at,
          expiresAt,
        },
        { session },
      );
    });
  }
  app.post(
    "/api/auth/email-verification/request",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (r) => {
      const body = z.object({ email }).strict().parse(r.body);
      const user = await ctx.c("users").findOne({
        email: body.email,
        disabledAt: { $exists: false },
        emailVerified: { $ne: true },
      });
      if (user)
        await queue(user._id, body.email, user.email, user.passwordHash);
      return generic;
    },
  );
  app.post(
    "/api/auth/email/change",
    { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } },
    async (r) => {
      const user = await ctx.user(r);
      const body = z
        .object({ email, password: z.string().min(10).max(128) })
        .strict()
        .parse(r.body);
      const [salt, digest] = String(user.passwordHash ?? "").split(":");
      const actual = ctx.scryptSync(body.password, salt || "invalid", 64);
      if (
        !/^[a-f0-9]{128}$/.test(digest ?? "") ||
        !ctx.timingSafeEqual(actual, Buffer.from(digest, "hex"))
      )
        ctx.fail(401, "رمز عبور معتبر نیست");
      if (
        !(await ctx
          .c("users")
          .findOne({ email: body.email, _id: { $ne: user._id } }))
      )
        await queue(user._id, body.email, user.email, user.passwordHash);
      return generic;
    },
  );
  app.post(
    "/api/auth/email-verification/confirm",
    { config: { rateLimit: { max: 8, timeWindow: "10 minutes" } } },
    async (r, reply) => {
      const { token } = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict()
        .parse(r.body);
      await ctx.transaction(async (session) => {
        const record = await ctx
          .c("emailVerificationTokens")
          .findOneAndDelete(
            { tokenHash: ctx.hash(token), expiresAt: { $gt: new Date() } },
            { session },
          );
        if (!record) ctx.fail(400, "لینک تأیید نامعتبر یا منقضی شده است");
        const changed = await ctx.c("users").updateOne(
          {
            _id: record!._id,
            email: record!.sourceEmail ?? { $exists: false },
            passwordHash: record!.passwordHash,
            disabledAt: { $exists: false },
          },
          {
            $set: {
              email: record!.email,
              emailVerified: true,
              emailVerifiedAt: ctx.now(),
            },
            $inc: { authRevision: 1, securityRevision: 1 },
          },
          { session },
        );
        if (!changed.matchedCount)
          ctx.fail(400, "حساب تغییر کرده؛ لینک تازه درخواست کنید");
        await ctx
          .c("sessions")
          .deleteMany({ userId: record!._id }, { session });
        await ctx
          .c("passwordResetTokens")
          .deleteOne({ _id: record!._id }, { session });
        await ctx
          .c("mailOutbox")
          .deleteMany({ userId: record!._id }, { session });
        await ctx.c("auditLogs").insertOne(
          {
            _id: ctx.id(),
            actorId: record!._id,
            resourceId: record!._id,
            action: "email_verified",
            createdAt: ctx.now(),
          },
          { session },
        );
      });
      reply.clearCookie("session", { path: "/" });
      return { message: "ایمیل تأیید شد. دوباره وارد حساب شوید." };
    },
  );
}
