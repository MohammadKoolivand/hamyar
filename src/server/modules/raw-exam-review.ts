import { createHash } from "node:crypto";
import { Binary } from "mongodb";
import sharp from "sharp";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stableId = (value: string) => {
  const h = digest(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const importItemSchema = z.object({
  number: z.number().int().min(57).max(185),
  state: z.literal("pending"),
  subject: z.enum(["فیزیک", "شیمی", "ریاضی", "زمین‌شناسی", "بهیاری"]),
  statement: z.string().min(3).max(5000),
  suggestedTopic: z.string().min(2).max(300),
  correctOption: z.number().int().min(1).max(4),
  extractedTextForReview: z.string().max(15000).optional(),
  warnings: z.array(z.string().max(300)).max(20).default([]),
  imageBase64: z.string().min(50).max(400000),
  source: z.object({
    sourcePage: z.number().int().min(1).max(36),
    bookletNumber: z.number().int().min(2).max(4),
    sourceFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).passthrough(),
}).passthrough();
export const rawReviewPayloadSchema = z.object({
  format: z.literal("hamyar-raw-review-v1"),
  items: z.array(importItemSchema).length(129),
}).strict();
const subjectFor = (number: number) =>
  number <= 75 ? "فیزیک" :
  number <= 110 ? "شیمی" :
  number <= 140 ? "ریاضی" :
  number <= 155 ? "زمین‌شناسی" : "بهیاری";
const bookletFor = (number: number) => number <= 110 ? 2 : number <= 155 ? 3 : 4;

export function registerRawExamReviewImport(app: FastifyInstance, ctx: Context) {
  app.post("/api/admin/exam-imports/raw-review", {
    bodyLimit: 12 * 1024 * 1024,
    config: { rateLimit: { max: 2, timeWindow: "1 hour" } },
  }, async (request) => {
    const admin = await ctx.user(request, "super_admin");
    const payload = rawReviewPayloadSchema.parse(request.body);
    const sorted = [...payload.items].sort((a, b) => a.number - b.number);
    if (sorted.some((item, index) => item.number !== index + 57 ||
      item.subject !== subjectFor(item.number) ||
      item.source.bookletNumber !== bookletFor(item.number)))
      return ctx.fail(400, "شماره، درس یا دفترچه در بستهٔ خام تطبیق ندارد");
    if (new Set(sorted.map((item) => item.source.sourceFileSha256)).size !== 1)
      return ctx.fail(400, "منبع PDF سؤال‌ها یکسان نیست");
    const fingerprint = sorted[0].source.sourceFileSha256;
    const packageId = stableId(`hamyar:experimental:1405:review:${fingerprint}:57-185`);
    const createdAt = ctx.now();
    const prepared = [];
    // Validate all images before any database write.
    for (const item of sorted) {
      const data = Buffer.from(item.imageBase64, "base64");
      if (data.length > 300000 || !data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
        return ctx.fail(400, `تصویر سؤال ${item.number} فایل PNG معتبر نیست`);
      const meta = await sharp(data, { limitInputPixels: 12_000_000 }).metadata();
      if (!meta.width || !meta.height)
        return ctx.fail(400, `ابعاد تصویر سؤال ${item.number} مشخص نیست`);
      prepared.push({ item, data, width: meta.width, height: meta.height });
    }
    const previous = await ctx.c("examImports").findOne({ _id: packageId });
    if (previous && (previous.ownerId !== admin._id || previous.importFingerprint !== fingerprint))
      return ctx.fail(409, "بستهٔ ورودی با رکورد موجود تداخل دارد");
    if (!previous) await ctx.c("examImports").insertOne({
      _id: packageId, ownerId: admin._id,
      title: "کنکور تجربی ۱۴۰۵ — سؤالات ۵۷ تا ۱۸۵ (ورود خام)",
      subject: "فیزیک، شیمی، ریاضی، زمین‌شناسی و ویژه بهیاری",
      grade: "دهم تا دوازدهم", track: "علوم تجربی", year: 1405,
      source: { family: "konkur", group: "experimental",
        sourceTitle: "آزمون اختصاصی سراسری و پذیرش دانشجو معلم ۱۴۰۵ — علوم تجربی" },
      categoryIds: [], files: {}, revision: 0, createdAt,
      state: "review", importFingerprint: fingerprint,
      extractionNotice: "ورود خام ۱۲۹ سؤال از فایل ارائه‌شده؛ تصویر اصل سؤال، کلید و مبحث پیشنهادی برای بازبینی نگهداری شده است. هیچ سؤالی تأیید یا منتشر نشده است.",
      statistics: {
        pages: 36, answerPages: 2, questions: 129, fourOptions: 129, keys: 129,
        matched: 129, needsReview: 129, unmatchedKeys: [], keyWarnings: [],
        expectedQuestionCount: 129, expectedCountConfidence: "key_complete",
      },
    });
    let added = 0;
    for (const {item, data, width, height} of prepared) {
      const assetId = stableId(`${packageId}:asset:${item.number}`);
      const itemId = stableId(`${packageId}:item:${item.number}`);
      const imageHash = digest(data);
      const existingAsset = await ctx.c("questionAssets").findOne({ _id: assetId });
      if (existingAsset && (existingAsset.ownerId !== admin._id || existingAsset.sha256 !== imageHash))
        return ctx.fail(409, `تصویر سؤال ${item.number} با نسخهٔ قبلی متفاوت است`);
      await ctx.c("questionAssets").updateOne({ _id: assetId }, { $setOnInsert: {
        ownerId: admin._id, data: new Binary(data), width, height,
        mime: "image/png", sha256: imageHash, sourceExamId: packageId,
        page: item.source.sourcePage, number: item.number, createdAt,
      } }, { upsert: true });
      const existing = await ctx.c("examImportItems").findOne({ _id: itemId });
      if (existing && (existing.ownerId !== admin._id || existing.examId !== packageId))
        return ctx.fail(409, "تداخل شناسهٔ پیش‌نویس");
      if (existing) continue; // Never overwrite a reviewed or edited item.
      const options = ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"];
      await ctx.c("examImportItems").updateOne({ _id: itemId }, { $setOnInsert: {
        examId: packageId, ownerId: admin._id, state: "pending", createdAt,
        originalNumber: item.number,
        question: {
          statement: item.statement, reference: options[item.correctOption - 1],
          type: "choice", options, hints: [], classification: "free",
          visuals: [{kind: "image", assetId, width, height,
            caption: `اصل سؤال ${item.number} کنکور تجربی ۱۴۰۵` }],
        },
        suggestedTopic: item.suggestedTopic,
        topicAssignmentStatus: "needs_curriculum_id_review",
        rawSource: item.source,
        rawAnswerSource: item.answerSource ?? null,
        rawKeyOption: item.correctOption,
        rawReviewWarnings: item.warnings,
        extractedTextForReview: item.extractedTextForReview ?? "",
        extraction: {
          detectedNumber: item.number,
          regions: [{ page: item.source.sourcePage, x: 0, y: 0, width: 1, height: 1 }],
          method: "user_supplied_raw_review",
          confidence: null,
          warnings: [...item.warnings, `مبحث پیشنهادی: ${item.suggestedTopic} — انتخاب مبحث از برنامه درسی الزامی است`],
          answerMatch: {
            status: "matched", option: item.correctOption,
            matches: [{page: item.source.bookletNumber === 4 ? 2 : 1,
              number: item.number, option: item.correctOption}], warnings: [],
          },
        },
      } }, { upsert: true });
      added++;
    }
    await ctx.c("auditLogs").insertOne({
      _id: ctx.id(), actorId: admin._id, action: "raw_exam_review_import",
      resourceId: packageId, count: sorted.length, added, createdAt: ctx.now(),
    });
    return { examId: packageId, total: sorted.length, added,
      skipped: sorted.length - added, state: "review" };
  });
}
