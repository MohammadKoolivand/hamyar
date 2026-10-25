import { Binary } from "mongodb";
import { z } from "zod";
import type { Context } from "../context";
import { questionSchema } from "../domain";
import { persistQuestion, validateQuestion } from "../modules/authoring";

export const reviewedSampleSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{8,120}$/),
  question: questionSchema,
  evidence: z.object({
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    answerBasis: z.enum(["published_key", "independent_review"]),
    answerPage: z.number().int().positive().optional(),
    note: z.string().min(10).max(2000),
  }),
  imageFile: z.string().optional(),
});
export type ReviewedSample = z.infer<typeof reviewedSampleSchema> & {
  image?: Buffer;
};

// Local administrative migration, never an HTTP endpoint or an authentication shortcut.
// The caller must explicitly select the teacher and opt in to writes. No sessions are created.
export async function importReviewedSamples(
  ctx: Context,
  ownerId: string,
  entries: ReviewedSample[],
  apply = false,
) {
  if (!entries.length || entries.length > 20)
    throw new Error("Expected 1–20 samples");
  if (new Set(entries.map((e) => e.key)).size !== entries.length)
    throw new Error("Duplicate sample key");
  const prepared = entries.map((entry) => {
    const parsed = reviewedSampleSchema.parse(entry);
    const source = parsed.question.source;
    if (!source?.sourceUrl || !source.sourcePageUrl || !source.sourcePage)
      throw new Error("Each sample needs a source file, article and PDF page");
    for (const url of [source.sourceUrl, source.sourcePageUrl]) {
      const hostname = new URL(url).hostname;
      if (hostname !== "konkur.in" && !hostname.endsWith(".konkur.in"))
        throw new Error("Only reviewed konkur.in sources are supported");
    }
    if (parsed.question.visuals?.length)
      throw new Error("Supply an original PNG instead of existing assets");
    let dimensions: { width: number; height: number } | undefined;
    if (entry.image) {
      const png = entry.image;
      if (
        png.length < 33 ||
        png.length > 4 * 1024 * 1024 ||
        !png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
        png.toString("ascii", 12, 16) !== "IHDR"
      )
        throw new Error("Invalid PNG");
      dimensions = {
        width: png.readUInt32BE(16),
        height: png.readUInt32BE(20),
      };
      if (Object.values(dimensions).some((n) => n < 1 || n > 4096))
        throw new Error("Invalid PNG dimensions");
    }
    return {
      ...parsed,
      image: entry.image,
      dimensions,
      operationId: ctx.hash(
        JSON.stringify([ownerId, "reviewed-source-sample", parsed.key]),
      ),
      requestHash: ctx.hash(
        JSON.stringify([
          parsed,
          entry.image ? ctx.hash(entry.image.toString("base64")) : null,
        ]),
      ),
    };
  });
  return ctx.transaction(async (session) => {
    const owner = await ctx
      .c("users")
      .findOne({ _id: ownerId, role: "teacher" }, { session });
    if (!owner)
      throw new Error("The selected owner must be an existing teacher");
    const results = [];
    for (const entry of prepared) {
      const previous = await ctx
        .c("operations")
        .findOne({ _id: entry.operationId }, { session });
      if (previous) {
        if (previous.requestHash !== entry.requestHash)
          throw new Error("Previously imported sample has changed");
        results.push({
          key: entry.key,
          status: "existing",
          ...previous.response,
        });
        continue;
      }
      await validateQuestion(ctx, ownerId, entry.question);
      if (!apply) {
        results.push({ key: entry.key, status: "ready" });
        continue;
      }
      const question = { ...entry.question };
      if (entry.image && entry.dimensions) {
        const assetId = ctx.id();
        await ctx.c("questionAssets").insertOne(
          {
            _id: assetId,
            ownerId,
            data: new Binary(entry.image),
            ...entry.dimensions,
            createdAt: ctx.now(),
            sourceImportKey: entry.key,
          },
          { session },
        );
        question.visuals = [
          {
            kind: "image",
            assetId,
            ...entry.dimensions,
            caption: `اصل سؤال از منبع؛ صفحهٔ ${question.source!.sourcePage}`,
          },
        ];
      }
      const row = await persistQuestion(ctx, ownerId, question, session, {
        origin: "human",
        importEvidence: entry.evidence,
        sourceImportKey: entry.key,
        reviewMethod: "document_and_answer_review",
      });
      const response = { questionId: row.questionId, versionId: row._id };
      await ctx.c("operations").insertOne(
        {
          _id: entry.operationId,
          actorId: ownerId,
          scope: "reviewed-source-sample",
          requestHash: entry.requestHash,
          response,
          createdAt: ctx.now(),
        },
        { session },
      );
      await ctx.c("auditLogs").insertOne(
        {
          _id: ctx.id(),
          actorId: ownerId,
          action: "authorized-source-sample-import",
          resourceId: row.questionId,
          sourceImportKey: entry.key,
          createdAt: ctx.now(),
        },
        { session },
      );
      results.push({ key: entry.key, status: "imported", ...response });
    }
    return results;
  });
}
