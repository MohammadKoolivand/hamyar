import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";

// Course membership is always approved by the course owner. A short-lived,
// high-entropy code only authorizes a student to REQUEST membership.
export function registerCourseMembership(app: FastifyInstance, ctx: Context) {
  const { c, user, fail, now, id, hash, randomBytes } = ctx;
  const uuid = z.string().uuid();

  app.post("/api/courses/:cid/join-code", async (r) => {
    const teacher = await user(r, "teacher");
    const { cid } = z.object({ cid: uuid }).parse(r.params);
    const course = await c("courses").findOne({
      _id: cid, teacherId: teacher._id, status: "active",
    });
    if (!course) fail(404, "درس یافت نشد");
    const code = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 3600000);
    await ctx.transaction(async (session) => {
      // Rotating a code invalidates all previously issued unused codes.
      await c("courseJoinCodes").deleteMany({ courseId: cid }, { session });
      await c("courseJoinCodes").insertOne({
        _id: id(), courseId: cid, teacherId: teacher._id,
        tokenHash: hash(code), expiresAt,
      }, { session });
      await c("auditLogs").insertOne({
        _id: id(), actorId: teacher._id, action: "rotate_course_join_code",
        resourceId: cid, createdAt: now(),
      }, { session });
    });
    return { code, expiresAt: expiresAt.toISOString() };
  });

  app.post("/api/course-requests", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (r) => {
    const student = await user(r, "student");
    const { code } = z.object({ code: z.string().regex(/^[a-f0-9]{48}$/) }).parse(r.body);
    return ctx.transaction(async (session) => {
      const record = await c("courseJoinCodes").findOne({
        tokenHash: hash(code), expiresAt: { $gt: new Date() },
      }, { session });
      if (!record) fail(400, "کد درخواست نامعتبر یا منقضی شده است");
      const course = await c("courses").findOne({
        _id: record!.courseId, teacherId: record!.teacherId, status: "active",
      }, { session });
      if (!course) fail(404, "درس پیدا نشد");
      const enrolled = await c("enrollments").findOne({
        courseId: course!._id, studentId: student._id, status: "active",
      }, { session });
      if (enrolled) fail(409, "قبلاً عضو این درس شده‌اید");
      const existing = await c("courseRequests").findOne({
        courseId: course!._id, studentId: student._id,
      }, { session });
      if (existing?.status === "pending") fail(409, "درخواست شما قبلاً ثبت شده است");
      const timestamp = now();
      const event = { status: "pending", actorId: student._id, at: timestamp };
      if (existing) {
        await c("courseRequests").updateOne(
          { _id: existing._id, status: { $ne: "pending" } },
          { $set: { status: "pending", updatedAt: timestamp, history: [...(existing.history ?? []), event] } },
          { session },
        );
      } else {
        await c("courseRequests").insertOne({
          _id: id(), teacherId: course!.teacherId, courseId: course!._id,
          studentId: student._id, status: "pending",
          createdAt: timestamp, updatedAt: timestamp, history: [event],
        }, { session });
      }
      await c("auditLogs").insertOne({
        _id: id(), actorId: student._id, action: "request_course_membership",
        resourceId: course!._id, createdAt: timestamp,
      }, { session });
      return { status: "pending", message: "درخواست برای معلم ارسال شد" };
    });
  });

  app.get("/api/course-requests", async (r) => {
    const actor = await user(r);
    if (actor.role === "parent") fail(403, "دسترسی مجاز نیست");
    const rows = await c("courseRequests")
      .find(actor.role === "teacher"
        ? { teacherId: actor._id }
        : { studentId: actor._id })
      .sort({ updatedAt: -1 }).toArray();
    const courses = await c("courses").find({
      _id: { $in: rows.map((v) => v.courseId) },
    }).project({ _id: 1, title: 1, subject: 1, teacherId: 1 }).toArray();
    const courseMap = new Map(courses.map((v) => [v._id, v]));
    const students = actor.role === "teacher"
      ? await c("users").find({
          _id: { $in: rows.map((v) => v.studentId) }, role: "student",
        }).project({ _id: 1, name: 1, phone: 1 }).toArray()
      : [];
    const studentMap = new Map(students.map((v) => [v._id, v]));
    return rows.flatMap((v) => {
      const course = courseMap.get(v.courseId);
      if (!course || course.teacherId !== v.teacherId) return [];
      const student = studentMap.get(v.studentId);
      return [{
        _id: v._id, courseId: v.courseId, teacherId: v.teacherId,
        studentId: v.studentId, status: v.status,
        courseTitle: course.title, subject: course.subject,
        createdAt: v.createdAt, updatedAt: v.updatedAt,
        history: v.history ?? [],
        ...(actor.role === "teacher" ? {
          studentName: student?.name ?? "دانش‌آموز",
          studentPhone: student?.phone ?? "",
        } : {}),
      }];
    });
  });

  app.post("/api/course-requests/:rid/decision", async (r) => {
    const teacher = await user(r, "teacher");
    const { rid } = z.object({ rid: uuid }).parse(r.params);
    const { decision } = z.object({ decision: z.enum(["approve", "decline"]) }).parse(r.body);
    return ctx.transaction(async (session) => {
      const request = await c("courseRequests").findOne({
        _id: rid, teacherId: teacher._id, status: "pending",
      }, { session });
      if (!request) fail(404, "درخواست در انتظار یافت نشد");
      const course = await c("courses").findOne({
        _id: request!.courseId, teacherId: teacher._id, status: "active",
      }, { session });
      if (!course) fail(404, "درس یافت نشد");
      const timestamp = now();
      if (decision === "approve") {
        const member = await c("enrollments").findOne({
          courseId: course!._id, studentId: request!.studentId,
        }, { session });
        if (member) {
          await c("enrollments").updateOne(
            { _id: member._id },
            { $set: { status: "active", updatedAt: timestamp,
                history: [...(member.history ?? []), { status: "active", actorId: teacher._id, at: timestamp }] } },
            { session },
          );
        } else {
          await c("enrollments").insertOne({
            _id: id(), courseId: course!._id, teacherId: teacher._id,
            studentId: request!.studentId, status: "active",
            createdAt: timestamp, history: [{ status: "active", actorId: teacher._id, at: timestamp }],
          }, { session });
        }
        await c("relations").updateOne(
          { teacherId: teacher._id, studentId: request!.studentId },
          { $setOnInsert: {
            _id: id(), teacherId: teacher._id, studentId: request!.studentId,
          } },
          { upsert: true, session },
        );
      }
      const next = decision === "approve" ? "approved" : "declined";
      const event = { status: next, actorId: teacher._id, at: timestamp };
      const result = await c("courseRequests").updateOne(
        { _id: rid, status: "pending" },
        { $set: { status: next, updatedAt: timestamp, history: [...(request!.history ?? []), event] } },
        { session },
      );
      if (result.modifiedCount !== 1) fail(409, "وضعیت درخواست تغییر کرده است");
      await c("auditLogs").insertOne({
        _id: id(), actorId: teacher._id, action: "course_request_" + next,
        resourceId: rid, createdAt: timestamp,
      }, { session });
      return { status: next };
    });
  });

  app.post("/api/enrollments/:eid/leave", async (r) => {
    const actor = await user(r);
    if (actor.role === "parent") fail(403, "دسترسی مجاز نیست");
    const { eid } = z.object({ eid: uuid }).parse(r.params);
    return ctx.transaction(async (session) => {
      const enrollment = await c("enrollments").findOne({
        _id: eid, status: "active",
        ...(actor.role === "teacher" ? { teacherId: actor._id } : { studentId: actor._id }),
      }, { session });
      if (!enrollment) fail(404, "عضویت فعال پیدا نشد");
      const timestamp = now();
      const result = await c("enrollments").updateOne(
        { _id: eid, status: "active" },
        { $set: { status: "revoked", updatedAt: timestamp,
            history: [...(enrollment!.history ?? []), { status: "revoked", actorId: actor._id, at: timestamp }] } },
        { session },
      );
      if (result.modifiedCount !== 1) fail(409, "عضویت قبلاً تغییر کرده است");
      // Freeze unfinished course assignments; retain attempts, reviews,
      // completed work and evidence for historical access.
      const unfinished = await c("assignments").find({
        enrollmentId: eid,
        state: { $in: ["published", "in_progress"] },
      }, { session }).project({ missionId: 1 }).toArray();
      if (unfinished.length) {
        await c("assignments").updateMany(
          { enrollmentId: eid, state: { $in: ["published", "in_progress"] } },
          { $set: { state: "cancelled" }, $inc: { revision: 1 } },
          { session },
        );
        await c("missions").updateMany(
          { _id: { $in: unfinished.map((a) => a.missionId) },
            state: { $in: ["published", "in_progress"] } },
          { $set: { state: "cancelled" } },
          { session },
        );
      }
      await c("auditLogs").insertOne({
        _id: id(), actorId: actor._id, action: "revoke_course_enrollment",
        resourceId: eid, createdAt: timestamp,
      }, { session });
      return { ok: true, cancelledAssignments: unfinished.length };
    });
  });

  // Student and teacher can inspect their own historical membership changes.
  app.get("/api/enrollment-history", async (r) => {
    const actor = await user(r);
    if (actor.role === "parent") fail(403, "دسترسی مجاز نیست");
    const rows = await c("enrollments").find(
      actor.role === "teacher" ? { teacherId: actor._id } : { studentId: actor._id },
    ).sort({ createdAt: -1 }).toArray();
    const courses = await c("courses").find({
      _id: { $in: rows.map((v) => v.courseId) },
    }).project({ _id: 1, teacherId: 1, title: 1, subject: 1 }).toArray();
    const byId = new Map(courses.map((v) => [v._id, v]));
    return rows.flatMap((v) => {
      const course = byId.get(v.courseId);
      if (!course || course.teacherId !== v.teacherId) return [];
      return [{
        _id: v._id, courseId: v.courseId, teacherId: v.teacherId,
        studentId: v.studentId, status: v.status,
        courseTitle: course.title, subject: course.subject,
        createdAt: v.createdAt, history: v.history ?? [],
      }];
    });
  });
}
