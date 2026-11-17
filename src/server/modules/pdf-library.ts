import type { FastifyInstance } from "fastify";
import { Binary, type ClientSession } from "mongodb";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Context } from "../context";
import { MAX_PDF_BYTES } from "../../lib/exam-import";
import { PDF_LIBRARY_UPLOAD_CHUNK_BYTES } from "../../lib/pdf-library";

const idParams = z.object({ pid: z.string().uuid() });
const taxonomy = z.object({
  level: z.string().trim().max(120).default(""),
  grade: z.string().trim().max(120).default(""),
  book: z.string().trim().max(150).default(""),
  chapter: z.string().trim().max(150).default(""),
  topic: z.string().trim().max(150).default(""),
}).strict();
const uploadSessionInput = z.object({
  name: z.string().trim().min(1).max(160).regex(/\.pdf$/i),
  size: z.number().int().positive().max(MAX_PDF_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  chunkCount: z.number().int().positive().max(Math.ceil(MAX_PDF_BYTES / PDF_LIBRARY_UPLOAD_CHUNK_BYTES)),
}).strict();
const uploadCompleteInput = z.object({ uploadId: z.string().uuid() }).strict();
const chunkParams = z.object({
  pid: z.string().uuid(), uploadId: z.string().uuid(),
  position: z.coerce.number().int().min(0).max(Math.ceil(MAX_PDF_BYTES / PDF_LIBRARY_UPLOAD_CHUNK_BYTES) - 1),
});
const metadata = z.object({
  title: z.string().trim().min(3).max(150),
  taxonomy,
  topicId: z.string().uuid().optional(),
  visibility: z.enum(["public", "private"]).default("private"),
  description: z.string().trim().max(700).default(""),
}).strict();

async function bytes(ctx: Context, pdfId: string) {
  const chunks = await ctx.c("pdfLibraryChunks")
    .find({ pdfId }).sort({ position: 1 }).toArray();
  if (!chunks.length) ctx.fail(404, "فایل PDF در دسترس نیست");
  return Buffer.concat(chunks.map((row) =>
    row.data instanceof Binary ? Buffer.from(row.data.value()) : Buffer.from(row.data)
  ));
}

export function registerPdfLibrary(app: FastifyInstance, ctx: Context) {
  const { c, id, now, user, fail } = ctx;
  const teacherPdf = async (r: Parameters<typeof user>[0], adminReadOnly = false) => {
    const u = await user(r, "teacher");
    const { pid } = idParams.parse(r.params);
    const pdf = (await c("pdfLibrary").findOne({
      _id: pid,
      ...(adminReadOnly && u.role === "super_admin" ? {} : { ownerId: u._id }),
      archivedAt: { $exists: false },
    })) ?? fail(404, "فایل یافت نشد");
    return { u, pdf: pdf! };
  };

  app.get("/api/pdf-library/public", async () => {
    return c("pdfLibrary")
      .find({
        visibility: "public", state: "ready", archivedAt: { $exists: false },
        sourceExamId: { $exists: false },
      })
      .project({ ownerId: 0, topicId: 0 })
      .sort({ createdAt: -1 }).limit(200).toArray();
  });

  app.get("/api/pdf-library", async (r) => {
    const u = await user(r, "teacher");
    const rows = await c("pdfLibrary").find({
      ...(u.role === "super_admin" ? {} : { ownerId: u._id }),
      archivedAt: { $exists: false },
      sourceExamId: { $exists: false },
    }).sort({ createdAt: -1 }).limit(u.role === "super_admin" ? 1000 : 100).toArray();
    if (u.role !== "super_admin") return rows;
    const owners = await c("users").find({ _id: { $in: [...new Set(rows.map((row) => row.ownerId))] } })
      .project({ _id: 1, name: 1, email: 1 }).toArray();
    const names = new Map(owners.map((owner) => [owner._id, owner.name || owner.email || "کاربر"]));
    return rows.map((row) => ({ ...row, ownerName: names.get(row.ownerId) ?? "کاربر" }));
  });

  app.post("/api/pdf-library", async (r) => {
    const u = await user(r, "teacher");
    const body = metadata.parse(r.body);
    if (body.topicId) {
      const node = await c("curriculum").findOne({
        _id: body.topicId, ownerId: u._id, archivedAt: { $exists: false },
      });
      if (!node) fail(400, "مبحث انتخاب‌شده در دسترس نیست");
    }
    return ctx.atomic(r, u._id, "create-pdf-library", body, async (session) => {
      const row = {
        _id: id(), ownerId: u._id, ...body,
        state: "pending", createdAt: now(),
      };
      await c("pdfLibrary").insertOne(row, { session });
      return row;
    });
  });

  // Resumable upload: each request transfers at most 512 KiB, so a slow
  // reverse proxy or connection cannot strand a single 20 MiB request.
  app.post("/api/pdf-library/:pid/upload-session", async (r) => {
    const { u, pdf } = await teacherPdf(r);
    const input = uploadSessionInput.parse(r.body);
    if (pdf.state !== "pending") fail(409, "این PDF قبلاً ثبت شده است");
    if (input.chunkCount !== Math.ceil(input.size / PDF_LIBRARY_UPLOAD_CHUNK_BYTES))
      fail(400, "تعداد بخش‌های فایل معتبر نیست");
    const uploadId = id();
    await ctx.transaction(async (session) => {
      await c("pdfLibraryChunks").deleteMany({ pdfId: pdf._id }, { session });
      const updated = await c("pdfLibrary").updateOne(
        { _id: pdf._id, ownerId: u._id, state: "pending" },
        { $set: {
          uploadSession: {
            id: uploadId, name: input.name, size: input.size,
            sha256: input.sha256, chunkCount: input.chunkCount,
            chunkSize: PDF_LIBRARY_UPLOAD_CHUNK_BYTES, startedAt: now(),
          },
          updatedAt: now(),
        } },
        { session },
      );
      if (!updated.matchedCount) fail(409, "وضعیت فایل تغییر کرده است");
    });
    return { uploadId, chunkSize: PDF_LIBRARY_UPLOAD_CHUNK_BYTES, chunkCount: input.chunkCount };
  });

  app.post("/api/pdf-library/:pid/chunks/:uploadId/:position", {
    bodyLimit: PDF_LIBRARY_UPLOAD_CHUNK_BYTES,
    config: { rateLimit: { max: 100, timeWindow: "10 minutes" } },
    onRequest: async (r) => { await user(r, "teacher"); },
  }, async (r) => {
    const { u, pdf } = await teacherPdf(r);
    const { uploadId, position } = chunkParams.parse(r.params);
    const session = pdf.uploadSession;
    if (pdf.state !== "pending" || session?.id !== uploadId)
      fail(409, "نشست بارگذاری منقضی شده است؛ دوباره تلاش کنید");
    if (String(r.headers["content-type"] ?? "").split(";")[0] !== "application/octet-stream")
      fail(415, "نوع دادهٔ بخش فایل معتبر نیست");
    const data = r.body as Buffer;
    const expectedLength = Math.min(
      PDF_LIBRARY_UPLOAD_CHUNK_BYTES,
      session.size - position * PDF_LIBRARY_UPLOAD_CHUNK_BYTES,
    );
    if (position >= session.chunkCount || !Buffer.isBuffer(data) ||
      data.length !== expectedLength || data.length <= 0)
      fail(400, "اندازه یا شمارهٔ بخش فایل معتبر نیست");
    const chunkId = `${pdf._id}:${uploadId}:${position}`;
    await c("pdfLibraryChunks").replaceOne(
      { _id: chunkId },
      { _id: chunkId, pdfId: pdf._id, ownerId: u._id, uploadId, position, data: new Binary(data) },
      { upsert: true },
    );
    return { accepted: data.length, position };
  });

  app.post("/api/pdf-library/:pid/complete", async (r) => {
    const { u, pdf } = await teacherPdf(r);
    const { uploadId } = uploadCompleteInput.parse(r.body);
    const session = pdf.uploadSession;
    if (pdf.state !== "pending" || session?.id !== uploadId)
      fail(409, "نشست بارگذاری منقضی شده است؛ دوباره تلاش کنید");
    const chunks = await c("pdfLibraryChunks")
      .find({ pdfId: pdf._id, ownerId: u._id, uploadId })
      .sort({ position: 1 }).toArray();
    if (chunks.length !== session.chunkCount ||
      chunks.some((chunk, index) => chunk.position !== index))
      fail(409, "همهٔ بخش‌های PDF دریافت نشده‌اند؛ بارگذاری را دوباره انجام دهید");
    const data = Buffer.concat(chunks.map((chunk) =>
      chunk.data instanceof Binary ? Buffer.from(chunk.data.value()) : Buffer.from(chunk.data)
    ));
    const digest = createHash("sha256").update(data).digest("hex");
    if (data.length !== session.size || digest !== session.sha256 ||
      data.subarray(0, 5).toString() !== "%PDF-" ||
      !data.subarray(-2048).includes(Buffer.from("%%EOF")))
      fail(400, "فایل کامل دریافت نشد یا صحت PDF تأیید نشد؛ لطفاً دوباره بارگذاری کنید");
    const updated = await c("pdfLibrary").updateOne(
      { _id: pdf._id, ownerId: u._id, state: "pending", "uploadSession.id": uploadId },
      {
        $set: {
          file: { name: session.name, size: data.length, sha256: digest },
          state: "ready", updatedAt: now(),
        },
        $unset: { uploadSession: "" },
      },
    );
    if (!updated.matchedCount) fail(409, "وضعیت فایل هنگام ثبت نهایی تغییر کرده است");
    return { _id: pdf._id, state: "ready", file: { name: session.name, size: data.length, sha256: digest } };
  });

  app.post("/api/pdf-library/:pid/file", {
    bodyLimit: MAX_PDF_BYTES,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (r) => {
    const { u, pdf } = await teacherPdf(r);
    const buffer = r.body as Buffer;
    if (pdf.state !== "pending") fail(409, "فایل قبلاً بارگذاری شده است");
    if (String(r.headers["content-type"] ?? "").split(";")[0] !== "application/pdf" ||
      !Buffer.isBuffer(buffer) || buffer.length < 8 ||
      buffer.length > MAX_PDF_BYTES ||
      buffer.subarray(0, 5).toString() !== "%PDF-" ||
      !buffer.subarray(-2048).includes(Buffer.from("%%EOF"))) {
      fail(400, "PDF معتبر تا ۲۰ مگابایت انتخاب کنید");
    }
    let filename: string;
    try { filename = decodeURIComponent(String(r.headers["x-file-name"] ?? "questions.pdf")); }
    catch { return fail(400, "نام فایل معتبر نیست"); }
    filename = z.string().trim().min(1).max(160).parse(filename);
    if (!/\.pdf$/i.test(filename)) fail(400, "پسوند فایل باید PDF باشد");
    const file = {
      name: filename, size: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    };
    return ctx.transaction(async (session) => {
      const current = await c("pdfLibrary").findOne({
        _id: pdf._id, ownerId: u._id, state: "pending",
      }, { session });
      if (!current) fail(409, "وضعیت فایل تغییر کرده است");
      await c("pdfLibraryChunks").deleteMany({ pdfId: pdf._id }, { session });
      for (let offset = 0, position = 0; offset < buffer.length; offset += 256 * 1024, position++) {
        await c("pdfLibraryChunks").insertOne({
          _id: id(), pdfId: pdf._id, ownerId: u._id, position,
          data: new Binary(buffer.subarray(offset, offset + 256 * 1024)),
        }, { session });
      }
      await c("pdfLibrary").updateOne(
        { _id: pdf._id, ownerId: u._id, state: "pending" },
        { $set: { file, state: "ready", updatedAt: now() } }, { session },
      );
      return { _id: pdf._id, state: "ready", file };
    });
  });

  app.get("/api/pdf-library/:pid/file", async (r, reply) => {
    const { pid } = idParams.parse(r.params);
    const pdf = (await c("pdfLibrary").findOne({
      _id: pid, state: "ready", archivedAt: { $exists: false },
    })) ?? fail(404, "PDF یافت نشد");
    if (pdf.visibility !== "public") {
      const u = await user(r, "teacher");
      if (pdf.ownerId !== u._id && u.role !== "super_admin") fail(404, "PDF یافت نشد");
    }
    if (pdf.sourceExamId) {
      const sourceExam = await c("examImports").findOne({
        _id: pdf.sourceExamId, archivedAt: { $exists: false },
      }, { projection: { _id: 1 } });
      if (!sourceExam) fail(404, "PDF یافت نشد");
    }
    const file = await bytes(ctx, pid);
    if (createHash("sha256").update(file).digest("hex") !== pdf.file?.sha256)
      fail(503, "فایل نیازمند بررسی یکپارچگی است");
    reply.header("Content-Type", "application/pdf")
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "sandbox")
      .header("Content-Disposition",
        `inline; filename="questions.pdf"; filename*=UTF-8''${encodeURIComponent(pdf.file.name)}`)
      .header("Cache-Control", "private, no-store");
    return reply.send(file);
  });

  // Import copies the source into the EXISTING review workflow without changing
  // or removing the original PDF resource. Extraction requires a separate action.
  app.post("/api/pdf-library/:pid/send-to-import", async (r) => {
    // An admin may make a personal review copy of another teacher’s PDF.
    // The original resource and its owner remain unchanged.
    const { u, pdf } = await teacherPdf(r, true);
    if (pdf.state !== "ready") fail(409, "ابتدا فایل PDF را بارگذاری کنید");
    const data = await bytes(ctx, pdf._id);
    if (createHash("sha256").update(data).digest("hex") !== pdf.file?.sha256)
      fail(503, "فایل نیازمند بررسی یکپارچگی است");
    const examId = id();
    const expiresAt = new Date(Date.now() + 14 * 86400000);
    await ctx.transaction(async (session: ClientSession) => {
      await c("examImports").insertOne({
        _id: examId, ownerId: u._id, title: pdf.title, subject: pdf.taxonomy?.book || "سایر",
        grade: pdf.taxonomy?.grade || "",
        source: { family: "practice", practice: "teacher", sourceTitle: pdf.title },
        ocrLanguage: "fas", state: "collecting", revision: 1, createdAt: now(),
        sourcePdfLibraryId: pdf._id, sourceExpiresAt: expiresAt,
        files: { question: {
          id: ctx.hash(`${examId}:question:${pdf.file.sha256}`),
          name: pdf.file.name, size: data.length, sha256: pdf.file.sha256,
        } },
      }, { session });
      const importChunks = Array.from(
        { length: Math.ceil(data.length / (256 * 1024)) },
        (_, position) => ({
          _id: id(), examId, ownerId: u._id, kind: "question", position,
          data: new Binary(data.subarray(position * 256 * 1024, (position + 1) * 256 * 1024)),
          expiresAt,
        }),
      );
      await c("examImportChunks").insertMany(importChunks, { session });
    });
    return { examId };
  });

  app.delete("/api/pdf-library/:pid", async (r) => {
    const { u, pdf } = await teacherPdf(r);
    await ctx.transaction(async (session) => {
      const assigned = await c("pdfDeliveries").findOne({ pdfId: pdf._id, teacherId: u._id }, { session });
      if (assigned) fail(409, "این PDF سابقه ارسال به دانش‌آموز دارد؛ برای حفظ سوابق قابل حذف نیست");
      await c("pdfLibrary").updateOne(
        { _id: pdf._id, ownerId: u._id }, { $set: { archivedAt: now() } },
        { session },
      );
      await c("pdfLibraryChunks").deleteMany({ pdfId: pdf._id, ownerId: u._id }, { session });
    });
    return { deleted: true };
  });
}
