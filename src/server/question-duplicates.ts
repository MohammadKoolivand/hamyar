import { createHash } from "node:crypto";
import type { ClientSession } from "mongodb";
import type { Context } from "./context";
import type { Row } from "./db";
import { z } from "zod";

export const QUESTION_FINGERPRINT_VERSION = 1;

export type SimilarQuestion = {
  questionVersionId: string;
  statement: string;
  kind: "exact" | "similar";
  score: number;
};

export type DuplicateInput = {
  statement: string;
  type: string;
  options?: string[];
  visuals?: unknown[];
  optionImages?: unknown[];
};

/** Validate the fields used for fingerprinting when loading untyped MongoDB records. */
const storedDuplicateInput = z.object({
  statement: z.string(),
  type: z.string(),
  options: z.array(z.string()).optional(),
  visuals: z.array(z.unknown()).optional(),
  optionImages: z.array(z.unknown()).optional(),
});

export function duplicateInputFromStoredQuestion(row: Row): DuplicateInput {
  return storedDuplicateInput.parse(row);
}

/** Leave mathematical operators, units, signs, exponent syntax, and image references intact. */
export function normalizeDuplicateText(value: string): string {
  return value.normalize("NFC")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[٠-٩۰-۹]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit) >= 0
        ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
        : "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\u200c\u200d\s]+/g, " ")
    .trim();
}

export function questionFingerprint(input: DuplicateInput) {
  const normalized = {
    version: QUESTION_FINGERPRINT_VERSION,
    statement: normalizeDuplicateText(input.statement),
    type: input.type,
    options: (input.options ?? []).map(normalizeDuplicateText),
    visuals: input.visuals ?? [],
    optionImages: input.optionImages ?? [],
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function tokens(text: string): Set<string> {
  return new Set(normalizeDuplicateText(text).toLowerCase()
    .split(/[^\p{L}\p{N}+*\/^=−-]+/u)
    .filter((v) => v.length > 1));
}

export function lexicalScore(a: string, b: string): number {
  const left = tokens(a), right = tokens(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const part of left) if (right.has(part)) common++;
  return (2 * common) / (left.size + right.size);
}

/** Only previously verified, CURRENT public versions can appear in suggestions.
 * Never include private records or answers/reference material in the response.
 */
export async function findPublicQuestionMatches(
  ctx: Pick<Context, "c">,
  input: DuplicateInput,
  session?: ClientSession,
  excludeQuestionId?: string,
): Promise<SimilarQuestion[]> {
  const fingerprint = questionFingerprint(input);
  const rows = await ctx.c("questions").aggregate<Row>([
    { $lookup: {
      from: "questionVersions",
      localField: "currentVersionId",
      foreignField: "_id",
      as: "version",
    } },
    { $unwind: "$version" },
    { $match: {
      "version.visibility": "public",
      "version.verifiedAt": { $exists: true },
      $expr: { $eq: ["$ownerId", "$version.ownerId"] },
      ...(excludeQuestionId ? { _id: { $ne: excludeQuestionId } } : {}),
    } },
    { $sort: { "version.verifiedAt": -1 } },
    { $limit: 5000 },
    { $project: {
      questionId: "$_id",
      _id: "$version._id",
      statement: "$version.statement",
      type: "$version.type",
      options: "$version.options",
      visuals: "$version.visuals",
      optionImages: "$version.optionImages",
      storedFingerprint: "$version.publicFingerprint",
    } },
  ], { session }).toArray();
  const normalizedText = normalizeDuplicateText(input.statement);
  return rows.flatMap((row: Row): SimilarQuestion[] => {
    const candidate = row as { _id: string; statement: string; type: string;
      options?: string[]; visuals?: unknown[]; optionImages?: unknown[];
      storedFingerprint?: string };
    if (candidate.type !== input.type) return [];
    const isExact = (candidate.storedFingerprint ?? questionFingerprint(candidate)) === fingerprint;
    const score = isExact ? 1 : lexicalScore(normalizedText, candidate.statement);
    if (!isExact && score < 0.65) return [];
    return [{
      questionVersionId: candidate._id,
      statement: candidate.statement,
      kind: isExact ? "exact" as const : "similar" as const,
      score: Math.round(score * 100) / 100,
    }];
  }).sort((a: SimilarQuestion, b: SimilarQuestion) => b.score - a.score).slice(0, 10);
}

/** Transactional unique claim prevents two concurrent new public questions from
 * acquiring the same exact fingerprint. Existing (pre-migration) public data
 * is separately checked against the current-version catalog.
 */
export async function reservePublicQuestionFingerprint(
  ctx: Context,
  input: DuplicateInput,
  questionId: string,
  ownerId: string,
  session: ClientSession,
): Promise<string> {
  const fingerprint = questionFingerprint(input);
  const matches = await findPublicQuestionMatches(ctx, input, session, questionId);
  if (matches.some((match) => match.kind === "exact"))
    ctx.fail(409, "این سؤال قبلاً در بانک عمومی موجود است؛ قبل از ثبت، موارد مشابه را بررسی کنید");
  const existing = await ctx.c("publicQuestionFingerprints").findOne({ _id: fingerprint }, { session });
  if (existing && existing.questionId !== questionId)
    ctx.fail(409, "این سؤال قبلاً برای بانک عمومی ثبت شده است؛ نسخه موجود را بررسی کنید");
  if (!existing) {
    await ctx.c("publicQuestionFingerprints").insertOne({
      _id: fingerprint, questionId, ownerId,
      version: QUESTION_FINGERPRINT_VERSION, createdAt: ctx.now(),
    }, { session });
  }
  return fingerprint;
}
