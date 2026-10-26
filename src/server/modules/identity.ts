import {
  accountContact,
  invitationContactSchema,
  phoneSchema,
} from "../../lib/phone";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import type { ClientSession } from "mongodb";
import type { Row } from "../db";
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
  async function addEnrollment(
    inv: Row,
    studentId: string,
    session: ClientSession,
  ) {
    // Legacy teacher-only invitations intentionally remain valid without a course.
    if (!inv.courseId) return;
    const course = await c("courses").findOne(
      {
        _id: inv.courseId,
        teacherId: inv.teacherId,
        status: "active",
      },
      { session },
    );
    if (!course) fail(404, "این درس دیگر در دسترس نیست");
    await c("enrollments").updateOne(
      { courseId: course!._id, studentId },
      {
        $setOnInsert: {
          _id: id(),
          courseId: course!._id,
          teacherId: inv.teacherId,
          studentId,
          status: "active",
          createdAt: now(),
        },
      },
      { upsert: true, session },
    );
  }
  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (r) => {
      const b = credentials
        .extend({
          name: z.string().trim().min(2).max(100),
          // Legacy teacher registrations without a role remain supported.
          // Roles cannot be escalated through public registration.
          role: z.enum(["teacher", "student"]).default("teacher"),
        })
        .parse(r.body);
      const salt = randomBytes(16).toString("hex");
      const uid = id();
      await c("users").insertOne({
        _id: uid,
        name: b.name,
        ...accountContact(b.email),
        role: b.role,
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
        u = await c("users").findOne(accountContact(b.email));
      // Malformed/legacy password records must fail authentication, not throw
      // from timingSafeEqual (which requires buffers of identical length).
      // Still run scrypt for absent or malformed accounts to limit timing leaks.
      const [salt, digest] =
        typeof u?.passwordHash === "string"
          ? u.passwordHash.split(":")
          : [];
      const validDigest = /^[a-f0-9]{128}$/i.test(digest ?? "");
      const storedDigest = validDigest
        ? Buffer.from(digest, "hex")
        : Buffer.alloc(64);
      const safeSalt =
        typeof salt === "string" && salt.length > 0 && salt.length <= 128
          ? salt
          : "invalid";
      const passwordMatches = timingSafeEqual(
        storedDigest,
        scryptSync(b.password, safeSalt, 64),
      );
      if (!passwordMatches || !u || u.disabledAt)
        fail(401, "شماره موبایل، ایمیل یا رمز نادرست است");
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
        secure:
          process.env.COOKIE_SECURE === "true" ||
          (process.env.NODE_ENV === "production" &&
            (process.env.APP_ORIGIN ?? "").startsWith("https://")),
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
      b = invitationContactSchema
        .safeExtend({
          role: z.enum(["student", "parent"]).default("student"),
          studentId: z.string().uuid().optional(),
          courseId: z.string().uuid().optional(),
        })
        .parse(r.body);
    if (
      b.role === "parent" &&
      (!b.studentId ||
        !(await c("relations").findOne({
          teacherId: u._id,
          studentId: b.studentId,
        })))
    )
      fail(404, "دانش‌آموز مرتبط یافت نشد");
    if (b.courseId) {
      if (b.role !== "student") fail(400, "دعوت اولیا به درس متصل نمی‌شود");
      const course = await c("courses").findOne({
        _id: b.courseId,
        teacherId: u._id,
        status: "active",
      });
      if (!course) fail(404, "درس پیدا نشد");
    }
    const token = randomBytes(24).toString("hex");
    await c("invitations").insertOne({
      _id: id(),
      teacherId: u._id,
      role: b.role,
      ...(b.role === "parent" ? { studentId: b.studentId } : {}),
      ...(b.role === "student" && b.courseId ? { courseId: b.courseId } : {}),
      ...(b.phone ? { phone: b.phone } : { email: b.email }),
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 72 * 3600000),
      usedAt: null,
    });
    await audit(u._id, "invite", "invitation_created");
    return { token, expiresInHours: 72 };
  });
  app.post(
    "/api/invitations/accept",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (r) => "invite-ip:" + r.ip,
        },
      },
    },
    async (r) => {
      const b = invitationContactSchema
        .safeExtend({
          password: z.string().min(10).max(128),
          name: z.string().min(2).max(100),
          token: z.string().min(20).max(100),
        })
        .parse(r.body);
      const contact = b.phone ? { phone: b.phone } : { email: b.email! };
      const existing = await c("users").findOne(contact);
      if (existing) {
        const [salt, digest] = existing.passwordHash.split(":");
        if (
          existing.disabledAt ||
          !["student", "parent"].includes(existing.role) ||
          !timingSafeEqual(
            Buffer.from(digest, "hex"),
            scryptSync(b.password, salt, 64),
          )
        )
          fail(401, "برای اتصال حساب موجود، رمز همان حساب را وارد کنید");
      }
      return ctx.transaction(async (session) => {
        const inv = await c("invitations").findOneAndUpdate(
          {
            tokenHash: hash(b.token),
            ...contact,
            usedAt: null,
            expiresAt: { $gt: new Date() },
          },
          { $set: { usedAt: now() } },
          { returnDocument: "after", session },
        );
        if (!inv) fail(400, "دعوت نامعتبر یا منقضی شده");
        const role = inv!.role ?? "student";
        if (existing && existing.role !== role)
          fail(409, "نقش حساب با نوع دعوت سازگار نیست");
        if (
          role === "parent" &&
          !(await c("relations").findOne(
            { teacherId: inv!.teacherId, studentId: inv!.studentId },
            { session },
          ))
        )
          fail(404, "ارتباط آموزشی معتبر نیست");
        const salt = randomBytes(16).toString("hex"),
          uid = existing?._id ?? id();
        if (!existing)
          await c("users").insertOne(
            {
              _id: uid,
              name: b.name,
              ...contact,
              role,
              passwordHash:
                salt + ":" + scryptSync(b.password, salt, 64).toString("hex"),
            },
            { session },
          );
        await ctx.boundary("after_invited_user_insert");
        if (role === "parent") {
          await c("parentLinks").updateOne(
            {
              parentId: uid,
              studentId: inv!.studentId,
              teacherId: inv!.teacherId,
            },
            {
              $setOnInsert: {
                _id: id(),
                parentId: uid,
                studentId: inv!.studentId,
                teacherId: inv!.teacherId,
                createdAt: now(),
                verification: "teacher_invited",
              },
            },
            { upsert: true, session },
          );
        } else {
          await c("relations").updateOne(
            { teacherId: inv!.teacherId, studentId: uid },
            {
              $setOnInsert: {
                _id: id(),
                teacherId: inv!.teacherId,
                studentId: uid,
              },
            },
            { upsert: true, session },
          );
          await addEnrollment(inv!, uid, session);
        }
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: uid,
            action: "accept_invitation",
            resourceId: inv!._id,
            createdAt: now(),
          },
          { session },
        );
        return { message: "عضویت انجام شد؛ وارد شوید" };
      });
    },
  );
  // An existing, signed-in student can accept a teacher's contact-bound
  // invitation without creating another account or re-entering a password.
  app.post("/api/invitations/claim", async (r) => {
    const student = await user(r, "student");
    const { token, phone } = z
      .object({
        token: z.string().min(20).max(100),
        phone: phoneSchema.optional(),
      })
      .parse(r.body);
    if (phone && student.phone && phone !== student.phone)
      fail(400, "شماره موبایل با حساب شما مطابقت ندارد");
    const claimedPhone = student.phone ?? phone;
    return ctx.transaction(async (session) => {
      const inv = await c("invitations").findOneAndUpdate(
        {
          tokenHash: hash(token),
          ...(claimedPhone
            ? {
                $or: [
                  { phone: claimedPhone },
                  ...(student.email ? [{ email: student.email }] : []),
                ],
              }
            : { email: student.email }),
          role: "student",
          usedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { usedAt: now() } },
        { returnDocument: "after", session },
      );
      if (!inv) fail(400, "دعوت نامعتبر یا منقضی شده");
      if (inv!.phone && !student.phone) {
        const linked = await c("users").updateOne(
          { _id: student._id, phone: { $exists: false } },
          { $set: { phone: inv!.phone } },
          { session },
        );
        if (!linked.modifiedCount)
          fail(409, "شماره حساب تغییر کرده؛ دوباره وارد شوید");
      }
      await c("relations").updateOne(
        { teacherId: inv!.teacherId, studentId: student._id },
        {
          $setOnInsert: {
            _id: id(),
            teacherId: inv!.teacherId,
            studentId: student._id,
          },
        },
        { session, upsert: true },
      );
      await addEnrollment(inv!, student._id, session);
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: student._id,
          action: "claim_teacher_invitation",
          resourceId: inv!._id,
          createdAt: now(),
        },
        { session },
      );
      return { message: "اتصال به معلم انجام شد" };
    });
  });
  app.get("/api/students/:sid/parents", async (r) => {
    const u = await user(r, "teacher"),
      { sid } = r.params as { sid: string };
    if (!(await c("relations").findOne({ teacherId: u._id, studentId: sid })))
      fail(404, "دانش‌آموز یافت نشد");
    const links = await c("parentLinks")
      .find({ teacherId: u._id, studentId: sid })
      .toArray();
    return (
      await c("users")
        .find({ _id: { $in: links.map((l) => l.parentId) } })
        .toArray()
    ).map((s) => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      phone: s.phone,
    }));
  });
  app.post("/api/students/:sid/parents/:pid/revoke", async (r) => {
    const u = await user(r, "teacher"),
      { sid, pid } = r.params as { sid: string; pid: string };
    if (!(await c("relations").findOne({ teacherId: u._id, studentId: sid })))
      fail(404, "دانش‌آموز یافت نشد");
    return ctx.atomic(
      r,
      u._id,
      `revoke-parent:${sid}:${pid}`,
      {},
      async (session) => {
        await c("parentLinks").deleteOne(
          { teacherId: u._id, studentId: sid, parentId: pid },
          { session },
        );
        const p = await c("users").findOne({ _id: pid }, { session });
        if (p)
          await c("invitations").updateMany(
            {
              teacherId: u._id,
              studentId: sid,
              ...(p.phone
                ? {
                    $or: [
                      { phone: p.phone },
                      ...(p.email ? [{ email: p.email }] : []),
                    ],
                  }
                : { email: p.email }),
              role: "parent",
              usedAt: null,
            },
            { $set: { usedAt: now() } },
            { session },
          );
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "revoke_parent",
            resourceId: pid,
            createdAt: now(),
          },
          { session },
        );
        return { ok: true };
      },
    );
  });
  app.get("/api/children", async (r) => {
    const u = await user(r, "parent");
    const links = await c("parentLinks").find({ parentId: u._id }).toArray();
    return (
      await c("users")
        .find({ _id: { $in: links.map((l) => l.studentId) }, role: "student" })
        .toArray()
    ).map((s) => ({ _id: s._id, name: s.name }));
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
