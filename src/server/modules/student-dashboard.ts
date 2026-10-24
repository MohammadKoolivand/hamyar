import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import type { Row } from "../db";

// A student's own evidence-only dashboard. This is not a mastery score:
// completion and correctness are distinct measurements and unknown remains unknown.
export function registerStudentDashboard(app: FastifyInstance, ctx: Context) {
  app.get("/api/student/dashboard", async (request) => {
    const student = await ctx.user(request, "student");
    return ctx.transaction(async (session) => {
      const [enrollments, assignments] = await Promise.all([
        ctx.c("enrollments")
          .find({ studentId: student._id, status: "active" }, { session })
          .toArray(),
        ctx.c("assignments")
          .find({ studentId: student._id }, { session })
          .project({
            _id: 1, teacherId: 1, studentId: 1, courseId: 1,
            title: 1, state: 1, createdAt: 1, questionVersionIds: 1,
          })
          .toArray(),
      ]);
      const activeCourses = await ctx.c("courses").find({
        _id: { $in: enrollments.map((e) => e.courseId) },
        status: "active",
      }, { session }).project({
        _id: 1, teacherId: 1, title: 1, subject: 1,
      }).toArray();
      const valid = activeCourses.filter((course) =>
        enrollments.some((e) => e.courseId === course._id && e.teacherId === course.teacherId),
      );
      const teachers = await ctx.c("users").find({
        _id: { $in: [...new Set(valid.map((course) => course.teacherId))] },
        role: "teacher",
      }, { session }).project({ _id: 1, name: 1 }).toArray();
      const teacherNames = new Map(teachers.map((t) => [t._id, t.name as string]));
      const assignmentIds = assignments.map((a) => a._id);
      const attempts = assignmentIds.length
        ? await ctx.c("attempts").find({ assignmentId: { $in: assignmentIds } }, { session })
          .project({
            _id: 1, assignmentId: 1, questionVersionId: 1,
            sequence: 1, hintsUsed: 1,
          }).toArray()
        : [];
      const evaluations = attempts.length
        ? await ctx.c("evaluations").find({
          attemptId: { $in: attempts.map((a) => a._id) },
        }, { session }).project({ _id: 1, attemptId: 1, result: 1 }).toArray()
        : [];
      const latest = new Map<string, Row>();
      for (const attempt of attempts) {
        const key = attempt.assignmentId + ":" + attempt.questionVersionId;
        const prev = latest.get(key);
        if (!prev || attempt.sequence > prev.sequence) latest.set(key, attempt);
      }
      const evaluationsByAttempt = new Map(evaluations.map((e) => [e.attemptId, e]));

      function summarize(rows: Row[]) {
        const ids = new Set(rows.map((a) => a._id));
        const relevant = [...latest.values()].filter((a) => ids.has(a.assignmentId));
        let correctIndependent = 0, correctAssisted = 0, pendingReview = 0, evaluatedQuestions = 0;
        for (const attempt of relevant) {
          const evaluation = evaluationsByAttempt.get(attempt._id);
          if (!evaluation) continue;
          if (evaluation.result === "pending_review") {
            pendingReview += 1;
            continue;
          }
          if (!["correct", "incorrect", "partially_correct"].includes(evaluation.result)) continue;
          evaluatedQuestions += 1;
          if (evaluation.result === "correct") {
            if (attempt.hintsUsed === 0) correctIndependent += 1;
            else correctAssisted += 1;
          }
        }
        const missions = rows.map((a) => ({
          _id: a._id,
          title: a.title,
          state: a.state,
          courseId: a.courseId ?? null,
          createdAt: a.createdAt,
        })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return {
          assignments: rows.length,
          completed: rows.filter((a) => a.state === "completed").length,
          awaitingReview: rows.filter((a) => a.state === "submitted").length,
          inProgress: rows.filter((a) => ["published", "in_progress"].includes(a.state)).length,
          cancelled: rows.filter((a) => a.state === "cancelled").length,
          assignedQuestions: rows.reduce((n, a) => n + (a.questionVersionIds?.length ?? 0), 0),
          answeredQuestions: relevant.length,
          evaluatedQuestions,
          correctIndependent,
          correctAssisted,
          pendingReview,
          missions,
        };
      }
      const matched = new Set<string>();
      const courses = valid.map((course) => {
        const rows = assignments.filter((a) =>
          a.courseId === course._id && a.teacherId === course.teacherId,
        );
        for (const a of rows) matched.add(a._id);
        return {
          courseId: course._id,
          title: course.title,
          subject: course.subject,
          teacherName: teacherNames.get(course.teacherId) ?? "معلم",
          ...summarize(rows),
        };
      });
      // Legacy unscoped work is not assigned to an unrelated current course.
      const legacy = summarize(assignments.filter((a) => !matched.has(a._id)));
      const summary = summarize(assignments);
      return { summary: { ...summary, activeCourses: courses.length, missions: undefined }, courses, legacy };
    });
  });
}
