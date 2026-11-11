import { randomInt } from "node:crypto";
import sharp from "sharp";
import { difficultySchema } from "../../lib/difficulty";
import {
  empiricalDifficultyScore,
  difficultyBucket,
} from "../../lib/difficulty";
import { MAX_MISSION_QUESTIONS } from "../../lib/mission-limits";
import { difficultyMetadata } from "../../lib/difficulty";
import { Binary } from "mongodb";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { persistQuestion, validateQuestion } from "./authoring";
import {
  curriculumCatalog,
  importCatalog,
  trackLabels,
} from "../curriculum-catalog";
import { questionSchema } from "../domain";
import { assertActiveAssignmentCourse } from "../course-access";
import { assertLibraryAssignmentAccess } from "../library-access";
export function registerContent(app: FastifyInstance, ctx: Context) {
  const { c, user, owned, id } = ctx;
  app.post(
    "/api/question-assets",
    { bodyLimit: 5 * 1024 * 1024 },
    async (r) => {
      const u = await user(r, "teacher");
      if (
        !Buffer.isBuffer(r.body) ||
        !r.body.length ||
        r.body.length > 5 * 1024 * 1024
      )
        ctx.fail(400, "تصویر معتبر انتخاب کنید؛ حداکثر ۵ مگابایت");
      let image;
      try {
        image = await sharp(r.body as Buffer, { limitInputPixels: 12_000_000 })
          .rotate()
          .resize({
            width: 4096,
            height: 4096,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer({ resolveWithObject: true });
      } catch {
        return ctx.fail(400, "فایل تصویر قابل خواندن نیست");
      }
      const assetId = id();
      await c("questionAssets").insertOne({
        _id: assetId,
        ownerId: u._id,
        data: new Binary(image.data),
        width: image.info.width,
        height: image.info.height,
        createdAt: ctx.now(),
      });
      return {
        kind: "image",
        assetId,
        width: image.info.width,
        height: image.info.height,
        caption: "تصویر سؤال",
      };
    },
  );
  app.get("/api/question-assets/:assetId", async (r, reply) => {
    const u = await user(r),
      assetId = z
        .string()
        .uuid()
        .parse((r.params as { assetId: string }).assetId);
    if (
      !["teacher", "super_admin", "secretary", "student", "parent"].includes(
        u.role,
      )
    )
      ctx.fail(403, "دسترسی مجاز نیست");
    const asset = await c("questionAssets").findOne({
      _id: assetId,
      ...(["teacher", "super_admin", "secretary"].includes(u.role)
        ? { ownerId: u._id }
        : {}),
    });
    const preview =
      !asset && ["teacher", "super_admin", "secretary"].includes(u.role)
        ? await c("examImportPreviewAssets").findOne({
            _id: assetId,
            ownerId: u._id,
            expiresAt: { $gt: new Date() },
          })
        : null;
    const imageAsset = asset ?? preview;
    if (!imageAsset) ctx.fail(404, "تصویر یافت نشد");
    if (u.role === "student" || u.role === "parent") {
      const versions = await c("questionVersions")
        .find(
          {
            ownerId: imageAsset!.ownerId,
            visuals: { $elemMatch: { kind: "image", assetId } },
          },
          { projection: { _id: 1 } },
        )
        .toArray();
      const links =
        u.role === "parent"
          ? await c("parentLinks").find({ parentId: u._id }).toArray()
          : [];
      const candidates = await c("assignments")
        .find({
          ...(u.role === "student"
            ? { studentId: u._id, teacherId: imageAsset!.ownerId }
            : {
                $or: links.length
                  ? links.map((l) => ({
                      studentId: l.studentId,
                      teacherId: l.teacherId,
                    }))
                  : [{ studentId: "no-authorized-child" }],
              }),
          questionVersionIds: { $in: versions.map((v) => v._id) },
          state: { $ne: "cancelled" },
        })
        .toArray();
      let permitted = false;
      for (const candidate of candidates) {
        try {
          await assertActiveAssignmentCourse(
            ctx,
            candidate,
            candidate.studentId,
          );
          await assertLibraryAssignmentAccess(
            ctx,
            candidate,
            candidate.studentId,
          );
          permitted = true;
          break;
        } catch (error) {
          if ((error as { statusCode?: number }).statusCode !== 404)
            throw error;
        }
      }
      if (!permitted) ctx.fail(404, "تصویر یافت نشد");
    }
    reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff");
    return reply.send(
      imageAsset!.data instanceof Binary
        ? Buffer.from(imageAsset!.data.value())
        : Buffer.from(imageAsset!.data),
    );
  });
  app.get("/api/curriculum/catalog", async (r) => {
    await user(r, "teacher");
    return {
      ...curriculumCatalog,
      trackLabels,
      notice:
        "فهرست فصل‌ها و درس‌ها با ۳۱ PDF رسمی سال ۱۴۰۵–۱۴۰۶ بررسی شده است؛ ۱۹ کتاب ریاضی و فیزیک متوسطه دوم هم تطبیق داده شده‌اند. علوم متوسطه اول فعلاً در سطح کل فصل است. کتاب‌های تکمیلی سمپاد جدا هستند. این تأیید مربوط به سرفصل‌هاست، نه بانک سؤال یا خروجی هوش مصنوعی.",
    };
  });
  app.post("/api/curriculum/catalog/import", async (r) => {
    const u = await user(r, "teacher"),
      b = z
        .object({
          bookIds: z
            .array(z.string())
            .min(1)
            .max(curriculumCatalog.books.length),
        })
        .parse(r.body);
    const ids = [...new Set(b.bookIds)];
    if (
      ids.some((id) => !curriculumCatalog.books.some((book) => book.id === id))
    )
      ctx.fail(400, "کتاب معتبر نیست");
    return ctx.atomic(
      r,
      u._id,
      "curriculum-import",
      { bookIds: ids },
      async (session) => {
        const result = await importCatalog(ctx, u._id, ids, session);
        await ctx.boundary("after_catalog_import");
        await ctx.c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "import_curriculum_catalog",
            resourceId: curriculumCatalog.version,
            createdAt: ctx.now(),
          },
          { session },
        );
        return result;
      },
    );
  });
  app.get("/api/curriculum", async (r) => {
    const u = await user(r, "teacher");
    return c("curriculum")
      .find({ ownerId: u._id, archivedAt: { $exists: false } })
      .toArray();
  });
  app.post("/api/curriculum/:nodeId/remove", async (r) => {
    const u = await user(r, "teacher");
    const nodeId = z
      .string()
      .uuid()
      .parse((r.params as { nodeId: string }).nodeId);
    return ctx.atomic(
      r,
      u._id,
      "curriculum-remove",
      { nodeId },
      async (session) => {
        const rows = await c("curriculum")
          .find({ ownerId: u._id }, { session })
          .toArray();
        if (!rows.some((row) => row._id === nodeId))
          ctx.fail(404, "منبع یافت نشد");
        const ids = new Set([nodeId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const row of rows) {
            if (row.parentId && ids.has(row.parentId) && !ids.has(row._id)) {
              ids.add(row._id);
              changed = true;
            }
          }
        }
        const result = await c("curriculum").updateMany(
          {
            ownerId: u._id,
            _id: { $in: [...ids] },
            archivedAt: { $exists: false },
          },
          { $set: { archivedAt: ctx.now() } },
          { session },
        );
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "remove_curriculum",
            resourceId: nodeId,
            count: result.modifiedCount,
            createdAt: ctx.now(),
          },
          { session },
        );
        return { removed: result.modifiedCount };
      },
    );
  });
  app.post("/api/curriculum/:nodeId/update", async (r) => {
    const u = await user(r, "teacher");
    const nodeId = z
      .string()
      .uuid()
      .parse((r.params as { nodeId: string }).nodeId);
    const b = z
      .object({ title: z.string().trim().min(1).max(150) })
      .strict()
      .parse(r.body);
    return ctx.atomic(
      r,
      u._id,
      "curriculum-update",
      { nodeId, ...b },
      async (session) => {
        const existing = await c("curriculum").findOne(
          { _id: nodeId, ownerId: u._id, archivedAt: { $exists: false } },
          { session },
        );
        if (!existing) ctx.fail(404, "سرفصل یافت نشد");
        await c("curriculum").updateOne(
          { _id: nodeId, ownerId: u._id },
          { $set: { title: b.title, updatedAt: ctx.now() } },
          { session },
        );
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "update_curriculum",
            resourceId: nodeId,
            previousTitle: existing!.title,
            title: b.title,
            createdAt: ctx.now(),
          },
          { session },
        );
        return { ...existing, title: b.title };
      },
    );
  });
  app.post("/api/curriculum", async (r) => {
    const u = await user(r, "teacher"),
      b = z
        .object({
          title: z.string().min(1).max(150),
          kind: z.enum([
            "system",
            "level",
            "grade",
            "subject",
            "course",
            "chapter",
            "topic",
            "skill",
            "objective",
          ]),
          parentId: z.string().uuid().optional(),
        })
        .parse(r.body);
    if (b.parentId) await owned("curriculum", b.parentId, u._id);
    const row = { _id: id(), ownerId: u._id, ...b };
    await c("curriculum").insertOne(row);
    return row;
  });
  app.get("/api/questions", async (r) => {
    const u = await user(r, "teacher");
    const questions = await c("questions")
      .aggregate([
        { $match: { ownerId: u._id } },
        {
          $lookup: {
            from: "questionVersions",
            localField: "currentVersionId",
            foreignField: "_id",
            as: "version",
          },
        },
        { $unwind: "$version" },
        { $replaceRoot: { newRoot: "$version" } },
      ])
      .toArray();
    const examIds = questions
      .filter(
        (q) =>
          q.origin === "exam_import_reviewed" ||
          q.originalOrigin === "exam_import_reviewed",
      )
      .map((q) => q._id as string);
    if (!examIds.length) return questions;
    const examIdSet = new Set(examIds);
    const stats = await c("questionDifficultyResponses")
      .aggregate([
        { $match: { questionVersionId: { $in: examIds } } },
        {
          $group: {
            _id: "$questionVersionId",
            correct: {
              $sum: { $cond: [{ $eq: ["$result", "correct"] }, 1, 0] },
            },
            incorrect: {
              $sum: { $cond: [{ $eq: ["$result", "incorrect"] }, 1, 0] },
            },
          },
        },
      ])
      .toArray();
    const byQuestion = new Map(stats.map((row) => [row._id as string, row]));
    return questions.map((question) => {
      if (!examIdSet.has(question._id as string)) return question;
      const row = byQuestion.get(question._id as string),
        correct = Number(row?.correct ?? 0),
        incorrect = Number(row?.incorrect ?? 0),
        participants = correct + incorrect,
        score = empiricalDifficultyScore(correct, incorrect);
      return {
        ...question,
        difficulty: score === null ? undefined : difficultyBucket(score),
        difficultyScore: score,
        difficultyResponses: { correct, incorrect, participants },
        difficultyAssessment: {
          method: "student_response_ratio",
          needsReview: false,
        },
      };
    });
  });
  app.post("/api/questions/select", async (r) => {
    const u = await user(r, "teacher");
    const quotaSchema = z.object({
      easy: z.number().int().min(0).max(MAX_MISSION_QUESTIONS),
      medium: z.number().int().min(0).max(MAX_MISSION_QUESTIONS),
      hard: z.number().int().min(0).max(MAX_MISSION_QUESTIONS),
    });
    const b = z
      .union([
        z.object({
          candidateIds: z.array(z.uuid()).min(1).max(5000),
          difficulty: difficultySchema,
          count: z.number().int().min(1).max(MAX_MISSION_QUESTIONS),
        }),
        z.object({
          candidateIds: z.array(z.uuid()).min(1).max(5000),
          quotas: quotaSchema,
        }),
      ])
      .parse(r.body);
    const quotas =
      "quotas" in b
        ? b.quotas
        : { easy: 0, medium: 0, hard: 0, [b.difficulty]: b.count };
    const total = Object.values(quotas).reduce((a, b) => a + b, 0);
    if (!total || total > MAX_MISSION_QUESTIONS)
      ctx.fail(400, `مجموع تعداد باید بین ۱ و ${MAX_MISSION_QUESTIONS} باشد`);
    const current = await c("questions")
      .find({ ownerId: u._id, currentVersionId: { $in: b.candidateIds } })
      .project({ currentVersionId: 1 })
      .toArray();
    const candidates = await c("questionVersions")
      .find({
        ownerId: u._id,
        _id: { $in: current.map((q) => q.currentVersionId) },
      })
      .project({ _id: 1, difficulty: 1, origin: 1, originalOrigin: 1 })
      .toArray();
    const examCandidates = candidates.filter(
      (q) =>
        q.origin === "exam_import_reviewed" ||
        q.originalOrigin === "exam_import_reviewed",
    );
    if (examCandidates.length) {
      const stats = await c("questionDifficultyResponses")
        .aggregate([
          {
            $match: {
              questionVersionId: { $in: examCandidates.map((q) => q._id) },
            },
          },
          {
            $group: {
              _id: "$questionVersionId",
              correct: {
                $sum: { $cond: [{ $eq: ["$result", "correct"] }, 1, 0] },
              },
              incorrect: {
                $sum: { $cond: [{ $eq: ["$result", "incorrect"] }, 1, 0] },
              },
            },
          },
        ])
        .toArray();
      const byQuestion = new Map(stats.map((row) => [row._id as string, row]));
      for (const question of examCandidates) {
        const row = byQuestion.get(question._id as string),
          score = empiricalDifficultyScore(
            Number(row?.correct ?? 0),
            Number(row?.incorrect ?? 0),
          );
        question.difficulty =
          score === null ? undefined : difficultyBucket(score);
      }
    }
    const picked: string[] = [];
    for (const [difficulty, count] of Object.entries(quotas)) {
      const pool = candidates.filter((q) => q.difficulty === difficulty);
      if (pool.length < count)
        ctx.fail(
          400,
          `فقط ${pool.length} سؤال ${difficulty === "easy" ? "آسان" : difficulty === "hard" ? "سخت" : "متوسط"} با فیلترهای فعلی موجود است؛ تعداد درخواستی ${count} است.`,
        );
      for (let i = pool.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      picked.push(...pool.slice(0, count).map((q) => q._id));
    }
    return { questionVersionIds: picked, available: candidates.length };
  });
  app.post("/api/questions/difficulty-batch", async (r) => {
    const u = await user(r, "teacher");
    const b = z
      .object({
        questionVersionIds: z.array(z.uuid()).min(1).max(500),
        difficulty: difficultySchema,
      })
      .parse(r.body);
    const ids = [...new Set(b.questionVersionIds)];
    return ctx.atomic(
      r,
      u._id,
      "question-difficulty-batch",
      b,
      async (session) => {
        const rows = await c("questionVersions")
          .find({ _id: { $in: ids }, ownerId: u._id }, { session })
          .project({ origin: 1, originalOrigin: 1 })
          .toArray();
        if (rows.length !== ids.length)
          ctx.fail(404, "سؤال متعلق به شما نیست یا یافت نشد");
        if (
          rows.some(
            (q) =>
              q.origin === "exam_import_reviewed" ||
              q.originalOrigin === "exam_import_reviewed",
          )
        )
          ctx.fail(
            409,
            "سختی سؤال‌های آزمون از پاسخ واقعی دانش‌آموزان محاسبه می‌شود و دستی تغییر نمی‌کند.",
          );
        await c("questionVersions").updateMany(
          { _id: { $in: ids }, ownerId: u._id },
          {
            $set: {
              difficulty: b.difficulty,
              difficultyAssessment: {
                method: "teacher_selected",
                needsReview: false,
                assessedAt: ctx.now(),
                assessedBy: u._id,
              },
            },
          },
          { session },
        );
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "set_question_difficulty",
            resourceIds: ids,
            difficulty: b.difficulty,
            createdAt: ctx.now(),
          },
          { session },
        );
        return { updated: ids.length };
      },
    );
  });
  app.get("/api/questions/:vid", async (r) => {
    const u = await user(r, "teacher");
    const question = await owned(
      "questionVersions",
      (r.params as { vid: string }).vid,
      u._id,
    );
    if (
      question.origin === "exam_import_reviewed" ||
      question.originalOrigin === "exam_import_reviewed"
    ) {
      const examQuestion = { ...question };
      delete examQuestion.difficulty;
      return {
        ...examQuestion,
        difficultyAssessment: {
          method: "student_response_ratio",
          needsReview: false,
        },
      };
    }
    return question;
  });
  app.post("/api/questions/:vid/revise", async (r) => {
    const u = await user(r, "teacher"),
      vid = (r.params as { vid: string }).vid,
      b = questionSchema.parse(r.body);
    if (
      b.type === "choice" &&
      new Set(b.options.map((o) => o.trim())).size !== b.options.length
    )
      ctx.fail(400, "گزینه‌های تکراری را اصلاح کنید");
    await validateQuestion(ctx, u._id, b);
    return ctx.atomic(
      r,
      u._id,
      `revise-question:${vid}`,
      b,
      async (session) => {
        const previous = await c("questionVersions").findOne(
          { _id: vid, ownerId: u._id },
          { session },
        );
        if (!previous) ctx.fail(404, "سؤال یافت نشد");
        const nextId = id();
        const updated = await c("questions").updateOne(
          { _id: previous!.questionId, ownerId: u._id, currentVersionId: vid },
          { $set: { currentVersionId: nextId } },
          { session },
        );
        if (!updated.matchedCount)
          ctx.fail(
            409,
            "سؤال قبلاً ویرایش شده؛ صفحه را تازه کنید و دوباره تلاش کنید.",
          );
        // Whitelisted provenance: the previous immutable version retains original review evidence.
        const examImported =
          previous!.origin === "exam_import_reviewed" ||
          previous!.originalOrigin === "exam_import_reviewed";
        const questionFields = {
          ...b,
          visibility: b.visibility ?? previous!.visibility ?? "private",
        };
        if (examImported) delete questionFields.difficulty;
        const row = {
          ...questionFields,
          ...(examImported
            ? {
                difficultyAssessment: {
                  method: "student_response_ratio",
                  needsReview: false,
                },
              }
            : difficultyMetadata(b)),
          _id: nextId,
          questionId: previous!.questionId,
          ownerId: u._id,
          version: previous!.version + 1,
          verifiedBy: u._id,
          verifiedAt: ctx.now(),
          origin: "human_revised",
          revisedFromVersionId: vid,
          originalOrigin: previous!.originalOrigin ?? previous!.origin,
          ...(previous!.sourceExamId
            ? {
                sourceExamId: previous!.sourceExamId,
                sourceExamItemId: previous!.sourceExamItemId,
              }
            : {}),
        };
        await c("questionVersions").insertOne(row, { session });
        await ctx.boundary("after_question_version_insert");
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "revise_question",
            resourceId: nextId,
            previousVersionId: vid,
            createdAt: ctx.now(),
          },
          { session },
        );
        return row;
      },
    );
  });
  app.post("/api/questions", async (r) => {
    const u = await user(r, "teacher"),
      b = questionSchema.parse(r.body);
    await validateQuestion(ctx, u._id, b);
    return ctx.atomic(r, u._id, "create-question", b, (session) =>
      persistQuestion(ctx, u._id, b, session),
    );
  });
}
