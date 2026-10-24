import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
export function registerIdentity(app: FastifyInstance, ctx: Context) {
  const {
    c,
    user,
    safe,
    audit,
    id,
    now,
    hash,
    fail,
    credentials,
    randomBytes,
    scryptSync,
    timingSafeEqual,
  } = ctx;
  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (r) => {
      const b = credentials
        .extend({ name: z.string().min(2).max(100) })
        .parse(r.body);
      const salt = randomBytes(16).toString("hex");
      const uid = id();
      await c("users").insertOne({
        _id: uid,
        name: b.name,
        email: b.email,
        role: "teacher",
        passwordHash:
          salt + ":" + scryptSync(b.password, salt, 64).toString("hex"),
      });
      await audit(uid, "register", uid);
      return { message: "حساب ساخته شد؛ وارد شوید" };
    },
  );
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (r, reply) => {
      const b = credentials.parse(r.body),
        u = await c("users").findOne({ email: b.email });
      const [salt, digest] = (
        u?.passwordHash ?? "invalid:" + "0".repeat(128)
      ).split(":");
      if (
        !timingSafeEqual(
          Buffer.from(digest, "hex"),
          scryptSync(b.password, salt, 64),
        )
      )
        fail(401, "ایمیل یا رمز نادرست است");
      const token = randomBytes(32).toString("hex");
      await c("sessions").insertOne({
        _id: id(),
        tokenHash: hash(token),
        userId: u!._id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
      reply.setCookie("session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 604800,
      });
      return safe(u!);
    },
  );
  app.get("/api/auth/me", async (r) => safe(await user(r)));
  app.post("/api/auth/logout", async (r, reply) => {
    if (r.cookies.session)
      await c("sessions").deleteOne({ tokenHash: hash(r.cookies.session) });
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
  app.post("/api/invitations", async (r) => {
    const u = await user(r, "teacher"),
      b = z
        .object({ email: z.email().transform((s) => s.toLowerCase()) })
        .parse(r.body);
    const token = randomBytes(24).toString("hex");
    await c("invitations").insertOne({
      _id: id(),
      teacherId: u._id,
      email: b.email,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 72 * 3600000),
      usedAt: null,
    });
    await audit(u._id, "invite", b.email);
    return { token, expiresInHours: 72 };
  });
  app.post("/api/invitations/accept", async (r) => {
    const b = credentials
      .extend({
        name: z.string().min(2).max(100),
        token: z.string().min(20).max(100),
      })
      .parse(r.body);
    const existing = await c("users").findOne({ email: b.email });
    if (existing) {
      const [salt, digest] = existing.passwordHash.split(":");
      if (
        existing.role !== "student" ||
        !timingSafeEqual(
          Buffer.from(digest, "hex"),
          scryptSync(b.password, salt, 64),
        )
      )
        fail(401, "برای اتصال حساب موجود، رمز همان حساب را وارد کنید");
    }
    const inv = await c("invitations").findOneAndUpdate(
      {
        tokenHash: hash(b.token),
        email: b.email,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: now() } },
      { returnDocument: "after" },
    );
    if (!inv) fail(400, "دعوت نامعتبر یا منقضی شده");
    const salt = randomBytes(16).toString("hex"),
      uid = existing?._id ?? id();
    if (!existing)
      await c("users").insertOne({
        _id: uid,
        name: b.name,
        email: b.email,
        role: "student",
        passwordHash:
          salt + ":" + scryptSync(b.password, salt, 64).toString("hex"),
      });
    await c("relations").updateOne(
      { teacherId: inv!.teacherId, studentId: uid },
      {
        $setOnInsert: { _id: id(), teacherId: inv!.teacherId, studentId: uid },
      },
      { upsert: true },
    );
    await audit(uid, "accept_invitation", inv!._id);
    return { message: "عضویت انجام شد؛ وارد شوید" };
  });
  app.get("/api/students", async (r) => {
    const u = await user(r, "teacher"),
      rels = await c("relations").find({ teacherId: u._id }).toArray();
    return (
      await c("users")
        .find({ _id: { $in: rels.map((x) => x.studentId) } })
        .toArray()
    ).map(safe);
  });
}
