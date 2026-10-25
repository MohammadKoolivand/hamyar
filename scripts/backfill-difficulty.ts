import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { estimateDifficulty } from "../src/lib/difficulty";
const apply = process.argv.includes("--apply");
if (process.argv.slice(2).some((a) => a !== "--apply"))
  throw new Error("Only --apply is supported");
const client = new MongoClient(
  process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
);
try {
  await client.connect();
  const db = client.db(process.env.MONGO_DB ?? "hamyar");
  const rows = await db
    .collection("questionVersions")
    .find({ $or: [{ difficulty: { $exists: false } }, { difficulty: null }] })
    .toArray();
  const counts = { easy: 0, medium: 0, hard: 0 };
  const decisions = rows.map((q) => {
    const assessment = estimateDifficulty({
      statement: q.statement,
      type: q.type,
      skillIds: q.skillIds,
      visuals: q.visuals,
    });
    counts[assessment.difficulty]++;
    return { id: q._id, ownerId: q.ownerId, ...assessment };
  });
  if (apply && decisions.length) {
    await client.withSession((session) =>
      session.withTransaction(async () => {
        for (const q of decisions) {
          await db
            .collection("questionVersions")
            .updateOne(
              {
                _id: q.id,
                $or: [{ difficulty: { $exists: false } }, { difficulty: null }],
              },
              {
                $set: {
                  difficulty: q.difficulty,
                  difficultyAssessment: {
                    ...q.difficultyAssessment,
                    assessedAt: new Date().toISOString(),
                  },
                },
              },
              { session },
            );
        }
        await db
          .collection("auditLogs")
          .insertOne(
            {
              _id: randomUUID() as never,
              actorId: "operator",
              action: "backfill_difficulty_heuristic_v1",
              counts,
              total: decisions.length,
              createdAt: new Date().toISOString(),
            },
            { session },
          );
      }),
    );
  }
  console.log(
    JSON.stringify({
      mode: apply ? "applied" : "dry-run",
      missingVersions: rows.length,
      counts,
      note: "Initial rule-based estimates, all require teacher review. Existing difficulty preserved.",
    }),
  );
} finally {
  await client.close();
}
