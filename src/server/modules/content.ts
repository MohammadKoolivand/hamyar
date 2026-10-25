import { randomInt } from "node:crypto";
import { difficultySchema } from "../../lib/difficulty";
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
export function registerContent(app: FastifyInstance, ctx: Context) {
  const { c, user, owned, id } = ctx;
  app.get("/api/question-assets/:assetId", async (r, reply) => {
    const u = await user(r),
      assetId = z
        .string()
        .uuid()
        .parse((r.params as { assetId: string }).assetId);
    if (!["teacher", "student"].includes(u.role))
      ctx.fail(403, "دسترسی مجاز نیست");
    const asset = await c("questionAssets").findOne({
      _id: assetId,
      ...(u.role === "teacher" ? { ownerId: u._id } : {}),
    });
    const preview =
      !asset && u.role === "teacher"
        ? await c("examImportPreviewAssets").findOne({
            _id: assetId,
            ownerId: u._id,
            expiresAt: { $gt: new Date() },
          })
        : null;
    const imageAsset = asset ?? preview;
    if (!imageAsset) ctx.fail(404, "تصویر یافت نشد");
    if (u.role === "student") {
      const versions = await c("questionVersions")
        .find(
          { visuals: { $elemMatch: { kind: "image", assetId } } },
          { projection: { _id: 1 } },
        )
        .toArray();
      if (
        !(await c("assignments").findOne({
          studentId: u._id,
          questionVersionIds: { $in: versions.map((v) => v._id) },
          state: { $ne: "cancelled" },
        }))
      )
        ctx.fail(404, "تصویر یافت نشد");
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
    return c("curriculum").find({ ownerId: u._id }).toArray();
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
    return c("questions")
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
  });
  app.post("/api/questions/select", async (r) => {
    const u = await user(r, "teacher");
    const b = z
      .object({
        candidateIds: z.array(z.uuid()).min(1).max(5000),
        difficulty: difficultySchema,
        count: z.number().int().min(1).max(MAX_MISSION_QUESTIONS),
      })
      .parse(r.body);
    const current = await c("questions")
      .find({ ownerId: u._id, currentVersionId: { $in: b.candidateIds } })
      .project({ currentVersionId: 1 })
      .toArray();
    const candidates = await c("questionVersions")
      .find({
        ownerId: u._id,
        _id: { $in: current.map((q) => q.currentVersionId) },
        difficulty: b.difficulty,
      })
      .project({ _id: 1 })
      .toArray();
    if (candidates.length < b.count)
      ctx.fail(
        400,
        `فقط ${candidates.length} سؤال با این سختی و فیلترها موجود است؛ تعداد درخواستی را کم کنید.`,
      );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return {
      questionVersionIds: candidates.slice(0, b.count).map((q) => q._id),
      available: candidates.length,
    };
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
        const rows = await c("questionVersions").countDocuments(
          { _id: { $in: ids }, ownerId: u._id },
          { session },
        );
        if (rows !== ids.length)
          ctx.fail(404, "سؤال متعلق به شما نیست یا یافت نشد");
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
    return owned("questionVersions", (r.params as { vid: string }).vid, u._id);
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
        const row = {
          ...b,
          ...difficultyMetadata(b),
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
