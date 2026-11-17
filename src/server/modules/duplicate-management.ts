import type { FastifyInstance } from "fastify";
import type { ClientSession } from "mongodb";
import { z } from "zod";
import type { Context } from "../context";
import { lexicalScore, normalizeDuplicateText, questionFingerprint } from "../question-duplicates";

type Candidate = {
  questionId: string; versionId: string; ownerId: string; statement: string;
  type: string; options: string[]; visuals: unknown[]; optionImages: unknown[];
  source?: unknown; difficulty?: string; fingerprint: string;
};
type Group = { id: string; kind: "exact" | "similar"; score: number; questions: Candidate[] };
const uuid = z.string().uuid();
const publicVersion = {
  "version.visibility": "public",
  "version.verifiedAt": { $exists: true },
  archivedAt: { $exists: false },
  $expr: { $eq: ["$ownerId", "$version.ownerId"] },
};

/** Only current, verified public versions; do not send answers or private data. */
async function listCandidates(ctx: Context, session?: ClientSession): Promise<Candidate[]> {
  const rows = await ctx.c("questions").aggregate([
    { $lookup: { from: "questionVersions", localField: "currentVersionId", foreignField: "_id", as: "version" } },
    { $unwind: "$version" },
    { $match: publicVersion },
    { $project: { _id: 1, ownerId: 1, version: {
      _id: 1, statement: 1, type: 1, options: 1, visuals: 1,
      optionImages: 1, source: 1, difficulty: 1,
    } } },
  ], { session }).toArray();
  return rows.flatMap((row): Candidate[] => {
    const version = row.version;
    if (typeof version?.statement !== "string" || typeof version?.type !== "string") return [];
    const options = Array.isArray(version.options) ? version.options.filter((v: unknown): v is string => typeof v === "string") : [];
    const visuals = Array.isArray(version.visuals) ? version.visuals : [];
    const optionImages = Array.isArray(version.optionImages) ? version.optionImages : [];
    return [{
      questionId: row._id, versionId: version._id, ownerId: row.ownerId,
      statement: version.statement, type: version.type,
      options, visuals, optionImages, source: version.source,
      difficulty: version.difficulty,
      fingerprint: questionFingerprint({ statement: version.statement, type: version.type, options, visuals, optionImages }),
    }];
  });
}

/** Exact groups are hash-based; similar groups are review suggestions, never auto-merged. */
export function groupDuplicateQuestions(rows: Candidate[]): Group[] {
  const exact = new Map<string, Candidate[]>();
  for (const row of rows) {
    const key = row.fingerprint;
    exact.set(key, [...(exact.get(key) ?? []), row]);
  }
  const result: Group[] = [];
  for (const [key, candidates] of exact)
    if (candidates.length > 1)
      result.push({ id: "exact:" + key, kind: "exact", score: 1, questions: candidates });

  // Inverted index avoids testing every pair across unrelated subjects.
  const tokensById = new Map(rows.map((r) => [
    r.questionId,
    new Set(normalizeDuplicateText(r.statement).toLowerCase().split(new RegExp(String.raw`[^\p{L}\p{N}+*/^=−-]+`, "u")).filter((t) => t.length > 1)),
  ]));
  const postings = new Map<string, Candidate[]>();
  const evaluated = new Set<string>();
  for (const row of rows) {
    const tokens = tokensById.get(row.questionId)!;
    const possible = new Map<string, Candidate>();
    for (const token of tokens)
      for (const candidate of postings.get(row.type + ":" + token) ?? [])
        possible.set(candidate.questionId, candidate);
    for (const other of possible.values()) {
      if (row.fingerprint === other.fingerprint) continue;
      const ids = [row.questionId, other.questionId].sort();
      const pair = ids.join(":");
      if (evaluated.has(pair)) continue;
      evaluated.add(pair);
      const score = lexicalScore(row.statement, other.statement);
      if (score < 0.82) continue;
      // Different answer choices or images are only suggestions; never call them exact.
      result.push({ id: "similar:" + pair, kind: "similar",
        score: Math.round(score * 100) / 100, questions: [other, row] });
    }
    for (const token of tokens) {
      const key = row.type + ":" + token;
      postings.set(key, [...(postings.get(key) ?? []), row]);
    }
  }
  return result.sort((a, b) => (a.kind === b.kind ? b.score - a.score : a.kind === "exact" ? -1 : 1));
}

