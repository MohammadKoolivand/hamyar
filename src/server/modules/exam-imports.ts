import type { FastifyInstance } from "fastify";
import { Binary } from "mongodb";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Context } from "../context";
import {
  examImportSchema,
  examDraftSchema,
  MAX_PDF_BYTES,
  splitExamText,
} from "../../lib/exam-import";
import { extractPdfText } from "../imports/pdf";
import { questionSchema } from "../domain";
import { persistQuestion, validateQuestion } from "./authoring";
const params = z.object({ eid: z.string().uuid() });
export function registerExamImports(app: FastifyInstance, ctx: Context) {
  const { c, id, now, owned, user, fail } = ctx;
  app.addContentTypeParser(
    "application/pdf",
    { parseAs: "buffer", bodyLimit: MAX_PDF_BYTES },
    (_r, body, done) => done(null, body),
  );
  const getExam = async (r: Parameters<typeof user>[0]) => {
    const u = await user(r, "teacher");
    const { eid } = params.parse(r.params);
    return { u, e: await owned("examImports", eid, u._id) };
  };
  async function bytes(eid: string, kind: string) {
    const rows = await c("examImportChunks")
      .find({ examId: eid, kind })
      .sort({ position: 1 })
      .toArray();
    return Buffer.concat(
      rows.map((r) =>
        r.data instanceof Binary
          ? Buffer.from(r.data.value())
          : Buffer.from(r.data),
      ),
    );
  }
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
      const data = r.body;
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
      if (!/\.pdf$/i.test(name)) fail(400, "پسوند فایل باید PDF باشد");
      const buffer = data as Buffer,
        file = {
          name,
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
              },
              { session },
            );
          await c("examImports").updateOne(
            { _id: e._id },
            { $set: { [`files.${kind}`]: file }, $inc: { revision: 1 } },
            { session },
          );
          return file;
        },
      );
    },
  );
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
    return reply.send(await bytes(e._id, kind));
  });
  app.post("/api/exam-imports/:eid/extract", async (r) => {
    const { u, e } = await getExam(r);
    if (e.state === "review") return { state: "review" };
    if (!e.files?.question) fail(400, "ابتدا دفترچه سؤال‌ها را آپلود کنید");
    const question = await extractPdfText(await bytes(e._id, "question"));
    const answer = e.files?.answer
      ? await extractPdfText(await bytes(e._id, "answer"))
      : {
          text: "",
          notice:
            "پاسخ‌نامه‌ای بارگذاری نشده؛ پاسخ هر سؤال را معلم وارد می‌کند.",
        };
    return ctx.atomic(
      r,
      u._id,
      `extract-exam:${e._id}`,
      { revision: e.revision },
      async (session) => {
        const current = await c("examImports").findOne(
          { _id: e._id, ownerId: u._id },
          { session },
        );
        if (current?.state === "review") return { state: "review" };
        if (current?.revision !== e.revision)
          fail(409, "فایل حین پردازش تغییر کرد؛ دوباره پردازش کنید");
        const parts = splitExamText(question.text);
        for (const statement of parts)
          await c("examImportItems").insertOne(
            {
              _id: id(),
              ownerId: u._id,
              examId: e._id,
              state: "pending",
              createdAt: now(),
              question: {
                statement,
                reference: "",
                type: "essay",
                options: [],
                hints: [],
                classification: "free",
              },
            },
            { session },
          );
        await c("examImports").updateOne(
          { _id: e._id },
          {
            $set: {
              state: "review",
              questionText: question.text,
              answerText: answer.text,
              extractionNotice: [
                ...new Set([question.notice, answer.notice]),
                "حداکثر ۱۰۰ قطعه پیشنهادی ایجاد می‌شود؛ متن کامل برای تقسیم دستی در دسترس است. پاسخ مرجع خودکار حدس زده نمی‌شود.",
              ].join(" "),
            },
          },
          { session },
        );
        return { state: "review" };
      },
    );
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
          )) >= 150
        )
          fail(400, "حداکثر ۱۵۰ پیش‌نویس برای هر آزمون مجاز است");
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
  app.post("/api/exam-imports/:eid/items/:iid/review", async (r) => {
    const { u, e } = await getExam(r),
      iid = z
        .string()
        .uuid()
        .parse((r.params as { iid: string }).iid);
    const b = z
      .discriminatedUnion("action", [
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
    if (b.action === "approve") await validateQuestion(ctx, u._id, b.question);
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
        const source = { ...e.source };
        delete source.questionNumber;
        if (b.originalNumber) source.questionNumber = b.originalNumber;
        const q = questionSchema.parse({
          ...b.question,
          source,
          ...(e.year ? { year: e.year } : {}),
        });
        const row = await persistQuestion(ctx, u._id, q, session, {
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
