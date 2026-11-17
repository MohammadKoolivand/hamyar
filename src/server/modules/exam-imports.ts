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
import { calculateExamProgress, estimateLegacyQuestionCount } from "../../lib/exam-import-progress";
import { validExamCoverageId } from "../../lib/exam-catalog";
import { questionSchema } from "../domain";
import { persistQuestion, validateQuestion } from "./authoring";
const params = z.object({ eid: z.string().uuid() });
export function registerExamImports(app: FastifyInstance, ctx: Context) {
  const { c, id, now, owned, user, fail } = ctx;
  app.addContentTypeParser(
    ["application/pdf", "application/octet-stream", "image/png", "image/jpeg", "image/webp"],
    { parseAs: "buffer", bodyLimit: MAX_PDF_BYTES },
    (_r, body, done) => done(null, body),
  );
  const getExam = async (r: Parameters<typeof user>[0], adminReadOnly = false) => {
    const u = await user(r, "teacher");
    const { eid } = params.parse(r.params);
    const e = (adminReadOnly && u.role === "super_admin"
      ? await c("examImports").findOne({ _id: eid })
      : await owned("examImports", eid, u._id)) ?? fail(404, "آزمون یافت نشد");
    if (e.archivedAt) fail(404, "آزمون یافت نشد");
    return { u, e };
  };
  // A source transcription import used SHA256 item identities. Keep those
  // existing drafts editable without accepting arbitrary non-UUID identifiers.
  const itemIdentifier = async (
    raw: unknown,
    examId: string,
    ownerId: string,
  ) => {
    const uuid = z.uuid().safeParse(raw);
    if (uuid.success) return uuid.data;
    const legacy = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(raw);
    const item = await c("examImportItems").findOne({
      _id: legacy,
      examId,
      ownerId,
      maintenanceLatexRevision: 2,
    });
    if (!item) fail(404, "پیش‌نویس یافت نشد");
    return legacy;
  };
  // Admin's private intake checklist is separate from the public catalog.
  // The public catalog only counts questions explicitly approved for publication.
  app.get("/api/admin/exam-catalog/imports", async (r) => {
    await user(r, "super_admin");
    const rows = await c("examImports").find(
      { archivedAt: { $exists: false } },
      { projection: { _id: 1, title: 1, year: 1, grade: 1, track: 1,
        categoryIds: 1, source: 1, state: 1, statistics: 1, files: 1, createdAt: 1 } },
    ).sort({ createdAt: -1 }).limit(500).toArray();
    if (!rows.length) return [];
    // Distinct source question numbers prevent double counting duplicate
    // OCR drafts / re-imported items. An unnumbered verified item counts once.
    const counts = await c("examImportItems").aggregate([
      { $match: { examId: { $in: rows.map((row) => row._id) } } },
      { $group: {
        _id: "$examId",
        total: { $sum: 1 },
        approvedKeys: {
          $addToSet: {
            $cond: [
              { $and: [
                { $eq: ["$state", "approved"] },
                { $eq: [{ $type: "$questionVersionId" }, "string"] },
              ] },
              { $ifNull: [
                "$originalNumber",
                { $ifNull: ["$extraction.detectedNumber", "$_id"] },
              ] },
              null,
            ],
          },
        },
      } },
    ]).toArray();
    const byId = new Map(counts.map((row) => [row._id, row]));
    return rows.map((row) => {
      const count = byId.get(row._id);
      const total = count?.total ?? 0;
      const approved = (count?.approvedKeys ?? []).filter((value: unknown) => value !== null).length;
      const historical = estimateLegacyQuestionCount({
        keyEntries: row.statistics?.keys ?? 0,
        hasAnswerFile: Boolean(row.files?.answer),
        failedAnswerPages: row.statistics?.failedPages?.filter(
          (page: { kind: string }) => page.kind === "answer",
        ).length ?? 0,
      });
      const progress = calculateExamProgress({
        approved,
        extracted: total,
        expectedQuestionCount: row.statistics?.expectedQuestionCount ?? historical.expectedQuestionCount,
        expectedCountConfidence: row.statistics?.expectedCountConfidence ?? historical.expectedCountConfidence,
      });
      return {
        _id: row._id, title: row.title, year: row.year, grade: row.grade,
        track: row.track, categoryIds: row.categoryIds ?? [],
        examDate: row.source?.examDate, stage: row.source?.stage,
        state: row.state,
        ...progress,
        // Legacy fields retained for earlier UI clients.
        total, complete: progress.status === "complete",
      };
    });
  });
  app.post("/api/admin/exam-catalog/imports/:eid/completion", async (r) => {
    const admin = await user(r, "super_admin");
    const { eid } = params.parse(r.params);
    const input = z.object({ complete: z.boolean() }).strict().parse(r.body);
    const exam = await c("examImports").findOne({ _id: eid, archivedAt: { $exists: false } });
    if (!exam) return fail(404, "آزمون یافت نشد");
    const total = await c("examImportItems").countDocuments({ examId: eid });
    const approved = await c("examImportItems").countDocuments({ examId: eid, state: "approved" });
    if (input.complete && (!total || approved !== total))
      return fail(409, "تا وقتی همه سؤال‌های استخراج‌شده تأیید نشده‌اند، امکان زدن تیک کامل نیست");
    await c("examImports").updateOne(
      { _id: eid },
      input.complete
        ? { $set: { reviewedCompleteAt: now(), reviewedCompleteBy: admin._id } }
        : { $unset: { reviewedCompleteAt: "", reviewedCompleteBy: "" } },
    );
    await c("auditLogs").insertOne({
      _id: id(), actorId: admin._id,
      action: input.complete ? "exam_import_mark_complete" : "exam_import_unmark_complete",
      resourceId: eid, createdAt: now(),
    });
    return { complete: input.complete, total, approved };
  });
  app.get("/api/exam-imports", async (r) => {
    const u = await user(r, "teacher");
    const rows = await c("examImports")
      .find(
        { ...(u.role === "super_admin" ? {} : { ownerId: u._id }), archivedAt: { $exists: false } },
        { projection: { questionText: 0, answerText: 0 } },
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    if (u.role !== "super_admin") return rows;
    const owners = await c("users").find({ _id: { $in: [...new Set(rows.map((row) => row.ownerId))] } })
      .project({ _id: 1, name: 1, email: 1 }).toArray();
    const names = new Map(owners.map((owner) => [owner._id, owner.name || owner.email || "کاربر"]));
    return rows.map((row) => ({ ...row, ownerName: names.get(row.ownerId) ?? "کاربر" }));
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
  app.delete("/api/exam-imports/:eid", async (r) => {
    const { u, e } = await getExam(r);
    const result = await c("examImports").updateOne(
      {
        _id: e._id,
        ownerId: u._id,
        state: { $ne: "processing" },
        archivedAt: { $exists: false },
      },
      { $set: { archivedAt: now() } },
    );
    if (!result.modifiedCount)
      fail(409, "ابتدا منتظر پایان پردازش آزمون بمانید");
    await c("pdfLibrary").updateMany(
      { sourceExamId: e._id },
      { $set: { visibility: "private", archivedAt: now(), updatedAt: now() } },
    );
    return { deleted: true };
  });
  app.get("/api/exam-imports/:eid", async (r) => {
    const { e } = await getExam(r, true);
    const owner = await c("users").findOne({ _id: e.ownerId }, { projection: { name: 1, email: 1 } });
    return {
      ...e,
      ownerName: owner?.name || owner?.email || "کاربر",
      publicFiles: await (async () => {
        const rows = await c("pdfLibrary").find({
          sourceExamId: e._id, visibility: "public", state: "ready",
          archivedAt: { $exists: false },
        }).project({ _id: 1, sourceKind: 1 }).toArray();
        const files: { question?: { id: string }; answer?: { id: string } } = {};
        for (const row of rows)
          if (row.sourceKind === "question" || row.sourceKind === "answer")
            files[row.sourceKind] = { id: row._id };
        return files;
      })(),
      job: e.jobId
        ? await c("examImportJobs").findOne(
            { _id: e.jobId, ownerId: e.ownerId },
            { projection: { leaseToken: 0 } },
          )
        : null,
      sourcePages: await c("examImportPages")
        .find(
          {
            examId: e._id,
            ownerId: e.ownerId,
            kind: "question",
            expiresAt: { $gt: new Date() },
          },
          { projection: { _id: 0, page: 1 } },
        )
        .sort({ page: 1 })
        .toArray(),
      items: await c("examImportItems")
        .find({ examId: e._id, ownerId: e.ownerId })
        .sort({ createdAt: 1, _id: 1 })
        .toArray(),
    };
  });
  app.post("/api/admin/exam-imports/:eid/public-files", async (r) => {
    const admin = await user(r, "super_admin");
    const { eid } = params.parse(r.params);
    const { published } = z.object({ published: z.boolean() }).strict().parse(r.body);
    const exam = await c("examImports").findOne({
      _id: eid, archivedAt: { $exists: false },
    });
    if (!exam) fail(404, "آزمون یافت نشد");

    if (!published) {
      await ctx.transaction(async (session) => {
        await c("pdfLibrary").updateMany(
          { sourceExamId: eid, sourceKind: { $in: ["question", "answer"] } },
          { $set: { visibility: "private", updatedAt: now() } },
          { session },
        );
        await c("auditLogs").insertOne({
          _id: id(), actorId: admin._id,
          action: "exam_import_public_files_unpublish",
          resourceId: eid, createdAt: now(),
        }, { session });
      });
      return { published: false, files: {} };
    }

    if (exam.state !== "review")
      fail(409, "ابتدا پردازش و بازبینی آزمون را به پایان برسانید");
    if (exam.sourceDeletedAt)
      fail(410, "فایل‌های اصلی حذف شده‌اند؛ برای انتشار دوباره آن‌ها را بارگذاری کنید");
    const categoryIds = Array.isArray(exam.categoryIds)
      ? exam.categoryIds.filter((value: unknown): value is string =>
          typeof value === "string" && validExamCoverageId(value))
      : [];
    if (!categoryIds.length || categoryIds.length !== (exam.categoryIds ?? []).length)
      fail(400, "ابتدا آزمون را به یک مورد معتبر از فهرست آزمون‌ها متصل کنید");
    if (!exam.files?.question)
      fail(409, "برای انتشار عمومی، ابتدا PDF دفترچه سؤال را بارگذاری کنید");

    const copies: Array<{
      kind: "question" | "answer";
      file: { name: string; size: number; sha256: string };
      data: Buffer;
      sha256: string;
    }> = [];
    for (const kind of ["question", "answer"] as const) {
      const file = exam.files?.[kind];
      if (!file) continue;
      let data: Buffer;
      try {
        data = await sourceBytes(ctx, eid, kind);
      } catch {
        fail(410, `فایل ${kind === "question" ? "دفترچه" : "کلید پاسخ"} منقضی یا حذف شده است؛ دوباره آن را بارگذاری کنید`);
      }
      const sha256 = createHash("sha256").update(data!).digest("hex");
      if (data!.length !== file.size || sha256 !== file.sha256 ||
        data!.subarray(0, 5).toString() !== "%PDF-" ||
        !data!.subarray(-2048).includes(Buffer.from("%%EOF")))
        fail(503, "صحت فایل منبع تأیید نشد؛ انتشار انجام نشد");
      copies.push({ kind, file, data: data!, sha256 });
    }

    await ctx.transaction(async (session) => {
      const current = await c("examImports").findOne({
        _id: eid, archivedAt: { $exists: false }, state: "review",
      }, { session });
      const currentCategoryIds = Array.isArray(current?.categoryIds)
        ? current.categoryIds.filter((value: unknown): value is string =>
            typeof value === "string" && validExamCoverageId(value))
        : [];
      if (!current || current.sourceDeletedAt ||
        current.files?.question?.sha256 !== exam.files.question.sha256 ||
        currentCategoryIds.length !== categoryIds.length ||
        categoryIds.some((categoryId) => !currentCategoryIds.includes(categoryId)))
        fail(409, "وضعیت آزمون هنگام انتشار تغییر کرده است؛ دوباره تلاش کنید");
      for (const copy of copies) {
        if (current.files?.[copy.kind]?.sha256 !== copy.sha256)
          fail(409, "فایل منبع هنگام انتشار تغییر کرده است");
        const suffix = copy.kind === "question" ? "دفترچه سؤال" : "کلید پاسخ";
        await c("pdfLibrary").updateOne(
          { sourceExamId: eid, sourceKind: copy.kind },
          {
            $set: {
              ownerId: admin._id,
              title: `${current.title} — ${suffix}`.slice(0, 150),
              description: `فایل ${suffix} آزمون ${current.title}`.slice(0, 700),
              taxonomy: {
                level: "", grade: current.grade ?? "", book: current.subject ?? "",
                chapter: "", topic: "",
              },
              visibility: "public",
              state: "ready",
              examCatalogIds: categoryIds,
              file: { name: copy.file.name, size: copy.data.length, sha256: copy.sha256 },
              updatedAt: now(),
            },
            $setOnInsert: {
              _id: id(), sourceExamId: eid, sourceKind: copy.kind, createdAt: now(),
            },
            $unset: { archivedAt: "", uploadSession: "" },
          },
          { upsert: true, session },
        );
        const publishedFile = await c("pdfLibrary").findOne(
          { sourceExamId: eid, sourceKind: copy.kind },
          { session },
        );
        if (!publishedFile) fail(500, "ثبت فایل عمومی انجام نشد");
        await c("pdfLibraryChunks").deleteMany(
          { pdfId: publishedFile._id },
          { session },
        );
        for (let offset = 0, position = 0; offset < copy.data.length; offset += 256 * 1024, position++)
          await c("pdfLibraryChunks").insertOne({
            _id: id(), pdfId: publishedFile._id, ownerId: admin._id,
            position, data: new Binary(copy.data.subarray(offset, offset + 256 * 1024)),
          }, { session });
      }
      await c("auditLogs").insertOne({
        _id: id(), actorId: admin._id,
        action: "exam_import_public_files_publish",
        resourceId: eid, createdAt: now(),
      }, { session });
    });

    const rows = await c("pdfLibrary").find({
      sourceExamId: eid, sourceKind: { $in: ["question", "answer"] },
      visibility: "public", state: "ready", archivedAt: { $exists: false },
    }).project({ _id: 1, sourceKind: 1 }).toArray();
    const files: { question?: { id: string }; answer?: { id: string } } = {};
    for (const row of rows)
      if (row.sourceKind === "question" || row.sourceKind === "answer")
        files[row.sourceKind] = { id: row._id };
    return { published: true, files };
  });
  app.post("/api/exam-imports/:eid/items/:iid/source-image", async (r) => {
    const { u, e } = await getExam(r);
    const iid = await itemIdentifier(
      (r.params as { iid: string }).iid,
      e._id,
      u._id,
    );
    const { page } = z
      .object({ page: z.number().int().min(1).max(100) })
      .strict()
      .parse(r.body);
    return ctx.transaction(async (session) => {
      const item = await c("examImportItems").findOne(
        { _id: iid, examId: e._id, ownerId: u._id, state: "pending" },
        { session },
      );
      if (!item || e.state !== "review")
        return fail(409, "فقط پیش‌نویس در حال بررسی قابل اصلاح است");
      const source = await c("examImportPages").findOne(
        {
          examId: e._id,
          ownerId: u._id,
          kind: "question",
          page,
          expiresAt: { $gt: new Date() },
        },
        { session },
      );
      if (!source)
        return fail(
          404,
          "صفحه اصلی موجود نیست یا مهلت نگهداری آن تمام شده است",
        );
      // Reuse one private page asset across retries; approval promotes it through the existing pipeline.
      await c("examImportPreviewAssets").updateOne(
        { _id: source._id },
        {
          $setOnInsert: {
            ownerId: u._id,
            examId: e._id,
            data: source.data,
            width: source.width,
            height: source.height,
            expiresAt: source.expiresAt,
          },
        },
        { upsert: true, session },
      );
      return {
        kind: "image",
        assetId: source._id,
        width: source.width,
        height: source.height,
        caption: `تصویر سؤال از صفحه ${page} منبع آزمون`,
      };
    });
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
    const { e } = await getExam(r, true),
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
      {
        $set: { state: "queued", stage: "queued" },
        $unset: {
          errorCode: "",
          errorMessage: "",
          completedAt: "",
          processedPage: "",
          totalPages: "",
          progressUpdatedAt: "",
          leaseToken: "",
          leaseUntil: "",
        },
      },
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
    const { e } = await getExam(r, true);
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
      iid = await itemIdentifier(
        (r.params as { iid: string }).iid,
        e._id,
        u._id,
      );
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
        const approvedOriginalNumber = b.originalNumber ?? item!.originalNumber ?? item!.extraction?.detectedNumber ?? null;
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
        if (approvedOriginalNumber) source.questionNumber = approvedOriginalNumber;
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
            categoryIds: e.categoryIds ?? [],
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
              originalNumber: approvedOriginalNumber,
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