export function registerDuplicateManagement(app: FastifyInstance, ctx: Context) {
  app.get("/api/admin/duplicate-questions", async (request, reply) => {
    await ctx.user(request, "super_admin");
    reply.header("Cache-Control", "private, no-store");
    const candidates = await listCandidates(ctx);
    const groups = groupDuplicateQuestions(candidates);
    return { groups, totalGroups: groups.length, totalQuestions: candidates.length };
  });

  const actionSchema = z.object({
    action: z.enum(["merge", "delete"]),
    survivorId: uuid.optional(),
    duplicateIds: z.array(uuid).min(1).max(100),
    expectedVersionIds: z.record(uuid, uuid),
    confirmation: z.literal("CONFIRM"),
  }).strict().superRefine((value, issue) => {
    if (value.action === "merge" && !value.survivorId)
      issue.addIssue({ code: "custom", message: "سؤال اصلی را مشخص کنید" });
    if (value.survivorId && value.duplicateIds.includes(value.survivorId))
      issue.addIssue({ code: "custom", message: "سؤال اصلی نباید حذف شود" });
    if (new Set(value.duplicateIds).size !== value.duplicateIds.length)
      issue.addIssue({ code: "custom", message: "شناسه‌های تکراری مجاز نیست" });
  });

  app.post("/api/admin/duplicate-questions/resolve", async (request) => {
    const admin = await ctx.user(request, "super_admin");
    const input = actionSchema.parse(request.body);
    // The archive is reversible, keeps historic versions/foreign keys intact,
    // and removes duplicates from active public discovery.
    return ctx.atomic(request, admin._id, "resolve-duplicate-questions", input, async (session) => {
      const ids = [...input.duplicateIds, ...(input.survivorId ? [input.survivorId] : [])];
      const candidates = (await listCandidates(ctx, session)).filter((row) => ids.includes(row.questionId));
      if (candidates.length !== ids.length) ctx.fail(409, "یکی از سؤال‌ها تغییر کرده یا عمومی نیست");
      for (const row of candidates) {
        if (input.expectedVersionIds[row.questionId] !== row.versionId)
          ctx.fail(409, "نسخه سؤال تغییر کرده است؛ فهرست را دوباره بارگیری کنید");
      }
      const survivor = candidates.find((row) => row.questionId === input.survivorId);
      const duplicates = candidates.filter((row) => input.duplicateIds.includes(row.questionId));
      if (input.action === "merge") {
        if (!survivor) ctx.fail(400, "سؤال اصلی معتبر نیست");
        if (duplicates.some((row) => row.fingerprint !== survivor.fingerprint))
          ctx.fail(409, "ادغام فقط برای سؤال‌های کاملاً یکسان مجاز است؛ مشابه‌ها را جداگانه بررسی کنید");
      }
      const at = ctx.now();
      for (const duplicate of duplicates) {
        const updated = await ctx.c("questions").updateOne({
          _id: duplicate.questionId, currentVersionId: duplicate.versionId,
          archivedAt: { $exists: false },
        }, { $set: {
          archivedAt: at, archivedBy: admin._id, archiveReason: "duplicate",
          ...(survivor ? { mergedIntoQuestionId: survivor.questionId } : {}),
        } }, { session });
        if (updated.modifiedCount !== 1) ctx.fail(409, "سؤال در حین عملیات تغییر کرد");
        // If an archived row owns the uniqueness claim, move it to a
        // remaining active identical question instead of freeing the hash.
        const replacement = candidates.find((row) =>
          row.fingerprint === duplicate.fingerprint &&
          !input.duplicateIds.includes(row.questionId));
        if (replacement) {
          await ctx.c("publicQuestionFingerprints").updateOne({
            _id: duplicate.fingerprint, questionId: duplicate.questionId,
          }, { $set: { questionId: replacement.questionId, ownerId: replacement.ownerId } }, { session });
        } else {
          await ctx.c("publicQuestionFingerprints").deleteOne({
            _id: duplicate.fingerprint, questionId: duplicate.questionId,
          }, { session });
        }
        await ctx.c("auditLogs").insertOne({
          _id: ctx.id(), actorId: admin._id, action: input.action === "merge" ? "archive_duplicate_merge" : "archive_duplicate_delete",
          resourceId: duplicate.questionId, survivorId: survivor?.questionId,
          versionId: duplicate.versionId, createdAt: at,
        }, { session });
      }
      return { archived: duplicates.length, survivorId: survivor?.questionId ?? null };
    });
  });
}
