import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Context } from "../context";
import { examMetadataSchema, extractedQuestionSchema } from "../../lib/exam-import";
import { questionSchema } from "../domain";
import { validateQuestion, persistQuestion } from "./authoring";

const parsedImport = z.object({
  metadata: examMetadataSchema,
  questions: z.array(extractedQuestionSchema).min(1).max(120),
  questionHash: z.string().regex(/^[a-f0-9]{64}$/),
  questionFile: z.string().min(1).max(180),
  questionPages: z.number().int().min(1).max(40),
  answerHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  answerFile: z.string().min(1).max(180).optional(),
  answerPreview: z.string().max(16000).default(""),
  warning: z.string().max(250).optional(),
}).strict();

function provenance(meta: z.infer<typeof examMetadataSchema>, number: number | null) {
  const base = {
    sourceTitle: meta.title,
    ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
    ...(number ? { questionNumber: number } : {}),
    ...(meta.session ? { session: meta.session } : {}),
  };
  if (meta.kind === "final") return {
    family: "school" as const, administration: "final" as const,
    ...(meta.year ? { academicYear: meta.year } : {}), ...base,
  };
  if (meta.kind === "coordinated") return {
    family: "school" as const, administration: "district" as const,
    ...(meta.year ? { academicYear: meta.year } : {}), ...base,
  };
  if (meta.kind === "school") return {
    family: "school" as const, administration: "internal" as const,
    ...(meta.year ? { academicYear: meta.year } : {}), ...base,
  };
  if (meta.kind === "konkur") return {
    family: "konkur" as const,
    ...(["mathematics", "experimental", "humanities"].includes(meta.track)
      ? { group: meta.track as "mathematics" | "experimental" | "humanities" } : {}),
    ...base,
  };
  return { family: "mock" as const, organizer: "منبع بارگذاری‌شده توسط معلم", ...base };
}

export function registerExams(app: FastifyInstance, ctx: Context) {
  app.post("/api/exams/import", {
    bodyLimit: 750000,
    config: { rateLimit: { max: 3, timeWindow: "1 minute" } },
  }, async (r) => {
    const user = await ctx.user(r, "teacher");
    const b = parsedImport.parse(r.body);
    return ctx.atomic(r, user._id, "import-exam", b, async (session) => {
      const examId = ctx.id();
      await ctx.c("exams").insertOne({
        _id: examId, ownerId: user._id, ...b.metadata,
        questionHash: b.questionHash, questionFile: b.questionFile,
        questionPages: b.questionPages,
        ...(b.answerHash ? { answerHash: b.answerHash, answerFile: b.answerFile } : {}),
        answerPreview: b.answerPreview,
        warning: b.warning ?? "",
        state: "pending_review", createdAt: ctx.now(),
      }, { session });
      const questions = b.questions.map((q) => ({
        _id: ctx.id(), examId, ownerId: user._id, state: "pending_review",
        statement: q.statement, number: q.number, page: q.page,
        confidence: q.confidence, createdAt: ctx.now(),
      }));
      await ctx.c("examQuestionDrafts").insertMany(questions, { session });
      return { examId, count: questions.length, warning: b.warning ?? "" };
    });
  });

  app.get("/api/exams", async (r) => {
    const u = await ctx.user(r, "teacher");
    return ctx.c("exams").find({ ownerId: u._id }, { projection: { answerPreview: 0 } })
      .sort({ createdAt: -1 }).limit(30).toArray();
  });
  app.get("/api/exams/:eid", async (r) => {
    const u = await ctx.user(r, "teacher");
    const { eid } = r.params as { eid: string };
    const exam = await ctx.owned("exams", eid, u._id);
    const questions = await ctx.c("examQuestionDrafts")
      .find({ examId: eid, ownerId: u._id }).sort({ page: 1, number: 1 }).toArray();
    return { exam, questions };
  });

  app.post("/api/exam-questions/:qid/approve", async (r) => {
    const u = await ctx.user(r, "teacher");
    const { qid } = r.params as { qid: string };
    const body = z.object({ question: questionSchema, confirmed: z.literal(true) }).parse(r.body);
    await validateQuestion(ctx, u._id, body.question);
    return ctx.atomic(r, u._id, "approve-exam-question:" + qid, body, async (session) => {
      const draft = await ctx.c("examQuestionDrafts").findOne({
        _id: qid, ownerId: u._id, state: "pending_review",
      }, { session });
      if (!draft) ctx.fail(409, "پیش‌نویس پیدا نشد یا قبلاً بررسی شده است.");
      const exam = await ctx.c("exams").findOne({ _id: draft!.examId, ownerId: u._id }, { session });
      if (!exam) ctx.fail(404, "آزمون در دسترس نیست");
      const meta = examMetadataSchema.parse({
        title: exam!.title, kind: exam!.kind, year: exam!.year,
        session: exam!.session, grade: exam!.grade, track: exam!.track,
        subject: exam!.subject, sourceUrl: exam!.sourceUrl,
      });
      const question = questionSchema.parse({
        ...body.question,
        source: provenance(meta, draft!.number as number | null),
        ...(meta.year ? { year: Number(meta.year) } : {}),
      });
      const approved = await persistQuestion(ctx, u._id, question, session, {
        origin: "exam_import_reviewed", examId: exam!._id, examQuestionDraftId: qid,
      });
      await ctx.c("examQuestionDrafts").updateOne(
        { _id: qid, ownerId: u._id, state: "pending_review" },
        { $set: { state: "approved", questionVersionId: approved._id, reviewedAt: ctx.now() } },
        { session },
      );
      await ctx.c("auditLogs").insertOne({
        _id: ctx.id(), actorId: u._id, action: "approve_exam_question",
        resourceId: qid, createdAt: ctx.now(),
      }, { session });
      return { ok: true, questionVersionId: approved._id };
    });
  });
  app.post("/api/exam-questions/:qid/reject", async (r) => {
    const u = await ctx.user(r, "teacher");
    const { qid } = r.params as { qid: string };
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(r.body);
    const change = await ctx.c("examQuestionDrafts").updateOne({
      _id: qid, ownerId: u._id, state: "pending_review",
    }, { $set: { state: "rejected", reason: body.reason, reviewedAt: ctx.now() } });
    if (!change.matchedCount) ctx.fail(404, "پیش‌نویس در دسترس نیست");
    return { ok: true };
  });
}
