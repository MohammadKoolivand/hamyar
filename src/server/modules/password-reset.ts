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
  const pendingDeliveries = new Set<Promise<void>>();
  // Finish already accepted sends during graceful shutdown. A hard process crash
  // can still lose a queued email; production should use a durable outbox worker.
  app.addHook("onClose", async () => {
    await Promise.allSettled([...pendingDeliveries]);
  });

  function scheduleDelivery(email: string, token: string, userId: string, tokenHash: string) {
    // Never wait for SMTP (or its timeouts) in the public request: doing so
    // leaks whether an account exists by observable response latency.
    const delivery = new Promise<void>((resolve) => {
      setImmediate(() => {
        void (async () => {
          try {
            const active = await c("passwordResetTokens").findOne({
              _id: userId, tokenHash, usedAt: null, expiresAt: { $gt: new Date() },
            });
            if (!active) return; // token was already revoked or replaced
            await mailer(email, token);
            await ctx.audit(userId, "password_reset_requested", userId)
              .catch(() => app.log.warn({ event: "password_reset_audit_failed" }, "Reset audit unavailable"));
          } catch {
            // Do not delete a newer request's token or expose delivery details.
            await c("passwordResetTokens").deleteOne({ _id: userId, tokenHash })
              .catch(() => app.log.warn({ event: "password_reset_cleanup_failed" }, "Reset token cleanup failed"));
            app.log.warn({ event: "password_reset_mail_failed" }, "Password reset delivery failed");
          } finally {
            resolve();
          }
        })();
      });
    });
    pendingDeliveries.add(delivery);
    void delivery.then(() => pendingDeliveries.delete(delivery));
  }

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
    // Configuration handling is independent of account existence.
    if (mailer === sendPasswordResetEmail && !smtpConfigured()) {
      app.log.warn({ event: "password_reset_mail_not_configured" }, "Password reset delivery unavailable");
      return result;
    }
    const account = await c("users").findOne({ email });
    if (!account || account.disabledAt) return result;
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
    scheduleDelivery(email, token, account._id, tokenHash);
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
