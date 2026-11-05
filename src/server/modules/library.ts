import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";

// Catalog publication is an explicit per-course teacher choice, never inferred
// from a question's presence in the private question bank or another mission.
const publicationInput = z.object({
  courseId: z.string().uuid(),
  published: z.boolean(),
}).strict();

export function registerLibrary(app: FastifyInstance, ctx: Context) {
  const { c, user, fail, id, now } = ctx;

  app.get("/api/questions/library-publications", async (request) => {
    const teacher = await user(request, "teacher");
    return c("libraryPublications")
      .find({ teacherId: teacher._id, published: true })
      .project({ _id: 0, questionVersionId: 1, courseId: 1 })
      .toArray();
  });

  app.post("/api/questions/:qid/library", async (request) => {
    const teacher = await user(request, "teacher");
    const qid = z.string().uuid().parse((request.params as { qid: string }).qid);
    const input = publicationInput.parse(request.body);
    const course = await c("courses").findOne({ _id: input.courseId, teacherId: teacher._id, status: "active" });
    const question = await c("questionVersions").findOne({ _id: qid, ownerId: teacher._id });
    if (!course || !question || !question.verifiedAt || typeof question.topicId !== "string") fail(404, "درس یا سؤال مبحثی تأییدشده یافت نشد");
    const current = await c("questions").findOne({ _id: question!.questionId, ownerId: teacher._id, currentVersionId: qid });
    if (!current) fail(409, "فقط نسخهٔ فعلی سؤال قابل انتشار است");
    const selector = { teacherId: teacher._id, courseId: input.courseId, questionVersionId: qid };
    if (input.published) {
      await c("libraryPublications").updateOne(selector, { $set: { ...selector, published: true, updatedAt: now() }, $setOnInsert: { _id: id() } }, { upsert: true });
    } else {
      await c("libraryPublications").updateMany(selector, { $set: { published: false, updatedAt: now() } });
    }
    await c("auditLogs").insertOne({ _id: id(), actorId: teacher._id, action: input.published ? "publish_library_question" : "unpublish_library_question", resourceId: qid, courseId: input.courseId, createdAt: now() });
    return { ok: true };
  });

  async function authorized(studentId: string) {
    const enrollments = await c("enrollments").find({ studentId, status: "active" }).project({ teacherId: 1, courseId: 1 }).toArray();
    if (!enrollments.length) return [];
    const courses = await c("courses").find({ _id: { $in: enrollments.map(e => e.courseId) }, status: "active" }).project({ _id: 1, teacherId: 1 }).toArray();
    const allowed = new Set(courses.filter(course => enrollments.some(e => e.courseId === course._id && e.teacherId === course.teacherId)).map(course => `${course.teacherId}:${course._id}`));
    if (!allowed.size) return [];
    const publications = await c("libraryPublications").find({ published: true, courseId: { $in: courses.map(c => c._id) } }).limit(2000).toArray();
    return publications.filter(p => allowed.has(`${p.teacherId}:${p.courseId}`));
  }

  app.get("/api/student/library", async (request) => {
    const student = await user(request, "student");
    const publications = await authorized(student._id);
    if (!publications.length) return { items: [], nodes: [] };
    const versions = await c("questionVersions").find({ _id: { $in: publications.map(p => p.questionVersionId) } })
      .project({ _id: 1, questionId: 1, ownerId: 1, topicId: 1, type: 1, source: 1, difficultyScore: 1, verifiedAt: 1 }).toArray();
    const current = await c("questions").find({ currentVersionId: { $in: versions.map(v => v._id) } }).project({ currentVersionId: 1, ownerId: 1 }).toArray();
    const currentIds = new Set(current.map(q => `${q.ownerId}:${q.currentVersionId}`));
    const visible = versions.filter(v => v.verifiedAt && currentIds.has(`${v.ownerId}:${v._id}`));
    const allNodes = visible.length ? await c("curriculum").find({ ownerId: { $in: [...new Set(visible.map(v => v.ownerId))] }, archivedAt: { $exists: false } })
      .project({ _id: 1, parentId: 1, kind: 1, title: 1, tracks: 1 }).toArray() : [];
    const byNodeId = new Map(allNodes.map(node => [node._id, node]));
    const visibleNodeIds = new Set<string>();
    for (const version of visible) {
      let node = byNodeId.get(version.topicId);
      const seen = new Set<string>();
      while (node && !seen.has(node._id)) {
        seen.add(node._id);
        visibleNodeIds.add(node._id);
        node = node.parentId ? byNodeId.get(node.parentId) : undefined;
      }
    }
    return {
      nodes: allNodes.filter(node => visibleNodeIds.has(node._id)),
      items: visible.flatMap(v => {
        if (typeof v.topicId !== "string") return [];
        const source = v.source as Record<string, unknown> | undefined;
        return [{
          questionId: v._id, topicId: v.topicId, type: v.type,
          courseIds: [...new Set(publications.filter(p => p.questionVersionId === v._id && p.teacherId === v.ownerId).map(p => p.courseId))],
          library: true,
          ...(typeof v.difficultyScore === "number" ? { difficultyScore: v.difficultyScore } : {}),
          ...(typeof source?.academicYear === "string" ? { academicYear: source.academicYear } : {}),
          ...(typeof source?.family === "string" ? { sourceCategory: source.family } : {}),
          ...(typeof source?.sourceTitle === "string" ? { resourceTitle: source.sourceTitle, examTitle: source.sourceTitle, resourceKey: `library:${v._id}`, examKey: `library:${v._id}` } : {}),
        }];
      }),
    };
  });

  app.post("/api/student/library/:qid/start", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (request) => {
    const student = await user(request, "student");
    const qid = z.string().uuid().parse((request.params as { qid: string }).qid);
    const input = z.object({ courseId: z.string().uuid() }).strict().parse(request.body);
    const publications = await authorized(student._id);
    const publication = publications.find(p => p.courseId === input.courseId && p.questionVersionId === qid);
    if (!publication) fail(404, "این سؤال در کتابخانهٔ درس شما موجود نیست");
    const question = await c("questionVersions").findOne({ _id: qid, ownerId: publication!.teacherId, verifiedAt: { $exists: true } });
    if (!question || !(await c("questions").findOne({ _id: question.questionId, currentVersionId: qid, ownerId: publication!.teacherId })))
      fail(404, "نسخهٔ سؤال دیگر منتشر نیست");
    return ctx.atomic(request, student._id, `library-start:${qid}:${input.courseId}`, input, async (session) => {
      const existing = await c("assignments").findOne({ studentId: student._id, libraryQuestionId: qid, courseId: input.courseId, state: { $in: ["published", "in_progress"] } }, { session });
      if (existing) return { assignmentId: existing._id };
      const assignmentId = id();
      await c("assignments").insertOne({
        _id: assignmentId, teacherId: publication!.teacherId, studentId: student._id,
        courseId: input.courseId, libraryQuestionId: qid, title: "تمرین انتخابی از کتابخانه",
        questionVersionIds: [qid], state: "published", createdAt: now(),
        policy: { feedbackMode: "immediate", maxAttempts: 3, maxHints: 2, independent: false, maxHintLevel: 3, allowFullSolution: false },
        progress: { [qid]: { attempts: 0, hints: 0 } }, revision: 0,
      }, { session });
      return { assignmentId };
    });
  });
}
