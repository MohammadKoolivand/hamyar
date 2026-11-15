import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";

const uuid = z.string().uuid();
const assignInput = z.object({
  pdfId: uuid,
  courseId: uuid,
  groupId: uuid.optional(),
  studentIds: z.array(uuid).min(1).max(50).refine((ids) => new Set(ids).size === ids.length),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(700).default(""),
  dueAt: z.string().datetime({ offset: true }).optional(),
}).strict();

/** A PDF delivery is independent of OCR and interactive-question assignments.
 * Each recipient gets a separate status. Listing/download always rechecks enrollment.
 */
export function registerPdfDeliveries(app: FastifyInstance, ctx: Context) {
  const { c, id, now, user, fail } = ctx;
  const active = (assignment: { state?: unknown; cancelledAt?: unknown }) =>
    assignment.state !== "cancelled" && !assignment.cancelledAt;

  app.post("/api/pdf-deliveries", async (r) => {
    const teacher = await user(r, "teacher");
    const input = assignInput.parse(r.body);
    return ctx.atomic(r, teacher._id, "create-pdf-delivery", input, async (session) => {
      const pdf = await c("pdfLibrary").findOne({
        _id: input.pdfId, ownerId: teacher._id, state: "ready", visibility: "private",
        archivedAt: { $exists: false },
      }, { session });
      if (!pdf) fail(404, "فقط PDF خصوصی، آماده و متعلق به شما قابل ارسال اختصاصی است");
      const course = await c("courses").findOne({
        _id: input.courseId, teacherId: teacher._id, status: "active",
      }, { session });
      if (!course) fail(404, "درس فعال یافت نشد");
      if (input.groupId) {
        const group = await c("classGroups").findOne({
          _id: input.groupId, teacherId: teacher._id, courseId: input.courseId,
        }, { session });
        if (!group) fail(404, "کلاس یافت نشد");
        if (group.studentIds.length !== input.studentIds.length ||
          input.studentIds.some((sid) => !group.studentIds.includes(sid)))
          fail(409, "برای ارسال به کلاس باید تمام اعضای آن انتخاب شوند؛ فهرست کلاس را به‌روزرسانی کنید");
      }
      const enrollments = await c("enrollments").find({
        teacherId: teacher._id, courseId: input.courseId,
        studentId: { $in: input.studentIds }, status: "active",
      }, { session }).toArray();
      if (enrollments.length !== input.studentIds.length)
        fail(409, "تمام دریافت‌کنندگان باید عضو فعال درس باشند");

      // Serialize delivery creation against deletion of the source PDF.
      const locked = await c("pdfLibrary").updateOne({
        _id: input.pdfId, ownerId: teacher._id, state: "ready", visibility: "private",
        archivedAt: { $exists: false },
      }, { $inc: { deliveryRevision: 1 } }, { session });
      if (!locked.modifiedCount) fail(409, "فایل PDF دیگر برای ارسال آماده نیست");
      const batchId = id();
      const createdAt = now();
      const base = {
        batchId, pdfId: input.pdfId, teacherId: teacher._id,
        courseId: input.courseId, ...(input.groupId ? { groupId: input.groupId } : {}),
        title: input.title, description: input.description,
        ...(input.dueAt ? { dueAt: input.dueAt } : {}), createdAt,
      };
      // Snapshot recipients; a changed class roster does not grant later access.
      const rows = input.studentIds.map((studentId) => ({
        _id: id(), ...base, studentId,
        enrollmentId: enrollments.find((e) => e.studentId === studentId)!._id,
        state: "assigned",
      }));
      await c("pdfDeliveries").insertMany(rows, { session });
      await c("auditLogs").insertOne({
        _id: id(), actorId: teacher._id, action: "send_pdf_assignment",
        resourceId: batchId, createdAt,
      }, { session });
      return { batchId, count: rows.length };
    });
  });

  app.get("/api/pdf-deliveries", async (r) => {
    const current = await user(r);
    if (!["teacher", "student", "super_admin"].includes(current.role))
      fail(403, "دسترسی مجاز نیست");
    const teacher = current.role !== "student";
    const rows = await c("pdfDeliveries").find(
      teacher ? { teacherId: current._id } : { studentId: current._id },
    ).sort({ createdAt: -1 }).limit(300).toArray();
    if (teacher) return rows;
    const enrollmentIds = [...new Set(rows.map((row) => row.enrollmentId))];
    const enrollments = await c("enrollments").find({
      _id: { $in: enrollmentIds }, studentId: current._id, status: "active",
    }).toArray();
    const permitted = new Set(enrollments.map((e) => e._id));
    const courses = await c("courses").find({
      _id: { $in: [...new Set(rows.map((row) => row.courseId))] }, status: "active",
    }).toArray();
    const activeCourses = new Set(courses.map((course) => course._id));
    return rows.filter((row) => permitted.has(row.enrollmentId) && activeCourses.has(row.courseId) && active(row));
  });

  async function accessible(r: Parameters<typeof user>[0]) {
    const current = await user(r);
    const { aid } = z.object({ aid: uuid }).parse(r.params);
    const row = await c("pdfDeliveries").findOne({ _id: aid, studentId: current._id });
    if (!row || !active(row)) fail(404, "تکلیف PDF یافت نشد");
    if (current.role !== "student") fail(403, "دسترسی مجاز نیست");
    const enrollment = await c("enrollments").findOne({
      _id: row.enrollmentId, courseId: row.courseId, teacherId: row.teacherId,
      studentId: current._id, status: "active",
    });
    const course = await c("courses").findOne({
      _id: row.courseId, teacherId: row.teacherId, status: "active",
    });
    if (!enrollment || !course) fail(404, "دسترسی به این تکلیف لغو شده است");
    return { row, current };
  }

  app.get("/api/pdf-deliveries/:aid/file", async (r, reply) => {
    const { row } = await accessible(r);
    const pdf = await c("pdfLibrary").findOne({
      _id: row.pdfId, ownerId: row.teacherId, state: "ready",
      archivedAt: { $exists: false },
    });
    if (!pdf) fail(404, "فایل PDF دیگر در دسترس نیست");
    const chunks = await c("pdfLibraryChunks").find({ pdfId: row.pdfId })
      .sort({ position: 1 }).toArray();
    if (!chunks.length) fail(404, "فایل PDF در دسترس نیست");
    const data = Buffer.concat(chunks.map((chunk) =>
      chunk.data instanceof Binary
        ? Buffer.from(chunk.data.value())
        : Buffer.from(chunk.data),
    ));
    if (createHash("sha256").update(data).digest("hex") !== pdf.file?.sha256)
      fail(503, "صحت فایل PDF تأیید نشد");
    // Record only successful requests for file bytes, not learning completion.
    const accessed = await c("pdfDeliveries").updateOne({
      _id: row._id, studentId: row.studentId,
      state: { $in: ["assigned", "completed"] },
      cancelledAt: { $exists: false },
    }, {
      $set: { lastFileAccessAt: now() },
      $inc: { fileAccessCount: 1 },
    });
    if (!accessed.modifiedCount) fail(404, "دسترسی به PDF لغو شده است");
    // Never mark a PDF assignment completed merely because it was downloaded.
    reply.header("Content-Type", "application/pdf")
      .header("Cache-Control", "private, no-store")
      .header("Content-Security-Policy", "sandbox")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Disposition", "inline; filename=\"assignment.pdf\"");
    return reply.send(data);
  });

  app.post("/api/pdf-deliveries/:aid/complete", async (r) => {
    const { row, current } = await accessible(r);
    return ctx.atomic(r, current._id, "complete-pdf-delivery:" + row._id, {}, async (session) => {
      const updated = await c("pdfDeliveries").updateOne({
        _id: row._id, studentId: current._id, state: "assigned",
        cancelledAt: { $exists: false },
      }, { $set: { state: "completed", completedAt: now() } }, { session });
      if (!updated.modifiedCount) {
        const latest = await c("pdfDeliveries").findOne({ _id: row._id, studentId: current._id }, { session });
        if (latest?.state !== "completed" || latest.cancelledAt)
          fail(409, "وضعیت تکلیف تغییر کرده است");
      }
      return { ok: true };
    });
  });

  app.post("/api/pdf-deliveries/:batchId/cancel", async (r) => {
    const teacher = await user(r, "teacher");
    const { batchId } = z.object({ batchId: uuid }).parse(r.params);
    return ctx.atomic(r, teacher._id, "cancel-pdf-delivery:" + batchId, {}, async (session) => {
      const exists = await c("pdfDeliveries").findOne({
        batchId, teacherId: teacher._id,
      }, { session });
      if (!exists) fail(404, "ارسال PDF یافت نشد");
      await c("pdfDeliveries").updateMany(
        { batchId, teacherId: teacher._id, state: { $ne: "cancelled" } },
        { $set: { state: "cancelled", cancelledAt: now() } }, { session },
      );
      return { ok: true };
    });
  });
}
