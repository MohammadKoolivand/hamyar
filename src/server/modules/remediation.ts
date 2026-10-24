import type { FastifyInstance } from "fastify";
import type { ClientSession } from "mongodb";
import type { Context } from "../context";
import { z } from "zod";
import { policySchema } from "../domain";

// A teacher-approved, individual follow-up based on the student's *latest*
// verified result for each question. No AI generation or shared question bank.
export function registerRemediation(app: FastifyInstance, ctx: Context) {
  const { c, id, now, user, fail } = ctx;
  const uuid = z.string().uuid();
  const params = z.object({ sid: uuid });
  const scope = z.object({ courseId: uuid.optional() });

  async function candidates(
    teacherId: string, studentId: string, courseId: string | undefined,
    session: ClientSession,
  ) {
    const relation = await c("relations").findOne({
      teacherId, studentId,
    }, { session });
    if (!relation) fail(404, "دانش‌آموز یافت نشد");
    let enrollmentId: string | undefined;
    if (courseId) {
      const [course, enrollment] = await Promise.all([
        c("courses").findOne({
          _id: courseId, teacherId, status: "active",
        }, { session }),
        c("enrollments").findOne({
          courseId, teacherId, studentId, status: "active",
        }, { session }),
      ]);
      if (!course || !enrollment) fail(404, "عضویت معتبر در درس یافت نشد");
      enrollmentId = enrollment._id;
    }
    const assignments = await c("assignments").find({
      teacherId, studentId,
      ...(courseId ? { courseId } : { courseId: { $exists: false } }),
    }, { session }).project({ _id: 1 }).toArray();
    const assignmentIds = assignments.map((a) => a._id);
    if (!assignmentIds.length) return { enrollmentId, items: [] };
    const evidence = await c("learningEvidence").find({
      teacherId, studentId, assignmentId: { $in: assignmentIds },
    }, { session }).sort({ createdAt: -1, _id: -1 }).toArray();
    const latest = new Map<string, (typeof evidence)[number]>();
    for (const e of evidence) {
      if (!latest.has(e.questionVersionId)) latest.set(e.questionVersionId, e);
    }
    const missed = [...latest.values()].filter((e) =>
      e.verified === true &&
      ["incorrect", "partially_correct"].includes(e.result),
    );
    if (!missed.length) return { enrollmentId, items: [] };
    const versions = await c("questionVersions").find({
      _id: { $in: missed.map((e) => e.questionVersionId) },
      ownerId: teacherId,
    }, { session }).project({
      _id: 1, statement: 1, type: 1,
    }).toArray();
    const questions = new Map(versions.map((q) => [q._id, q]));
    return {
      enrollmentId,
      items: missed.flatMap((e) => {
        const q = questions.get(e.questionVersionId);
        if (!q) return [];
        return [{
          questionVersionId: q._id,
          statement: q.statement as string,
          type: q.type as string,
          lastResult: e.result as string,
        }];
      }).slice(0, 50),
    };
  }

  app.get("/api/students/:sid/remediation-candidates", async (r) => {
    const teacher = await user(r, "teacher");
    const { sid } = params.parse(r.params);
    const { courseId } = scope.parse(r.query);
    return ctx.transaction(async (session) => {
      const result = await candidates(teacher._id, sid, courseId, session);
      return { studentId: sid, courseId: courseId ?? null, items: result.items };
    });
  });

  app.post("/api/students/:sid/remediation-missions", async (r) => {
    const teacher = await user(r, "teacher");
    const { sid } = params.parse(r.params);
    const body = z.object({
      courseId: uuid.optional(),
      title: z.string().trim().min(3).max(150),
      questionVersionIds: z.array(uuid).min(1).max(10)
        .refine((items) => new Set(items).size === items.length),
      policy: policySchema,
    }).parse(r.body);
    if (body.policy.independent && body.policy.maxHints !== 0)
      fail(400, "در سنجش مستقل راهنمایی مجاز نیست");
    return ctx.atomic(r, teacher._id, "remediation:" + sid, body, async (session) => {
      const { items, enrollmentId } = await candidates(
        teacher._id, sid, body.courseId, session,
      );
      const allowed = new Set(items.map((q) => q.questionVersionId));
      if (body.questionVersionIds.some((q) => !allowed.has(q)))
        fail(409, "این سؤال دیگر نیازمند تمرین تقویتی معتبر نیست");
      const missionId = id(), assignmentId = id();
      const stamp = now();
      const base = {
        teacherId: teacher._id, studentId: sid,
        ...(body.courseId ? { courseId: body.courseId, enrollmentId } : {}),
        title: body.title, questionVersionIds: body.questionVersionIds,
        policy: body.policy,
        remediation: true,
      };
      await c("missions").insertOne({
        _id: missionId, ...base, state: "published", createdAt: stamp,
      }, { session });
      await c("assignments").insertOne({
        _id: assignmentId, missionId, ...base,
        state: "published", createdAt: stamp, revision: 0,
        progress: Object.fromEntries(body.questionVersionIds.map((q) =>
          [q, { attempts: 0, hints: 0 }])),
      }, { session });
      await ctx.boundary("after_remediation_assignment_insert");
      await c("auditLogs").insertOne({
        _id: id(), actorId: teacher._id, action: "publish_individual_remediation",
        resourceId: missionId, createdAt: stamp,
      }, { session });
      return { missionId, assignmentId, studentId: sid, published: true };
    });
  });
}
