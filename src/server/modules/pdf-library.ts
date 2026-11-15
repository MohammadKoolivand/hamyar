import type { FastifyInstance } from "fastify";
import { Binary, type ClientSession } from "mongodb";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Context } from "../context";
import { MAX_PDF_BYTES } from "../../lib/exam-import";

const idParams = z.object({ pid: z.string().uuid() });
const taxonomy = z.object({
  level: z.string().trim().max(120).default(""),
  grade: z.string().trim().max(120).default(""),
  book: z.string().trim().max(150).default(""),
  chapter: z.string().trim().max(150).default(""),
  topic: z.string().trim().max(150).default(""),
}).strict();
const metadata = z.object({
  title: z.string().trim().min(3).max(150),
  taxonomy,
  topicId: z.string().uuid().optional(),
  visibility: z.enum(["public", "private"]).default("public"),
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
      .find({ visibility: "public", state: "ready", archivedAt: { $exists: false } })
      .project({ ownerId: 0, topicId: 0 })
      .sort({ createdAt: -1 }).limit(200).toArray();
  });

  app.get("/api/pdf-library", async (r) => {
    const u = await user(r, "teacher");
    const rows = await c("pdfLibrary").find({
      ...(u.role === "super_admin" ? {} : { ownerId: u._id }),
      archivedAt: { $exists: false },
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
      for (let offset = 0, position = 0; offset < data.length; offset += 256 * 1024, position++) {
        await c("examImportChunks").insertOne({
          _id: id(), examId, ownerId: u._id, kind: "question", position,
          data: new Binary(data.subarray(offset, offset + 256 * 1024)), expiresAt,
        }, { session });
      }
    });
    return { examId };
  });

  app.delete("/api/pdf-library/:pid", async (r) => {
    const { u, pdf } = await teacherPdf(r);
    await ctx.transaction(async (session) => {
      await c("pdfLibrary").updateOne(
        { _id: pdf._id, ownerId: u._id }, { $set: { archivedAt: now() } },
        { session },
      );
      await c("pdfLibraryChunks").deleteMany({ pdfId: pdf._id, ownerId: u._id }, { session });
    });
    return { deleted: true };
  });
}
