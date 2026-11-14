/**
 * One-time controlled publication of CURRENT VERIFIED private question versions.
 * Default mode only counts candidates. To apply, pause all app writers and
 * verify an external MongoDB backup; then use --apply --backup-confirmed.
 * Does not change question drafts, historical versions, answer keys, or users.
 */
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2);
if (args.some((a) => !["--dry-run", "--apply", "--backup-confirmed"].includes(a)))
  throw new Error("USAGE: [--dry-run] OR --apply --backup-confirmed");
const apply = args.includes("--apply");
if (apply && args.includes("--dry-run")) throw new Error("CONFLICTING_MODE");
if (!apply && args.includes("--backup-confirmed")) throw new Error("BACKUP_FLAG_REQUIRES_APPLY");
if (apply && (!args.includes("--backup-confirmed") || process.env.WRITES_PAUSED !== "true"))
  throw new Error("APPLY_REQUIRES_VERIFIED_BACKUP_AND_PAUSED_WRITERS");
const uri = process.env.MONGO_URL;
const name = process.env.MONGO_DB;
const expected = process.env.HODHOD_EXPECTED_DB;
if (!uri?.startsWith("mongodb://") && !uri?.startsWith("mongodb+srv://"))
  throw new Error("MONGO_URL_REQUIRED");
if (!/^[\w-]{1,63}$/.test(name ?? "") || name !== expected)
  throw new Error("EXPECTED_DATABASE_MISMATCH");

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  readPreference: "primary",
});
const stages = [
  { $lookup: { from: "questionVersions", localField: "currentVersionId",
      foreignField: "_id", as: "version" } },
  { $unwind: "$version" },
  { $match: {
    "version.visibility": "private",
    "version.verifiedAt": { $exists: true, $ne: null },
    $expr: { $and: [
      { $eq: ["$ownerId", "$version.ownerId"] },
      { $eq: ["$_id", "$version.questionId"] },
    ] },
  } },
  { $project: { _id: 1, ownerId: 1, currentVersionId: 1 } },
];

try {
  await client.connect();
  const db = client.db(name);
  const questions = db.collection("questions");
  const versions = db.collection("questionVersions");
  const eligible = await questions.aggregate(stages).toArray();
  const summary = { mode: apply ? "apply" : "dry-run",
    eligible: eligible.length, modified: 0, skipped: 0 };
  if (apply) {
    // The operator must stop ALL writers. Each transaction rechecks the
    // current pointer and the verified-private version before changing it.
    for (const q of eligible) {
      const session = client.startSession();
      try {
        let modified = 0;
        await session.withTransaction(async () => {
          const live = await questions.findOne({
            _id: q._id, ownerId: q.ownerId, currentVersionId: q.currentVersionId,
          }, { session, projection: { _id: 1 } });
          if (!live) return;
          const result = await versions.updateOne({
            _id: q.currentVersionId,
            questionId: q._id,
            ownerId: q.ownerId,
            visibility: "private",
            verifiedAt: { $exists: true, $ne: null },
          }, { $set: { visibility: "public" } }, { session });
          modified = result.modifiedCount;
        }, { readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" } });
        summary.modified += modified;
        summary.skipped += modified === 0 ? 1 : 0;
      } finally {
        await session.endSession();
      }
    }
    await db.collection("auditLogs").insertOne({
      _id: randomUUID(), actorId: "system:one-time-migration",
      action: "bulk_publish_verified_current_questions",
      resourceId: "questionVersions", count: summary.modified,
      considered: summary.eligible, skipped: summary.skipped,
      createdAt: new Date(),
    });
    summary.remainingEligible = await questions.aggregate([
      ...stages, { $count: "n" },
    ]).next().then((x) => x?.n ?? 0);
  }
  console.log(JSON.stringify(summary, null, 2));
} catch {
  // Never print MongoDB driver error text (which could contain credentials).
  console.error("ONE_TIME_PUBLICATION_FAILED; inspect secured server logs");
  process.exitCode = 1;
} finally {
  await client.close();
}
