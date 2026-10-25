import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Binary } from "mongodb";
import sharp from "sharp";
import type { Context } from "../context";
import type { DocumentPage } from "./document-engine";
import { parseQuestions, parseAnswerKey, matchKey } from "./layout";
const exec = promisify(execFile);
export const retentionDays = () =>
  Math.min(
    90,
    Math.max(1, Number(process.env.EXAM_SOURCE_RETENTION_DAYS) || 7),
  );
export async function sourceBytes(ctx: Context, examId: string, kind: string) {
  // Upgrade legacy private uploads lazily, using their original exam creation date.
  if (
    await ctx
      .c("examImportChunks")
      .findOne({ examId, kind, expiresAt: { $exists: false } })
  ) {
    const exam = await ctx.c("examImports").findOne({ _id: examId });
    const deadline = new Date(
      new Date(exam?.createdAt ?? 0).getTime() + retentionDays() * 86400000,
    );
    await ctx
      .c("examImportChunks")
      .updateMany(
        { examId, expiresAt: { $exists: false } },
        { $set: { expiresAt: deadline } },
      );
  }

  const rows = await ctx
    .c("examImportChunks")
    .find({ examId, kind, expiresAt: { $gt: new Date() } })
    .sort({ position: 1 })
    .toArray();
  if (!rows.length)
    throw Object.assign(new Error("فایل منقضی یا حذف شده است"), {
      statusCode: 410,
    });
  return Buffer.concat(
    rows.map((r) =>
      r.data instanceof Binary
        ? Buffer.from(r.data.value())
        : Buffer.from(r.data),
    ),
  );
}
export async function enqueueExam(
  ctx: Context,
  ownerId: string,
  examId: string,
) {
  return ctx.transaction(async (session) => {
    const exam = await ctx
      .c("examImports")
      .findOne({ _id: examId, ownerId }, { session });
    if (!exam) ctx.fail(404, "آزمون یافت نشد");
    if (exam!.state === "review") return { state: "review" };
    if (!exam!.files?.question) ctx.fail(400, "ابتدا دفترچه را بارگذاری کنید");
    const jobId = ctx.hash(`exam-extract:${examId}:${exam!.revision}`);
    const existing = await ctx
      .c("examImportJobs")
      .findOne({ _id: jobId }, { session });
    if (existing) return existing;
    const job = {
      _id: jobId,
      examId,
      ownerId,
      revision: exam!.revision,
      state: "queued",
      stage: "queued",
      attempts: 0,
      createdAt: ctx.now(),
    };
    await ctx.c("examImportJobs").insertOne(job, { session });
    await ctx
      .c("examImports")
      .updateOne(
        { _id: examId },
        { $set: { state: "processing", jobId } },
        { session },
      );
    return job;
  });
}
async function runLeasedExamJob(ctx: Context) {
  const exhausted = await ctx
    .c("examImportJobs")
    .find({
      state: "running",
      attempts: { $gte: 3 },
      leaseUntil: { $lt: new Date() },
    })
    .toArray();
  for (const job of exhausted) {
    await ctx.c("examImportJobs").updateOne(
      { _id: job._id, state: "running", leaseUntil: { $lt: new Date() } },
      {
        $set: {
          state: "failed",
          stage: "failed",
          errorCode: "RETRY_EXHAUSTED",
          errorMessage: "پردازش پس از سه تلاش متوقف شد",
        },
      },
    );
    await ctx
      .c("examImports")
      .updateOne(
        { _id: job.examId, jobId: job._id, state: "processing" },
        { $set: { state: "failed" } },
      );
  }
  const token = ctx.id();
  const job = await ctx.c("examImportJobs").findOneAndUpdate(
    {
      $or: [
        { state: "queued" },
        { state: "running", leaseUntil: { $lt: new Date() } },
      ],
      attempts: { $lt: 3 },
    },
    {
      $set: {
        state: "running",
        stage: "validation",
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 90000),
      },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  );
  if (!job) return false;
  const temp = await mkdtemp(join(tmpdir(), "hodhod-job-"));
  let stage = "validation";
  const heartbeat = setInterval(() => {
    void ctx
      .c("examImportJobs")
      .updateOne(
        { _id: job._id, leaseToken: token, state: "running" },
        { $set: { stage, leaseUntil: new Date(Date.now() + 90000) } },
      )
      .catch(() => {});
  }, 15000);
  try {
    const exam = await ctx
      .c("examImports")
      .findOne({ _id: job.examId, ownerId: job.ownerId });
    if (!exam || exam.revision !== job.revision)
      throw new Error("Source revision changed");
    const docs: Record<string, DocumentPage[]> = {};
    for (const kind of ["question", "answer"]) {
      if (!exam.files?.[kind]) continue;
      stage = kind === "question" ? "reading_questions" : "reading_key";
      await ctx
        .c("examImportJobs")
        .updateOne({ _id: job._id, leaseToken: token }, { $set: { stage } });
      const dir = join(temp, kind);
      await import("node:fs/promises").then((fs) => fs.mkdir(dir));
      const path = join(dir, "source.pdf");
      await writeFile(path, await sourceBytes(ctx, exam._id, kind), {
        mode: 0o600,
      });
      const progress = setInterval(() => {
        void readFile(join(dir, "progress.json"), "utf8")
          .then(async (text) => {
            const p = JSON.parse(text);
            await ctx.c("examImportJobs").updateOne(
              { _id: job._id, leaseToken: token },
              {
                $set: { stage: `${kind}:${p.stage}`, processedPage: p.page },
              },
            );
          })
          .catch(() => {});
      }, 1000);
      try {
        await exec(
          process.execPath,
          [
            "--max-old-space-size=768",
            "--import",
            "tsx",
            resolve("scripts/extract-document.ts"),
            path,
            dir,
          ],
          {
            timeout: 20 * 60 * 1000,
            maxBuffer: 256 * 1024,
            env: {
              NODE_ENV: process.env.NODE_ENV ?? "production",
              PATH: process.env.PATH,
              OCR_DATA_DIR: process.env.OCR_DATA_DIR,
              OCR_LANG: exam.ocrLanguage ?? "fas",
              TESSERACT_BIN: process.env.TESSERACT_BIN,
              PDFTOPPM_BIN: process.env.PDFTOPPM_BIN,
              OMP_THREAD_LIMIT: "1",
            },
          },
        );
      } finally {
        clearInterval(progress);
      }
      docs[kind] = JSON.parse(await readFile(join(dir, "result.json"), "utf8"));
    }
    stage = "matching";
    const pages = docs.question;
    const sizes = Object.fromEntries(
      pages.map((p) => [p.page, { width: p.width, height: p.height }]),
    );
    const questions = parseQuestions(
      pages.flatMap((p) => p.lines),
      sizes,
    );
    const key = docs.answer
      ? parseAnswerKey(docs.answer.flatMap((p) => p.lines))
      : { entries: [], warnings: ["پاسخ‌نامه بارگذاری نشده است"] };
    const expiresAt = new Date(
      exam.sourceExpiresAt ?? Date.now() + retentionDays() * 86400000,
    );
    // Prepare image data outside the transaction; original rendered pages stay private and expire.
    const prepared: {
      q: ReturnType<typeof parseQuestions>[number];
      match: ReturnType<typeof matchKey>;
      images: { data: Buffer; width: number; height: number }[];
    }[] = [];
    let assetBytes = 0;
    for (const q of questions) {
      const match = matchKey(q, key.entries);
      const images = [];
      for (const region of q.regions.slice(0, 3)) {
        const page = pages.find((p) => p.page === region.page)!;
        const image = await sharp(join(temp, "question", page.imageFile))
          .extract({
            left: Math.floor(region.x),
            top: Math.floor(region.y),
            width: Math.min(
              page.width - Math.floor(region.x),
              Math.ceil(region.width),
            ),
            height: Math.min(
              page.height - Math.floor(region.y),
              Math.ceil(region.height),
            ),
          })
          .png()
          .toBuffer();
        assetBytes += image.length;
        if (assetBytes > 100 * 1024 * 1024)
          throw new Error("Question previews exceed 100 MiB");
        images.push({
          data: image,
          width: Math.floor(region.width),
          height: Math.min(
            page.height - Math.floor(region.y),
            Math.ceil(region.height),
          ),
        });
      }
      prepared.push({ q, match, images });
    }
    await ctx.transaction(async (session) => {
      const lease = await ctx
        .c("examImportJobs")
        .findOne(
          { _id: job._id, leaseToken: token, state: "running" },
          { session },
        );
      if (!lease) throw new Error("Job lease lost");
      const current = await ctx
        .c("examImports")
        .findOne(
          { _id: exam._id, revision: job.revision, state: "processing" },
          { session },
        );
      if (!current) throw new Error("Exam state changed");
      await ctx
        .c("examImportItems")
        .deleteMany({ examId: exam._id, generatedByJob: job._id }, { session });
      await ctx
        .c("examImportPages")
        .deleteMany({ examId: exam._id }, { session });
      for (const kind of Object.keys(docs))
        for (const page of docs[kind])
          await ctx.c("examImportPages").insertOne(
            {
              _id: ctx.id(),
              ownerId: job.ownerId,
              examId: exam._id,
              kind,
              page: page.page,
              width: page.width,
              height: page.height,
              method: page.method,
              milliseconds: page.milliseconds,
              data: new Binary(
                await readFile(join(temp, kind, page.imageFile)),
              ),
              expiresAt,
            },
            { session },
          );
      for (const item of prepared) {
        const iid = ctx.id();
        const visuals = [];
        for (const image of item.images) {
          const aid = ctx.id();
          await ctx.c("examImportPreviewAssets").insertOne(
            {
              _id: aid,
              ownerId: job.ownerId,
              examId: exam._id,
              itemId: iid,
              data: new Binary(image.data),
              width: image.width,
              height: image.height,
              expiresAt,
            },
            { session },
          );
          visuals.push({
            kind: "image",
            assetId: aid,
            width: image.width,
            height: image.height,
            caption: `اصل سؤال ${item.q.number ?? "بدون شماره"}؛ منبع آزمون`,
          });
        }
        const warnings = [...item.q.warnings, ...item.match.warnings];
        const duplicated =
          questions.filter(
            (q) => q.number !== null && q.number === item.q.number,
          ).length > 1;
        if (duplicated && item.match.option !== null) {
          item.match.option = null;
          item.match.status = "needs_review";
          warnings.push("به شماره تکراری کلید متصل نمی‌شود");
        }
        await ctx.c("examImportItems").insertOne(
          {
            _id: iid,
            examId: exam._id,
            ownerId: job.ownerId,
            state: "pending",
            createdAt: ctx.now(),
            generatedByJob: job._id,
            originalNumber: item.q.number,
            extraction: {
              regions: item.q.regions,
              method: item.q.method,
              confidence: item.q.confidence,
              warnings,
              detectedNumber: item.q.number,
              sourceSha256: exam.files.question.sha256,
              sourceFileId:
                exam.files.question.id ?? exam.files.question.sha256,
              engines: pages
                .filter((p) => item.q.regions.some((r) => r.page === p.page))
                .map((p) => p.engine),
              answerMatch: item.match,
              answerSha256: exam.files.answer?.sha256 ?? null,
            },
            question: {
              statement: item.q.statement,
              reference:
                item.match.option === null
                  ? ""
                  : item.q.options[item.match.option - 1],
              type: item.q.options.length === 4 ? "choice" : "essay",
              options: item.q.options,
              hints: [],
              classification: "free",
              visuals,
            },
          },
          { session },
        );
      }
      const unmatched = key.entries.filter(
        (entry) => !questions.some((q) => q.number === entry.number),
      );
      await ctx.c("examImports").updateOne(
        { _id: exam._id },
        {
          $set: {
            state: "review",
            sourceExpiresAt: expiresAt,
            questionText: pages
              .flatMap((p) => p.lines.map((l) => l.text))
              .join("\n")
              .slice(0, 200000),
            answerText: (docs.answer ?? [])
              .flatMap((p) => p.lines.map((l) => l.text))
              .join("\n")
              .slice(0, 200000),
            extractionNotice:
              "استخراج محلی انجام شد؛ هیچ سؤال بدون تأیید معلم وارد بانک نمی‌شود. تصاویر اصل منبع را با متن، گزینه و کلید تطبیق دهید.",
            statistics: {
              pages: pages.length,
              answerPages: docs.answer?.length ?? 0,
              questions: questions.length,
              fourOptions: questions.filter((q) => q.options.length === 4)
                .length,
              keys: key.entries.length,
              matched: prepared.filter((p) => p.match.option !== null).length,
              needsReview: questions.length,
              unmatchedKeys: unmatched,
              keyWarnings: key.warnings,
            },
          },
        },
        { session },
      );
      await ctx.c("examImportJobs").updateOne(
        { _id: job._id, leaseToken: token },
        {
          $set: {
            state: "completed",
            stage: "ready_for_review",
            completedAt: ctx.now(),
          },
          $unset: { leaseToken: "", leaseUntil: "" },
        },
        { session },
      );
    });
  } catch (error) {
    await ctx.c("examImportJobs").updateOne(
      { _id: job._id, leaseToken: token },
      {
        $set: {
          state: "failed",
          stage: "failed",
          errorCode: "DOCUMENT_PROCESSING_FAILED",
          errorMessage:
            "پردازش محلی انجام نشد؛ فایل، نصب ابزار OCR و مدل‌های زبان را بررسی کنید.",
          completedAt: ctx.now(),
        },
        $unset: { leaseToken: "", leaseUntil: "" },
      },
    );
    await ctx
      .c("examImports")
      .updateOne(
        { _id: job.examId, jobId: job._id },
        { $set: { state: "failed" } },
      );
    if (process.env.NODE_ENV === "test")
      console.error(
        error instanceof Error ? error.message : "Processing failed",
      );
  } finally {
    clearInterval(heartbeat);
    await rm(temp, { recursive: true, force: true });
  }
  return true;
}
export async function expireExamSources(ctx: Context) {
  const legacyIds = await ctx
    .c("examImportChunks")
    .distinct("examId", { expiresAt: { $exists: false } });
  for (const examId of legacyIds.slice(0, 1000)) {
    const exam = await ctx.c("examImports").findOne({ _id: examId });
    await ctx
      .c("examImportChunks")
      .updateMany(
        { examId, expiresAt: { $exists: false } },
        {
          $set: {
            expiresAt: new Date(
              new Date(exam?.createdAt ?? 0).getTime() +
                retentionDays() * 86400000,
            ),
          },
        },
      );
  }

  const filter = { expiresAt: { $lte: new Date() } };
  for (const name of [
    "examImportChunks",
    "examImportPages",
    "examImportPreviewAssets",
  ])
    await ctx.c(name).deleteMany(filter);
}

// A database-wide slot bounds concurrency even when several worker processes start.
export async function runNextExamJob(ctx: Context) {
  const token = ctx.id();
  try {
    const slot = await ctx
      .c("workerLeases")
      .findOneAndUpdate(
        { _id: "exam-import-slot", expiresAt: { $lt: new Date() } },
        { $set: { token, expiresAt: new Date(Date.now() + 90000) } },
        { upsert: true, returnDocument: "after" },
      );
    if (slot?.token !== token) return false;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
  const timer = setInterval(() => {
    void ctx
      .c("workerLeases")
      .updateOne(
        { _id: "exam-import-slot", token },
        { $set: { expiresAt: new Date(Date.now() + 90000) } },
      )
      .catch(() => {});
  }, 15000);
  try {
    return await runLeasedExamJob(ctx);
  } finally {
    clearInterval(timer);
    await ctx.c("workerLeases").deleteOne({ _id: "exam-import-slot", token });
  }
}
