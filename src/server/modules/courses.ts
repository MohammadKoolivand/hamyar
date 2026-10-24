import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";

// A course is teacher-owned, unlike a private curriculum node whose kind may
// also be "course". An enrollment grants scoped teaching access for one course.
export function registerCourses(app: FastifyInstance, ctx: Context) {
  const { c, user, id, now, fail } = ctx;

  app.get("/api/courses", async (r) => {
    const u = await user(r);
    if (u.role === "teacher")
      return c("courses").find({ teacherId: u._id }).sort({ createdAt: -1 }).toArray();
    if (u.role !== "student") fail(403, "دسترسی مجاز نیست");
    const memberships = await c("enrollments")
      .find({ studentId: u._id, status: "active" })
      .toArray();
    return c("courses")
      .find({ _id: { $in: memberships.map((e) => e.courseId) }, status: "active" })
      .project({ _id: 1, teacherId: 1, title: 1, subject: 1, createdAt: 1, status: 1 })
      .toArray();
  });

  app.post("/api/courses", async (r) => {
    const teacher = await user(r, "teacher");
    const body = z.object({
      title: z.string().trim().min(2).max(120),
      subject: z.string().trim().min(2).max(100),
    }).parse(r.body);
    const row = {
      _id: id(),
      teacherId: teacher._id,
      title: body.title,
      subject: body.subject,
      status: "active",
      createdAt: now(),
    };
    await c("courses").insertOne(row);
    await ctx.audit(teacher._id, "create_course", row._id);
    return row;
  });

  app.get("/api/enrollments", async (r) => {
    const u = await user(r);
    if (u.role === "parent") fail(403, "دسترسی مجاز نیست");
    const query = u.role === "teacher"
      ? { teacherId: u._id, status: "active" }
      : { studentId: u._id, status: "active" };
    const rows = await c("enrollments").find(query).sort({ createdAt: -1 }).toArray();
    if (!rows.length) return [];
    const courses = await c("courses").find({
      _id: { $in: rows.map((e) => e.courseId) },
      status: "active",
    }).project({ _id: 1, teacherId: 1, title: 1, subject: 1 }).toArray();
    const allowed = new Map(courses.map((row) => [row._id, row]));
    const teacherIds = [...new Set(courses.map((row) => row.teacherId as string))];
    const teachers = u.role === "student"
      ? await c("users").find({ _id: { $in: teacherIds }, role: "teacher" })
        .project({ _id: 1, name: 1 }).toArray()
      : [];
    const names = new Map(teachers.map((t) => [t._id, t.name as string]));
    return rows.flatMap((row) => {
      const course = allowed.get(row.courseId);
      if (!course || course.teacherId !== row.teacherId) return [];
      return [{
        _id: row._id,
        teacherId: row.teacherId,
        studentId: row.studentId,
        courseId: row.courseId,
        status: row.status,
        createdAt: row.createdAt,
        courseTitle: course.title,
        subject: course.subject,
        ...(u.role === "student" ? { teacherName: names.get(row.teacherId) ?? "معلم" } : {}),
      }];
    });
  });
}
