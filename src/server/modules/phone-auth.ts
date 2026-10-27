import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import type { ClientSession } from "mongodb";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { phoneSchema, normalizePhone } from "../../lib/phone";
import type { Context } from "../context";
import type { Row } from "../db";
import type { SmsProvider } from "../auth/sms";
// Never accept arbitrary codes against deployed hosts or real databases.
// Only an explicitly named, loopback-only MongoDB development database is allowed.
export function developmentOtpBypass(activeDatabase?: string) {
  if (
    (activeDatabase !== undefined && activeDatabase !== process.env.MONGO_DB) ||
    process.env.NODE_ENV !== "development" ||
    process.env.AUTH_OTP_DEV_BYPASS !== "true" ||
    !/^(hodhodeh_dev|hodhod_dev|hamyar_dev)(?:_[a-z0-9_-]+)?$/.test(process.env.MONGO_DB ?? "")
  ) return false;
  try {
    const origin = new URL(process.env.APP_ORIGIN ?? "");
    const mongo = new URL(process.env.MONGO_URL ?? "");
    return (
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname) &&
      mongo.protocol === "mongodb:" &&
      ["localhost", "127.0.0.1"].includes(mongo.hostname)
    );
  } catch {
    return false;
  }
}
const developmentSecret = randomBytes(32);
function secret() {
  if (developmentOtpBypass()) return developmentSecret;
  const key = Buffer.from(process.env.AUTH_OTP_SECRET ?? "", "base64");
  if (key.length !== 32) throw new Error("Configure AUTH_OTP_SECRET");
  return key;
}
function digest(challenge: string, phone: string, code: string) {
  return createHmac("sha256", secret())
    .update(JSON.stringify([challenge, phone, code]))
    .digest("hex");
}
export function registerPhoneAuth(
  app: FastifyInstance,
  ctx: Context,
  sms: SmsProvider,
  linkInvitation: (
    inv: Row,
    uid: string,
    session: ClientSession,
  ) => Promise<void>,
  activeDatabase: string,
) {
  app.post(
    "/api/auth/otp/request",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "10 minutes",
          keyGenerator: (r) => "otp:" + r.ip,
        },
      },
    },
    async (r) => {
      const { phone } = z.object({ phone: phoneSchema }).strict().parse(r.body);
      const bypass = developmentOtpBypass(activeDatabase);
      if (process.env.AUTH_OTP_DEV_BYPASS === "true" && !bypass)
        ctx.fail(503, "حالت آزمایشی فقط روی محیط توسعه محلی و دیتابیس آزمایشی مجاز است.");
      if (!bypass && !sms.configured())
        ctx.fail(
          503,
          "ارسال کد پیامکی هنوز تنظیم نشده است؛ با پشتیبانی تماس بگیرید.",
        );
      try {
        secret();
      } catch {
        ctx.fail(503, "ورود پیامکی هنوز آماده نیست.");
      }
      const key = ctx.hash("otp:" + phone);
      const at = new Date();
      // Durable per-phone cooldown and hourly send cap, shared by all web instances.
      await ctx.c("otpThrottle").updateOne(
        { _id: key },
        {
          $setOnInsert: {
            nextAllowedAt: new Date(0),
            windowEndsAt: new Date(0),
            count: 0,
          },
        },
        { upsert: true },
      );
      await ctx.c("otpThrottle").updateOne(
        { _id: key, windowEndsAt: { $lte: at } },
        {
          $set: { count: 0, windowEndsAt: new Date(at.getTime() + 3600000) },
        },
      );
      const allowed = await ctx.c("otpThrottle").updateOne(
        { _id: key, nextAllowedAt: { $lte: at }, count: { $lt: 5 } },
        {
          $set: {
            nextAllowedAt: new Date(at.getTime() + 60000),
            expiresAt: new Date(at.getTime() + 86400000),
          },
          $inc: { count: 1 },
        },
      );
      if (!allowed.modifiedCount)
        ctx.fail(429, "کمی بعد دوباره درخواست کد بدهید.");
      const challengeId = ctx.id();
      const code = String(randomInt(100000, 1000000));
      await ctx.c("otpChallenges").replaceOne(
        { _id: key },
        {
          _id: key,
          challengeId,
          codeHash: digest(challengeId, phone, code),
          state: "sending",
          developmentBypass: bypass,
          attempts: 0,
          expiresAt: new Date(at.getTime() + 300000),
        },
        { upsert: true },
      );
      try {
        if (!bypass) await sms.sendOtp(phone, code);
      } catch {
        await ctx.c("otpChallenges").deleteOne({ _id: key, challengeId });
        ctx.fail(503, "ارسال کد انجام نشد؛ کمی بعد دوباره تلاش کنید.");
      }
      const ready = await ctx.c("otpChallenges").updateOne(
        {
          _id: key,
          challengeId,
          state: "sending",
          expiresAt: { $gt: new Date() },
        },
        { $set: { state: "active" } },
      );
      if (!ready.modifiedCount)
        ctx.fail(503, "کد معتبر نیست؛ دوباره درخواست کنید.");
      return {
        challengeId,
        expiresIn: 300,
        resendAfter: 60,
        developmentBypass: bypass,
        message: bypass
          ? "حالت توسعه: پیامک ارسال نمی‌شود؛ هر کد شش‌رقمی پذیرفته می‌شود."
          : "کد تأیید به شماره واردشده ارسال شد.",
      };
    },
  );
  app.post(
    "/api/auth/otp/verify",
    {
      config: {
        rateLimit: {
          max: 15,
          timeWindow: "10 minutes",
          keyGenerator: (r) => "otp-verify:" + r.ip,
        },
      },
    },
    async (r, reply) => {
      const b = z
        .object({
          phone: phoneSchema,
          challengeId: z.uuid(),
          code: z
            .string()
            .transform(normalizePhone)
            .pipe(z.string().regex(/^\d{6}$/)),
          name: z.string().trim().min(2).max(100).optional(),
          role: z.enum(["teacher", "student"]).optional(),
          invitationToken: z.string().min(20).max(100).optional(),
        })
        .strict()
        .parse(r.body);
      try {
        secret();
      } catch {
        ctx.fail(503, "ورود پیامکی هنوز آماده نیست.");
      }
      const bypass = developmentOtpBypass(activeDatabase);
      if (process.env.AUTH_OTP_DEV_BYPASS === "true" && !bypass)
        ctx.fail(503, "حالت آزمایشی فقط روی محیط توسعه محلی و دیتابیس آزمایشی مجاز است.");
      const sessionToken = ctx.randomBytes(32).toString("hex");
      const result = await ctx.transaction(async (session) => {
        const query = {
          _id: ctx.hash("otp:" + b.phone),
          challengeId: b.challengeId,
          state: "active",
          expiresAt: { $gt: new Date() },
          attempts: { $lt: 5 },
        };
        const challenge = await ctx
          .c("otpChallenges")
          .findOneAndUpdate(
            query,
            { $inc: { attempts: 1 } },
            { session, returnDocument: "after" },
          );
        if (!challenge) return null;
        if (Boolean(challenge.developmentBypass) !== bypass) return null;
        if (
          !bypass &&
          !timingSafeEqual(
            Buffer.from(challenge.codeHash, "hex"),
            Buffer.from(digest(b.challengeId, b.phone, b.code), "hex"),
          )
        )
          return null;
        let user = await ctx
          .c("users")
          .findOne({ phone: b.phone }, { session });
        let inv: Row | null = null;
        if (b.invitationToken) {
          inv = await ctx.c("invitations").findOne(
            {
              tokenHash: ctx.hash(b.invitationToken),
              phone: b.phone,
              usedAt: null,
              expiresAt: { $gt: new Date() },
            },
            { session },
          );
          if (!inv || !["student", "parent"].includes(inv.role ?? "student"))
            ctx.fail(400, "دعوت نامعتبر یا منقضی است.");
        }
        if (user?.disabledAt) {
          await ctx.c("otpChallenges").deleteOne(query, { session });
          return null;
        }
        if (!user) {
          if (!b.name || (!inv && !b.role))
            ctx.fail(400, "برای ساخت حساب، نام و نقش خود را مشخص کنید.");
          user = {
            _id: ctx.id(),
            name: b.name,
            role: inv ? (inv.role ?? "student") : b.role!,
            phone: b.phone,
            phoneVerified: !bypass,
            ...(!bypass ? { phoneVerifiedAt: ctx.now() } : {}),
            createdAt: ctx.now(),
          };
          await ctx.c("users").insertOne(user, { session });
        }
        if (inv && user.role !== (inv.role ?? "student"))
          ctx.fail(409, "نقش حساب با دعوت سازگار نیست.");
        await ctx.c("users").updateOne(
          { _id: user._id, disabledAt: { $exists: false } },
          {
            $set: bypass
              ? { lastDevelopmentLoginAt: ctx.now() }
              : { phoneVerified: true, phoneVerifiedAt: ctx.now() },
            $inc: { authRevision: 1 },
          },
          { session },
        );
        if (inv) {
          await linkInvitation(inv, user._id, session);
          await ctx
            .c("invitations")
            .updateOne(
              { _id: inv._id, usedAt: null },
              { $set: { usedAt: ctx.now() } },
              { session },
            );
        }
        await ctx
          .c("otpChallenges")
          .deleteOne(
            { _id: challenge._id, challengeId: b.challengeId },
            { session },
          );
        await ctx.c("sessions").insertOne(
          {
            _id: ctx.id(),
            userId: user._id,
            tokenHash: ctx.hash(sessionToken),
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
          { session },
        );
        await ctx.c("auditLogs").insertOne(
          {
            _id: ctx.id(),
            actorId: user._id,
            action: bypass ? "development_otp_login" : "otp_login",
            resourceId: user._id,
            createdAt: ctx.now(),
          },
          { session },
        );
        return ctx.safe({
          ...user,
          phoneVerified: bypass ? Boolean(user.phoneVerified) : true,
        });
      });
      if (!result)
        ctx.fail(400, "کد نامعتبر، منقضی یا بیش از حد امتحان شده است.");
      reply.setCookie("session", sessionToken, {
        httpOnly: true,
        sameSite: "strict",
        secure:
          process.env.COOKIE_SECURE === "true" ||
          (process.env.NODE_ENV === "production" &&
            (process.env.APP_ORIGIN ?? "").startsWith("https://")),
        path: "/",
        maxAge: 604800,
      });
      return result;
    },
  );
}
