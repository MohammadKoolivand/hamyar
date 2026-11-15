import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Context } from "../context";
import { findPublicQuestionMatches, reservePublicQuestionFingerprint } from "../question-duplicates";

const uuid = z.string().uuid();
const licenseBasis = z.enum(["original", "licensed", "public_domain"]);
const submitSchema = z.object({
  versionId: uuid,
  licenseBasis,
  sourceReference: z.string().trim().min(3).max(500),
  rightsNote: z.string().trim().max(1000).default(""),
  consentToShare: z.literal(true),
}).strict();
const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), reason: z.string().trim().min(10).max(1000) }).strict(),
  z.object({ decision: z.literal("reject"), reason: z.string().trim().min(10).max(1000) }).strict(),
  z.object({ decision: z.literal("use_existing"), existingVersionId: uuid, reason: z.string().trim().min(10).max(1000) }).strict(),
]);

/** Human moderation of proposed public questions.
 * The teacher's original version always remains private until a separate
 * immutable public version is approved by the super administrator.
 */
export function registerPublicQuestionReview(app: FastifyInstance, ctx: Context) {
  const { c, fail, id, now } = ctx;
  app.get("/api/questions/publication-requests", async (r) => {
    const actor = await ctx.user(r, "teacher");
    return c("publicQuestionSubmissions").find({ ownerId: actor._id })
      .project({ _id: 1, versionId: 1, status: 1, sourceReference: 1,
        licenseBasis: 1, createdAt: 1, decidedAt: 1, decidedReason: 1,
        publishedVersionId: 1, existingVersionId: 1 })
      .sort({ createdAt: -1 }).limit(100).toArray();
  });

  app.post("/api/questions/:vid/propose-public", async (r) => {
    const actor = await ctx.user(r, "teacher");
    const { vid } = z.object({ vid: uuid }).parse(r.params);
    const input = submitSchema.parse(r.body);
    if (input.versionId !== vid) fail(400, "نسخه سؤال با درخواست همخوانی ندارد");
    return ctx.atomic(r, actor._id, "propose-public-question:" + vid, input, async (session) => {
      const question = await c("questionVersions").findOne({
        _id: vid, ownerId: actor._id, visibility: "private",
      }, { session });
      const current = question ? await c("questions").findOne({
        _id: question.questionId, ownerId: actor._id, currentVersionId: vid,
      }, { session }) : null;
      if (!question || !current) fail(404, "فقط نسخه خصوصی و فعلی سؤال خودتان قابل پیشنهاد است");
      const previous = await c("publicQuestionSubmissions").findOne({
        _id: question.questionId, ownerId: actor._id,
      }, { session });
      if (previous?.status === "pending" && previous.versionId === vid)
        return { questionId: question.questionId, status: "pending" };
      // Revisions create a new version; stale moderation requests cannot be approved.
      await c("publicQuestionSubmissions").updateOne(
        { _id: question.questionId },
        {
          $set: {
            ownerId: actor._id, versionId: vid, status: "pending",
            licenseBasis: input.licenseBasis, sourceReference: input.sourceReference,
            rightsNote: input.rightsNote, consentToShare: true, createdAt: now(),
          },
          $unset: { decidedAt: "", decidedBy: "", decidedReason: "",
            publishedVersionId: "", existingVersionId: "" },
        },
        { upsert: true, session },
      );
      await c("auditLogs").insertOne({
        _id: id(), actorId: actor._id, resourceId: question.questionId,
        action: "propose_public_question", createdAt: now(),
      }, { session });
      return { questionId: question.questionId, status: "pending" };
    });
  });

  // Reports identify public CURRENT versions only; no private source or answer is returned.
  app.post("/api/questions/:vid/report", {
    config: { rateLimit: { max: 12, timeWindow: "1 hour" } },
  }, async (r) => {
    const actor = await ctx.user(r);
    if (!["student", "teacher", "parent"].includes(actor.role))
      fail(403, "ارسال گزارش برای این نقش مجاز نیست");
    const { vid } = z.object({ vid: uuid }).parse(r.params);
    const input = z.object({
      category: z.enum(["wrong_answer", "typo", "duplicate", "copyright", "other"]),
      description: z.string().trim().min(10).max(1000),
    }).strict().parse(r.body);
    const version = await c("questionVersions").findOne({
      _id: vid, visibility: "public", verifiedAt: { $exists: true },
    });
    const question = version ? await c("questions").findOne({
      _id: version.questionId, ownerId: version.ownerId, currentVersionId: vid,
    }) : null;
    if (!version || !question) fail(404, "سؤال عمومی فعلی یافت نشد");
    return ctx.atomic(r, actor._id, "report-public-question:" + vid, input, async (session) => {
      const row = {
        _id: id(), versionId: vid, questionId: question._id, reporterId: actor._id,
        category: input.category, description: input.description,
        status: "pending", createdAt: now(),
      };
      await c("publicQuestionReports").insertOne(row, { session });
      return { reportId: row._id, status: "pending" };
    });
  });

  app.get("/api/admin/public-question-reports", async (r) => {
    await ctx.user(r, "super_admin");
    return c("publicQuestionReports").find({ status: "pending" })
      .project({ reporterId: 0 }).sort({ createdAt: 1 }).limit(100).toArray();
  });

  app.post("/api/admin/public-question-reports/:rid/resolve", async (r) => {
    const admin = await ctx.user(r, "super_admin");
    const { rid } = z.object({ rid: uuid }).parse(r.params);
    const input = z.object({
      decision: z.enum(["resolved", "dismissed"]),
      note: z.string().trim().min(10).max(1000),
    }).strict().parse(r.body);
    return ctx.atomic(r, admin._id, "review-public-question-report:" + rid, input, async (session) => {
      const updated = await c("publicQuestionReports").updateOne({
        _id: rid, status: "pending",
      }, { $set: {
        status: input.decision, note: input.note,
        reviewedAt: now(), reviewedBy: admin._id,
      } }, { session });
      if (!updated.modifiedCount) fail(409, "این گزارش قبلاً رسیدگی شده است");
      await c("auditLogs").insertOne({
        _id: id(), actorId: admin._id, action: "review_public_question_report",
        resourceId: rid, createdAt: now(),
      }, { session });
      return { status: input.decision };
    });
  });

  app.get("/api/admin/public-question-submissions", async (r, reply) => {
    await ctx.user(r, "super_admin");
    reply.header("Cache-Control", "private, no-store");
    const submissions = await c("publicQuestionSubmissions").find({ status: "pending" })
      .sort({ createdAt: 1 }).limit(100).toArray();
    const ids = submissions.map((item) => item.versionId);
    const versions = await c("questionVersions").find({ _id: { $in: ids } })
      .project({ _id: 1, statement: 1, type: 1, options: 1, source: 1 })
      .toArray();
    const byVersion = new Map(versions.map((v) => [v._id, v]));
    return submissions.map((submission) => ({
      questionId: submission._id, versionId: submission.versionId,
      ownerId: submission.ownerId, sourceReference: submission.sourceReference,
      licenseBasis: submission.licenseBasis, rightsNote: submission.rightsNote,
      createdAt: submission.createdAt,
      question: byVersion.get(submission.versionId) ?? null,
    }));
  });

  app.post("/api/admin/public-question-submissions/:qid/review", async (r) => {
    const admin = await ctx.user(r, "super_admin");
    const { qid } = z.object({ qid: uuid }).parse(r.params);
    const input = reviewSchema.parse(r.body);
    return ctx.atomic(r, admin._id, "review-public-question:" + qid, input, async (session) => {
      const submission = await c("publicQuestionSubmissions").findOne({
        _id: qid, status: "pending",
      }, { session });
      if (!submission) fail(409, "این درخواست قبلاً رسیدگی شده یا وجود ندارد");
      const prior = await c("questionVersions").findOne({
        _id: submission.versionId, ownerId: submission.ownerId, visibility: "private",
      }, { session });
      const current = prior ? await c("questions").findOne({
        _id: qid, ownerId: submission.ownerId, currentVersionId: prior._id,
      }, { session }) : null;
      if (!prior || !current) fail(409, "نسخه سؤال تغییر کرده است؛ معلم باید دوباره درخواست ثبت کند");
      const matches = await findPublicQuestionMatches(ctx, prior, session, qid);
      const duplicate = matches.find((item) => item.kind === "exact");
      if (input.decision === "approve" && duplicate)
        fail(409, "سؤال دقیقاً در بانک موجود است؛ از گزینه استفاده از سؤال موجود استفاده کنید");
      if (input.decision === "use_existing" &&
        !matches.some((item) => item.kind === "exact" && item.questionVersionId === input.existingVersionId))
        fail(409, "ارجاع تنها به نسخه عمومی فعلی و کاملاً یکسان مجاز است");

      let publishedVersionId: string | undefined;
      if (input.decision === "approve") {
        const fingerprint = await reservePublicQuestionFingerprint(
          ctx, prior, qid, submission.ownerId, session,
        );
        const nextVersionId = id();
        const updated = await c("questions").updateOne({
          _id: qid, ownerId: submission.ownerId, currentVersionId: prior._id,
        }, { $set: { currentVersionId: nextVersionId } }, { session });
        if (!updated.modifiedCount) fail(409, "نسخه سؤال در حین بررسی تغییر کرد");
        await c("questionVersions").insertOne({
          ...prior, _id: nextVersionId, version: (prior.version ?? 1) + 1,
          visibility: "public", verifiedBy: admin._id, verifiedAt: now(),
          revisedFromVersionId: prior._id,
          publicFingerprint: fingerprint, fingerprintVersion: 1,
          publicReview: { reviewerId: admin._id, reason: input.reason,
            licenseBasis: submission.licenseBasis,
            sourceReference: submission.sourceReference, at: now() },
        }, { session });
        publishedVersionId = nextVersionId;
      }
      const status = input.decision === "approve"
        ? "approved" : input.decision === "reject" ? "rejected" : "linked_existing";
      const updated = await c("publicQuestionSubmissions").updateOne({
        _id: qid, versionId: prior._id, status: "pending",
      }, {
        $set: {
          status, decidedAt: now(), decidedBy: admin._id, decidedReason: input.reason,
          ...(publishedVersionId ? { publishedVersionId } : {}),
          ...(input.decision === "use_existing" ? { existingVersionId: input.existingVersionId } : {}),
        },
      }, { session });
      if (!updated.modifiedCount) fail(409, "درخواست قبلاً بررسی شده است");
      if (input.decision === "use_existing") {
        await c("questionContributions").updateOne({
          _id: qid + ":" + input.existingVersionId,
        }, { $setOnInsert: {
          ownerId: submission.ownerId, questionId: qid,
          canonicalVersionId: input.existingVersionId,
          sourceReference: submission.sourceReference,
          licenseBasis: submission.licenseBasis,
          createdAt: now(),
        } }, { upsert: true, session });
      }
      await c("auditLogs").insertOne({
        _id: id(), actorId: admin._id, resourceId: qid,
        action: "review_public_question_" + status, createdAt: now(),
      }, { session });
      return { status, ...(publishedVersionId ? { publishedVersionId } : {}) };
    });
  });
}
