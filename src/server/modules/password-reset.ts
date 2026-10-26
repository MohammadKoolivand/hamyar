import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Context } from "../context";
import { sendPasswordResetEmail, smtpConfigured, type PasswordResetMailer } from "../auth/reset-mail";

const emailSchema = z.email().max(254).transform((value) => value.trim().toLowerCase());
const resetRequest = z.object({ email: emailSchema }).strict();
const resetConfirm = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(10).max(128),
}).strict();
const generic = "اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی ارسال خواهد شد.";
const ttlMs = 10 * 60 * 1000;
const throttleMs = 60 * 1000;

export function registerPasswordReset(
  app: FastifyInstance,
  ctx: Context,
  mailer: PasswordResetMailer = sendPasswordResetEmail,
) {
  const { c, hash, randomBytes, scryptSync, id, now, fail } = ctx;

  app.post("/api/auth/password-reset/request", {
    config: { rateLimit: { max: 5, timeWindow: "10 minutes", keyGenerator: (r) => "reset:" + r.ip } },
  }, async (r) => {
    const { email } = resetRequest.parse(r.body);
    const result = { message: generic };
    // Identical response for unknown, disabled, email-only and throttled accounts.
    const ident = hash("reset-request:" + email);
    const current = new Date();
    try {
      await c("passwordResetThrottle").insertOne({
        _id: ident,
        nextAllowedAt: new Date(current.getTime() + throttleMs),
        expiresAt: new Date(current.getTime() + 86400000),
      });
    } catch (e) {
      // Only the unique key collision indicates an existing throttle record.
      if ((e as { code?: number }).code !== 11000) throw e;
      const resumed = await c("passwordResetThrottle").updateOne(
        { _id: ident, nextAllowedAt: { $lte: current } },
        { $set: {
          nextAllowedAt: new Date(current.getTime() + throttleMs),
          expiresAt: new Date(current.getTime() + 86400000),
        } },
      );
      if (resumed.modifiedCount === 0) return result;
    }
    const account = await c("users").findOne({ email });
    if (!account || account.disabledAt) return result;
    if (mailer === sendPasswordResetEmail && !smtpConfigured()) {
      app.log.warn({ event: "password_reset_mail_not_configured" }, "Password reset delivery unavailable");
      return result;
    }
    const token = randomBytes(32).toString("hex");
    const tokenHash = hash(token);
    await c("passwordResetTokens").replaceOne(
      { _id: account._id },
      {
        _id: account._id,
        userId: account._id,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMs),
        usedAt: null,
        createdAt: now(),
      },
      { upsert: true },
    );
    try {
      await mailer(email, token);
      await ctx.audit(account._id, "password_reset_requested", account._id);
    } catch {
      await c("passwordResetTokens").deleteOne({ _id: account._id, tokenHash });
      app.log.warn({ event: "password_reset_mail_failed" }, "Password reset delivery failed");
    }
    return result;
  });

  app.post("/api/auth/password-reset/confirm", {
    config: { rateLimit: { max: 8, timeWindow: "10 minutes", keyGenerator: (r) => "reset-confirm:" + r.ip } },
  }, async (r, reply) => {
    const b = resetConfirm.parse(r.body);
    const salt = randomBytes(16).toString("hex");
    const passwordHash = salt + ":" + scryptSync(b.password, salt, 64).toString("hex");
    await ctx.transaction(async (session) => {
      const consumed = await c("passwordResetTokens").findOneAndDelete({
        tokenHash: hash(b.token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }, { session });
      if (!consumed) fail(400, "لینک بازیابی نامعتبر یا منقضی شده است");
      const updated = await c("users").updateOne(
        { _id: consumed!.userId, disabledAt: { $exists: false } },
        { $set: { passwordHash, passwordChangedAt: now() } },
        { session },
      );
      if (updated.matchedCount !== 1) fail(400, "لینک بازیابی نامعتبر یا منقضی شده است");
      await c("sessions").deleteMany({ userId: consumed!.userId }, { session });
      await c("auditLogs").insertOne({
        _id: id(), actorId: consumed!.userId, action: "password_reset_completed",
        resourceId: consumed!.userId, createdAt: now(),
      }, { session });
    });
    reply.clearCookie("session", { path: "/" });
    return { message: "رمز عبور تغییر کرد. با رمز جدید وارد شوید." };
  });
}
