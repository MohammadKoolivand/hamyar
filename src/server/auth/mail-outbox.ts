import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Context } from "../context";
import { sendPasswordResetEmail, type PasswordResetMailer } from "./reset-mail";

export function outboxKey() {
  const value = process.env.MAIL_OUTBOX_KEY ?? "";
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value)
    throw new Error("MAIL_OUTBOX_KEY must be a canonical base64 32-byte key");
  return key;
}

export function encryptMail(
  payload: { email: string; token: string },
  id: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", outboxKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

// SMTP acceptance and Mongo acknowledgement cannot be atomic. Following a crash
// after SMTP acceptance the same message may be resent; its token stays one-use.
export async function deliverNextMail(
  ctx: Context,
  mailer: PasswordResetMailer = sendPasswordResetEmail,
) {
  outboxKey();
  const at = new Date();
  const lease = ctx.id();
  const job = await ctx.c("mailOutbox").findOneAndUpdate(
    {
      expiresAt: { $gt: at },
      attempts: { $lt: 5 },
      $or: [
        { state: "queued", availableAt: { $lte: at } },
        { state: "sending", leaseUntil: { $lte: at } },
      ],
    },
    {
      $set: {
        state: "sending",
        lease,
        leaseUntil: new Date(at.getTime() + 120000),
      },
      $inc: { attempts: 1 },
    },
    { sort: { availableAt: 1 }, returnDocument: "after" },
  );
  if (!job) return false;
  const filter = { _id: job._id, lease };
  const verification = job.purpose === "email_verification";
  const tokens = verification
    ? "emailVerificationTokens"
    : "passwordResetTokens";
  try {
    const active = await ctx.c(tokens).findOne({
      _id: job.userId,
      tokenHash: job.tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });
    const user = await ctx
      .c("users")
      .findOne({ _id: job.userId, disabledAt: { $exists: false } });
    if (
      !active ||
      !user ||
      (!verification && user.emailVerified !== true) ||
      (verification && active.passwordHash !== user.passwordHash)
    ) {
      await ctx.c("mailOutbox").deleteOne(filter);
      return true;
    }
    const cipher = createDecipheriv(
      "aes-256-gcm",
      outboxKey(),
      Buffer.from(job.payload.iv, "base64"),
    );
    cipher.setAAD(Buffer.from(job._id));
    cipher.setAuthTag(Buffer.from(job.payload.tag, "base64"));
    const payload = JSON.parse(
      Buffer.concat([
        cipher.update(Buffer.from(job.payload.data, "base64")),
        cipher.final(),
      ]).toString(),
    ) as { email: string; token: string };
    if (
      payload.email !== (verification ? active.email : user.email) ||
      ctx.hash(payload.token) !== job.tokenHash
    )
      throw new Error("Stale payload");
    await mailer(
      payload.email,
      payload.token,
      verification ? "email_verification" : "password_reset",
    );
    // Delete ciphertext immediately after successful delivery; retain audit only.
    await ctx.c("mailOutbox").deleteOne(filter);
    await ctx.audit(
      job.userId,
      verification
        ? "email_verification_mail_sent"
        : "password_reset_mail_sent",
      job.userId,
    );
  } catch {
    const exhausted = job.attempts >= 5;
    await ctx.c("mailOutbox").updateOne(filter, {
      $set: {
        state: exhausted ? "failed" : "queued",
        availableAt: new Date(
          Date.now() + Math.min(300000, 1000 * 2 ** job.attempts),
        ),
        lastError: "delivery_failed",
      },
      $unset: {
        lease: "",
        leaseUntil: "",
        ...(exhausted ? { payload: "" } : {}),
      },
    });
    if (exhausted)
      await ctx
        .c(tokens)
        .deleteOne({ _id: job.userId, tokenHash: job.tokenHash });
  }
  return true;
}
