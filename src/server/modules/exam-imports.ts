import { imageToPdf } from "../imports/image-pdf";
import type { FastifyInstance } from "fastify";
import { Binary } from "mongodb";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Context } from "../context";
import {
  examImportSchema,
  examDraftSchema,
  MAX_PDF_BYTES,
} from "../../lib/exam-import";
import { enqueueExam, retentionDays, sourceBytes } from "../imports/jobs";
import { normalized } from "../imports/layout";
import { questionSchema } from "../domain";
import { persistQuestion, validateQuestion } from "./authoring";
const params = z.object({ eid: z.string().uuid() });
export function registerExamImports(app: FastifyInstance, ctx: Context) {
  const { c, id, now, owned, user, fail } = ctx;
  app.addContentTypeParser(
    ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    { parseAs: "buffer", bodyLimit: MAX_PDF_BYTES },
    (_r, body, done) => done(null, body),
  );
  const getExam = async (r: Parameters<typeof user>[0]) => {
    const u = await user(r, "teacher");
    const { eid } = params.parse(r.params);
    return { u, e: await owned("examImports", eid, u._id) };
  };
  app.get("/api/exam-imports", async (r) => {
    const u = await user(r, "teacher");
    return c("examImports")
      .find(
        { ownerId: u._id },
        { projection: { questionText: 0, answerText: 0 } },
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
  });
  app.post("/api/exam-imports", async (r) => {
    const u = await user(r, "teacher"),
      b = examImportSchema.parse(r.body);
    return ctx.atomic(r, u._id, "create-exam-import", b, async (session) => {
      const row = {
        _id: id(),
        ownerId: u._id,
        ...b,
        state: "collecting",
        revision: 0,
        createdAt: now(),
        files: {},
      };
      await c("examImports").insertOne(row, { session });
      return row;
    });
  });
  app.get("/api/exam-imports/:eid", async (r) => {
    const { e } = await getExam(r);
    return {
      ...e,
      job: e.jobId
        ? await c("examImportJobs").findOne(
            { _id: e.jobId, ownerId: e.ownerId },
            { projection: { leaseToken: 0 } },
          )
        : null,
      items: await c("examImportItems")
        .find({ examId: e._id })
        .sort({ createdAt: 1, _id: 1 })
        .toArray(),
    };
  });
  app.post(
    "/api/exam-imports/:eid/files/:kind",
    {
      bodyLimit: MAX_PDF_BYTES,
      onRequest: async (r) => {
        await getExam(r);
      },
    },
    async (r) => {
      const { u, e } = await getExam(r),
        kind = z
          .enum(["question", "answer"])
          .parse((r.params as { kind: string }).kind);
      let data = r.body;
      const imageUpload = /^image\/(png|jpeg|webp)(;|$)/i.test(
        String(r.headers["content-type"] ?? ""),
      );
      if (imageUpload) {
        if (
          !Buffer.isBuffer(data) ||
          !data.length ||
          data.length > MAX_PDF_BYTES
        )
          fail(400, "تصویر معتبر تا ۲۰ مگابایت لازم است");
        try {
          data = await imageToPdf(data as Buffer);
        } catch {
          return fail(
            400,
            "تصویر قابل پردازش نیست؛ PNG، JPEG یا WebP تک‌صفحه‌ای تا ۲۴ مگاپیکسل بارگذاری کنید",
          );
        }
      }
      if (
        !Buffer.isBuffer(data) ||
        data.length === 0 ||
        data.length > MAX_PDF_BYTES ||
        data.subarray(0, 5).toString() !== "%PDF-"
      )
        fail(400, "PDF غیرخالی معتبر تا ۲۰ مگابایت لازم است");
      let name: string;
      try {
        name = decodeURIComponent(
          String(r.headers["x-file-name"] ?? "document.pdf"),
        );
      } catch {
        return fail(400, "نام فایل معتبر نیست");
      }
      name = z.string().trim().min(1).max(200).parse(name);
      if (imageUpload) {
        if (!/\.(png|jpe?g|webp)$/i.test(name))
          fail(400, "پسوند تصویر معتبر نیست");
        name = name.replace(/\.(png|jpe?g|webp)$/i, ".pdf");
      }
      if (!/\.pdf$/i.test(name)) fail(400, "پسوند فایل باید PDF باشد");
      const buffer = data as Buffer,
        file = {
          name,
          id: ctx.hash(
            `${e._id}:${kind}:${createHash("sha256").update(buffer).digest("hex")}`,
          ),
          size: buffer.length,
          sha256: createHash("sha256").update(buffer).digest("hex"),
        };
      return ctx.atomic(
        r,
        u._id,
        `exam-file:${e._id}:${kind}`,
        file,
        async (session) => {
          const current = await c("examImports").findOne(
            { _id: e._id, ownerId: u._id },
            { session },
          );
          if (current?.state !== "collecting")
            fail(
              409,
              "پس از شروع بازبینی، تعویض فایل مجاز نیست؛ آزمون تازه بسازید",
            );
          await c("examImportChunks").deleteMany(
            { examId: e._id, kind },
            { session },
          );
          for (
            let offset = 0, position = 0;
            offset < buffer.length;
            offset += 256 * 1024, position++
          )
            await c("examImportChunks").insertOne(
              {
                _id: id(),
                examId: e._id,
                ownerId: u._id,
                kind,
                position,
                data: new Binary(buffer.subarray(offset, offset + 256 * 1024)),
                expiresAt: new Date(Date.now() + retentionDays() * 86400000),
              },
              { session },
            );
          await c("examImports").updateOne(
            { _id: e._id },
            {
              $set: {
                [`files.${kind}`]: file,
                sourceExpiresAt: new Date(
                  Date.now() + retentionDays() * 86400000,
                ),
              },
              $unset: { sourceDeletedAt: "" },
              $inc: { revision: 1 },
            },
            { session },
          );
          return file;
        },
      );
    },
  );
  app.delete("/api/exam-imports/:eid/files/:kind", async (r) => {
    const { e } = await getExam(r);
    const kind = z
      .enum(["question", "answer"])
      .parse((r.params as { kind: string }).kind);
    if (e.state !== "collecting")
      fail(409, "پس از شروع پردازش، تعویض فایل مجاز نیست");
    await ctx.transaction(async (session) => {
      await c("examImportChunks").deleteMany(
        { examId: e._id, kind },
        { session },
      );
      await c("examImports").updateOne(
        { _id: e._id },
        { $unset: { [`files.${kind}`]: "" }, $inc: { revision: 1 } },
        { session },
      );
    });
    return { deleted: true };
  });
  app.get("/api/exam-imports/:eid/files/:kind", async (r, reply) => {
    const { e } = await getExam(r),
      kind = z
        .enum(["question", "answer"])
        .parse((r.params as { kind: string }).kind),
      file = e.files?.[kind];
    if (!file) fail(404, "فایل یافت نشد");
    reply
      .header("Content-Type", "application/pdf")
      .header("X-Content-Type-Options", "nosniff")
      .header(
        "Content-Disposition",
        `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
    return reply
      .header("Cache-Control", "private, no-store")
      .send(await sourceBytes(ctx, e._id, kind));
  });
  app.post(
    "/api/exam-imports/:eid/extract",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (r) => {
      const { u, e } = await getExam(r);
      return enqueueExam(ctx, u._id, e._id);
    },
  );
  app.post("/api/exam-imports/:eid/manual-review", async (r) => {
    const { e } = await getExam(r);
    if (e.state !== "failed")
      fail(409, "فقط پردازش ناموفق به ورود دستی منتقل می‌شود");
    await c("examImports").updateOne(
      { _id: e._id, state: "failed" },
      {
        $set: {
          state: "review",
          extractionNotice:
            "پردازش خودکار ناموفق بود؛ حالت ورود دستی فعال است و هیچ سؤال استخراج‌شده‌ای ادعا نمی‌شود.",
        },
      },
    );
    return { state: "review" };
  });
  app.post("/api/exam-imports/:eid/retry", async (r) => {
    const { e } = await getExam(r);
    const job = await c("examImportJobs").findOne({
      _id: e.jobId,
      ownerId: e.ownerId,
    });
    if (!job || job.state !== "failed" || job.attempts >= 3)
      fail(409, "پردازش قابل تلاش مجدد نیست؛ حداکثر سه تلاش مجاز است");
    await c("examImportJobs").updateOne(
      { _id: job!._id, state: "failed" },
      { $set: { state: "queued", stage: "queued" } },
    );
    await c("examImports").updateOne(
      { _id: e._id },
      { $set: { state: "processing" } },
    );
    return { state: "queued" };
  });
  app.delete("/api/exam-imports/:eid/files", async (r) => {
    const { e } = await getExam(r);
    if (e.state === "processing") fail(409, "ابتدا پردازش باید پایان یابد");
    await ctx.transaction(async (session) => {
      for (const name of [
        "examImportChunks",
        "examImportPages",
        "examImportPreviewAssets",
      ])
        await c(name).deleteMany(
          { examId: e._id, ownerId: e.ownerId },
          { session },
        );
      await c("examImports").updateOne(
        { _id: e._id },
        { $set: { sourceDeletedAt: now() }, $inc: { revision: 1 } },
        { session },
      );
    });
    return { deleted: true };
  });
  app.get("/api/exam-imports/:eid/pages/:kind/:page", async (r, reply) => {
    const { e } = await getExam(r);
    const p = z
      .object({
        kind: z.enum(["question", "answer"]),
        page: z.coerce.number().int().min(1).max(100),
      })
      .parse(r.params);
    const row = await c("examImportPages").findOne({
      examId: e._id,
      kind: p.kind,
      page: p.page,
      expiresAt: { $gt: new Date() },
    });
    if (!row) fail(404, "تصویر منقضی یا حذف شده است");
    reply
      .header("Content-Type", "image/png")
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff");
    return reply.send(Buffer.from(row!.data.value()));
  });
  app.post("/api/exam-imports/:eid/items", async (r) => {
    const { u, e } = await getExam(r);
    const b = z
      .object({ statement: z.string().trim().min(3).max(5000) })
      .parse(r.body);
    return ctx.atomic(
      r,
      u._id,
      `add-exam-item:${e._id}`,
      b,
      async (session) => {
        const current = await c("examImports").findOne(
          { _id: e._id },
          { session },
        );
        if (current?.state !== "review")
          fail(409, "ابتدا مرحله پردازش را آغاز کنید");
        if (
          (await c("examImportItems").countDocuments(
            { examId: e._id },
            { session },
          )) >= 500
        )
          fail(400, "حداکثر ۵۰۰ پیش‌نویس برای هر آزمون مجاز است");
        // Serialize concurrent additions against the same exam's item limit.
        await c("examImports").updateOne(
          { _id: e._id },
          { $inc: { revision: 1 } },
          { session },
        );
        const row = {
          _id: id(),
          examId: e._id,
          ownerId: u._id,
          state: "pending",
          createdAt: now(),
          question: {
            statement: b.statement,
            reference: "",
            type: "essay",
            options: [],
            hints: [],
            classification: "free",
          },
        };
        await c("examImportItems").insertOne(row, { session });
        return row;
      },
    );
  });
  app.post("/api/exam-imports/:eid/approve-batch", async (r) => {
    const { u, e } = await getExam(r);
    const body = z
      .object({
        itemIds: z.array(z.uuid()).min(1).max(50),
        confirmed: z.literal(true),
      })
      .parse(r.body);
    const approved: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const iid of [...new Set(body.itemIds)]) {
      const item = await c("examImportItems").findOne({
        _id: iid,
        examId: e._id,
        ownerId: u._id,
      });
      if (item?.state === "approved") {
        approved.push(iid);
        continue;
      }
      if (
        !item ||
        item.state !== "pending" ||
        item.extraction?.answerMatch?.status !== "matched" ||
        item.question?.options?.length !== 4
      ) {
        failed.push({ id: iid, reason: "نیازمند بررسی تکی یا اصلاح کلید" });
        continue;
      }
      const result = await app.inject({
        method: "POST",
        url: `/api/exam-imports/${e._id}/items/${iid}/review`,
        headers: {
          cookie: r.headers.cookie ?? "",
          "idempotency-key": `batch-${r.id}-${iid}`,
        },
        payload: {
          action: "approve",
          confirmed: true,
          question: item.question,
          ...(item.originalNumber
            ? { originalNumber: item.originalNumber }
            : {}),
        },
      });
      if (result.statusCode === 200) approved.push(iid);
      else
        failed.push({ id: iid, reason: result.json().message ?? "تأیید نشد" });
    }
    return { approved, failed };
  });
  app.post("/api/exam-imports/:eid/items/:iid/review", async (r) => {
    const { u, e } = await getExam(r),
      iid = z
        .string()
        .uuid()
        .parse((r.params as { iid: string }).iid);
    const b = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("defer") }),
        z.object({
          action: z.literal("save"),
          question: examDraftSchema,
          originalNumber: z.number().int().min(1).max(10000).optional(),
        }),
        z.object({
          action: z.literal("approve"),
          confirmed: z.literal(true),
          originalNumber: z.number().int().min(1).max(10000).optional(),
          question: questionSchema,
        }),
        z.object({
          action: z.literal("reject"),
          reason: z.string().trim().min(3).max(500),
        }),
      ])
      .parse(r.body);
    if (b.action === "approve") {
      await validateQuestion(ctx, u._id, {
        ...b.question,
        visuals: b.question.visuals?.filter((v) => v.kind !== "image"),
      });
      for (const visual of b.question.visuals ?? [])
        if (visual.kind === "image") {
          const asset =
            (await c("questionAssets").findOne({
              _id: visual.assetId,
              ownerId: u._id,
            })) ??
            (await c("examImportPreviewAssets").findOne({
              _id: visual.assetId,
              ownerId: u._id,
              examId: e._id,
              expiresAt: { $gt: new Date() },
            }));
          if (!asset)
            fail(400, "تصویر منقضی یا نامعتبر است؛ تصویر را اصلاح یا حذف کنید");
        }
    }
    return ctx.atomic(
      r,
      u._id,
      `review-exam-item:${iid}`,
      b,
      async (session) => {
        const item = await c("examImportItems").findOne(
          { _id: iid, examId: e._id, ownerId: u._id },
          { session },
        );
        if (!item) fail(404, "پیش‌نویس یافت نشد");
        if (item!.state !== "pending")
          fail(409, "این پیش‌نویس قبلاً بررسی شده است");
        if (b.action === "defer") {
          await c("examImportItems").updateOne(
            { _id: iid },
            { $set: { deferred: true, updatedAt: now() } },
            { session },
          );
          return { state: "pending", deferred: true };
        }
        if (b.action === "save") {
          if (b.question.topicId) {
            const topic = await owned("curriculum", b.question.topicId, u._id);
            if (topic.kind !== "topic") fail(400, "مبحث معتبر نیست");
          }
          await c("examImportItems").updateOne(
            { _id: iid },
            {
              $set: {
                question: b.question,
                originalNumber: b.originalNumber ?? null,
                updatedAt: now(),
              },
            },
            { session },
          );
          return { state: "pending" };
        }
        if (b.action === "reject") {
          await c("examImportItems").updateOne(
            { _id: iid },
            {
              $set: { state: "rejected", reason: b.reason, reviewedAt: now() },
            },
            { session },
          );
          return { state: "rejected" };
        }
        const source = {
          ...e.source,
          sourceTitle: e.title,
          subject: e.subject,
          ...(e.grade ? { grade: e.grade } : {}),
          ...(e.track ? { track: e.track } : {}),
        };
        if (item!.extraction?.regions?.[0])
          source.sourcePage = item!.extraction.regions[0].page;
        delete source.questionNumber;
        if (b.originalNumber) source.questionNumber = b.originalNumber;
        const q = questionSchema.parse({
          ...b.question,
          source,
          ...(e.year ? { year: e.year } : {}),
        });
        const fingerprint = ctx.hash(
          JSON.stringify([normalized(q.statement), q.options.map(normalized)]),
        );
        const duplicate = await c("questionVersions").findOne(
          { ownerId: u._id, sourceImportFingerprint: fingerprint },
          { session },
        );
        if (duplicate)
          fail(
            409,
            "این سؤال قبلاً از آزمون به بانک وارد شده است؛ نسخه موجود را بررسی کنید",
          );
        for (const visual of q.visuals ?? [])
          if (visual.kind === "image") {
            const asset = await c("examImportPreviewAssets").findOne(
              {
                _id: visual.assetId,
                ownerId: u._id,
                examId: e._id,
                expiresAt: { $gt: new Date() },
              },
              { session },
            );
            if (
              asset &&
              !(await c("questionAssets").findOne(
                { _id: visual.assetId },
                { session },
              ))
            )
              await c("questionAssets").insertOne(
                {
                  _id: asset._id,
                  ownerId: u._id,
                  data: asset.data,
                  width: asset.width,
                  height: asset.height,
                  createdAt: now(),
                  sourceExamId: e._id,
                },
                { session },
              );
          }
        const row = await persistQuestion(ctx, u._id, q, session, {
          sourceImportFingerprint: fingerprint,
          sourceExtraction: item!.extraction ?? null,
          sourceFiles: e.files,
          sourceExamMetadata: {
            title: e.title,
            subject: e.subject,
            grade: e.grade ?? null,
            track: e.track ?? null,
            year: e.year ?? null,
            source: e.source,
          },
          origin: "exam_import_reviewed",
          sourceExamId: e._id,
          sourceExamItemId: iid,
        });
        await c("examImportItems").updateOne(
          { _id: iid },
          {
            $set: {
              state: "approved",
              question: q,
              questionVersionId: row._id,
              originalNumber: b.originalNumber ?? null,
              reviewedAt: now(),
            },
          },
          { session },
        );
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "approve_exam_question",
            resourceId: row._id,
            createdAt: now(),
          },
          { session },
        );
        return { state: "approved", questionVersionId: row._id };
      },
    );
  });
}
