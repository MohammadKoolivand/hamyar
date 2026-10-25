import { invitationContactSchema, accountContact } from "../../lib/phone";
import type { ClientSession } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import {
  roleSchema,
  roleLabels,
  staffPermissionSchema,
  staffPermissionLabels,
  type StaffPermission,
} from "../../lib/access";
export function registerAccessManagement(app: FastifyInstance, ctx: Context) {
  const { c, user, fail, id, now } = ctx;
  async function assertAdmin(actorId: string, session: ClientSession) {
    await c("securityLocks").updateOne(
      { _id: "access-management" },
      { $inc: { revision: 1 } },
      { upsert: true, session },
    );
    if (
      !(await c("users").findOne(
        { _id: actorId, role: "super_admin", disabledAt: { $exists: false } },
        { session },
      ))
    )
      fail(403, "دسترسی مدیریتی لغو شده است");
  }

  app.get("/api/access/me", async (r) => {
    const u = await user(r);
    return {
      role: u.role,
      label: roleLabels[u.role as keyof typeof roleLabels],
      staffAssignments:
        u.role === "secretary"
          ? await c("staffAssignments")
              .find({ secretaryId: u._id })
              .project({ _id: 1, teacherId: 1, permissions: 1 })
              .toArray()
          : [],
    };
  });
  app.get("/api/admin/users", async (r) => {
    await user(r, "super_admin");
    return c("users")
      .find({})
      .project({ _id: 1, name: 1, email: 1, phone: 1, role: 1, disabledAt: 1 })
      .sort({ name: 1 })
      .toArray();
  });
  app.get("/api/admin/audit", async (r) => {
    await user(r, "super_admin");
    return c("auditLogs")
      .find({})
      .project({ _id: 1, actorId: 1, action: 1, resourceId: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
  });
  app.post("/api/admin/users", async (r) => {
    const actor = await user(r, "super_admin");
    const b = ctx.credentials
      .extend({ name: z.string().trim().min(2).max(100), role: roleSchema })
      .parse(r.body);
    const salt = ctx.randomBytes(16).toString("hex");
    const uid = id();
    return ctx.transaction(async (session) => {
      await assertAdmin(actor._id, session);
      await c("users").insertOne(
        {
          _id: uid,
          name: b.name,
          ...accountContact(b.email),
          role: b.role,
          passwordHash:
            salt + ":" + ctx.scryptSync(b.password, salt, 64).toString("hex"),
          createdBy: actor._id,
          createdAt: now(),
        },
        { session },
      );
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: actor._id,
          action: "admin_create_user",
          resourceId: uid,
          createdAt: now(),
        },
        { session },
      );
      return {
        _id: uid,
        name: b.name,
        ...accountContact(b.email),
        role: b.role,
      };
    });
  });
  app.post("/api/admin/users/:uid/access", async (r) => {
    const actor = await user(r, "super_admin");
    const uid = z.uuid().parse((r.params as { uid: string }).uid);
    const b = z
      .object({ role: roleSchema, disabled: z.boolean() })
      .parse(r.body);
    if (uid === actor._id)
      fail(409, "تغییر نقش یا مسدودکردن حساب خودتان از این مسیر مجاز نیست");
    return ctx.transaction(async (session) => {
      await assertAdmin(actor._id, session);
      await c("securityLocks").updateOne(
        { _id: "access-management" },
        { $inc: { revision: 1 } },
        { upsert: true, session },
      );
      const target = await c("users").findOne({ _id: uid }, { session });
      if (!target) fail(404, "کاربر یافت نشد");
      if (
        target!.role === "super_admin" &&
        (b.role !== "super_admin" || b.disabled) &&
        (await c("users").countDocuments(
          { role: "super_admin", disabledAt: { $exists: false } },
          { session },
        )) <= 1
      )
        fail(409, "آخرین سوپرادمین فعال را نمی‌توان حذف یا مسدود کرد");
      await c("users").updateOne(
        { _id: uid },
        {
          $set: { role: b.role, ...(b.disabled ? { disabledAt: now() } : {}) },
          ...(!b.disabled ? { $unset: { disabledAt: "" } } : {}),
        },
        { session },
      );
      await c("sessions").deleteMany({ userId: uid }, { session });
      if (b.role !== "secretary")
        await c("staffAssignments").deleteMany(
          { secretaryId: uid },
          { session },
        );
      if (b.role !== "teacher")
        await c("staffAssignments").deleteMany({ teacherId: uid }, { session });
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: actor._id,
          action: "admin_update_access",
          resourceId: uid,
          previousRole: target!.role,
          nextRole: b.role,
          disabled: b.disabled,
          createdAt: now(),
        },
        { session },
      );
      return { ok: true };
    });
  });
  app.get("/api/admin/staff-assignments", async (r) => {
    await user(r, "super_admin");
    return c("staffAssignments").find({}).toArray();
  });
  app.post("/api/admin/staff-assignments", async (r) => {
    const actor = await user(r, "super_admin");
    const b = z
      .object({
        secretaryId: z.uuid(),
        teacherId: z.uuid(),
        permissions: z.array(staffPermissionSchema).min(1).max(3),
      })
      .parse(r.body);
    return ctx.transaction(async (session) => {
      await assertAdmin(actor._id, session);
      await c("securityLocks").updateOne(
        { _id: "access-management" },
        { $inc: { revision: 1 } },
        { upsert: true, session },
      );
      if (
        !(await c("users").findOne(
          {
            _id: b.secretaryId,
            role: "secretary",
            disabledAt: { $exists: false },
          },
          { session },
        )) ||
        !(await c("users").findOne(
          { _id: b.teacherId, role: "teacher", disabledAt: { $exists: false } },
          { session },
        ))
      )
        fail(400, "معلم یا منشی فعال معتبر نیست");
      await c("staffAssignments").updateOne(
        { secretaryId: b.secretaryId, teacherId: b.teacherId },
        {
          $set: {
            permissions: [...new Set(b.permissions)],
            updatedAt: now(),
            grantedBy: actor._id,
          },
          $setOnInsert: { _id: id() },
        },
        { upsert: true, session },
      );
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: actor._id,
          action: "grant_secretary_scope",
          resourceId: b.secretaryId,
          teacherId: b.teacherId,
          permissions: b.permissions,
          createdAt: now(),
        },
        { session },
      );
      return { ok: true };
    });
  });
  app.post("/api/admin/staff-assignments/:gid/revoke", async (r) => {
    const actor = await user(r, "super_admin");
    const gid = z.uuid().parse((r.params as { gid: string }).gid);
    await ctx.transaction(async (session) => {
      await assertAdmin(actor._id, session);
      await c("staffAssignments").deleteOne({ _id: gid }, { session });
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: actor._id,
          action: "revoke_secretary_scope",
          resourceId: gid,
          createdAt: now(),
        },
        { session },
      );
    });
    return { ok: true };
  });
  async function scope(
    r: Parameters<typeof user>[0],
    permission: StaffPermission,
  ) {
    const actor = await user(r, "secretary");
    const tid = z.uuid().parse((r.params as { tid: string }).tid);
    const grant = await c("staffAssignments").findOne({
      secretaryId: actor._id,
      teacherId: tid,
      permissions: permission,
    });
    const teacher = await c("users").findOne({
      _id: tid,
      role: "teacher",
      disabledAt: { $exists: false },
    });
    if (!grant || !teacher)
      fail(403, "دسترسی اجرایی به این معلم واگذار نشده است");
    return { actor, tid };
  }
  app.get("/api/staff/workspaces", async (r) => {
    const actor = await user(r, "secretary");
    const grants = await c("staffAssignments")
      .find({ secretaryId: actor._id })
      .toArray();
    const teachers = await c("users")
      .find({
        _id: { $in: grants.map((g) => g.teacherId) },
        role: "teacher",
        disabledAt: { $exists: false },
      })
      .project({ _id: 1, name: 1 })
      .toArray();
    return teachers.map((t) => ({
      ...t,
      permissions: grants.find((g) => g.teacherId === t._id)!.permissions,
      permissionLabels: staffPermissionLabels,
    }));
  });
  app.get("/api/staff/workspaces/:tid/roster", async (r) => {
    const { tid } = await scope(r, "roster.read");
    const relations = await c("relations").find({ teacherId: tid }).toArray();
    return c("users")
      .find({
        _id: { $in: relations.map((v) => v.studentId) },
        role: "student",
      })
      .project({ _id: 1, name: 1, email: 1, phone: 1, disabledAt: 1 })
      .sort({ name: 1 })
      .toArray();
  });
  app.get("/api/staff/workspaces/:tid/courses", async (r) => {
    const { tid } = await scope(r, "courses.read");
    const rows = await c("courses")
      .find({ teacherId: tid })
      .project({ _id: 1, title: 1, subject: 1, status: 1 })
      .toArray();
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        enrolled: await c("enrollments").countDocuments({
          teacherId: tid,
          courseId: row._id,
          status: "active",
        }),
      })),
    );
  });
  app.post("/api/staff/workspaces/:tid/invitations", async (r) => {
    const { tid, actor } = await scope(r, "invitations.create");
    const b = invitationContactSchema
      .safeExtend({
        role: z.enum(["student", "parent"]),
        studentId: z.uuid().optional(),
      })
      .parse(r.body);
    if (
      b.role === "parent" &&
      (!b.studentId ||
        !(await c("relations").findOne({
          teacherId: tid,
          studentId: b.studentId,
        })))
    )
      fail(404, "دانش‌آموز مرتبط یافت نشد");
    const token = ctx.randomBytes(24).toString("hex");
    await ctx.transaction(async (session) => {
      await c("securityLocks").updateOne(
        { _id: "access-management" },
        { $inc: { revision: 1 } },
        { upsert: true, session },
      );
      if (
        !(await c("users").findOne(
          { _id: actor._id, role: "secretary", disabledAt: { $exists: false } },
          { session },
        )) ||
        !(await c("staffAssignments").findOne(
          {
            secretaryId: actor._id,
            teacherId: tid,
            permissions: "invitations.create",
          },
          { session },
        ))
      )
        fail(403, "دسترسی اجرایی لغو شده است");
      await c("invitations").insertOne(
        {
          _id: id(),
          teacherId: tid,
          role: b.role,
          ...(b.role === "parent" ? { studentId: b.studentId } : {}),
          ...(b.phone ? { phone: b.phone } : { email: b.email }),
          tokenHash: ctx.hash(token),
          expiresAt: new Date(Date.now() + 72 * 3600000),
          usedAt: null,
          createdBy: actor._id,
        },
        { session },
      );
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: actor._id,
          action: "secretary_create_invitation",
          resourceId: tid,
          createdAt: now(),
        },
        { session },
      );
    });
    return { token, expiresInHours: 72 };
  });
}
