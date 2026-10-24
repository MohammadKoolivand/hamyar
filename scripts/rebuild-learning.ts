/** Additive, idempotent backfill from canonical attempts/evaluations. Stop application writes first. */
import { connect, collection } from "../src/server/db";
import { createContext } from "../src/server/context";
import { requireTransactions } from "../src/server/transactions";
import { recordLearning } from "../src/server/learning/service";
const { client, db } = await connect();
await requireTransactions(db);
const ctx = createContext(db);
let total = 0;
try {
  for await (const attempt of collection(db, "attempts")
    .find({})
    .sort({ createdAt: 1 })) {
    await ctx.transaction(async (session) => {
      const a = await collection(db, "assignments").findOne(
          { _id: attempt.assignmentId },
          { session },
        ),
        q = await collection(db, "questionVersions").findOne(
          { _id: attempt.questionVersionId },
          { session },
        ),
        e = await collection(db, "evaluations").findOne(
          { attemptId: attempt._id },
          { session },
        );
      if (!a || !q || !e)
        throw new Error("Missing canonical source; run integrity audit");
      await recordLearning(ctx, a, q, attempt, e, session);
    });
    total++;
  }
  console.log(JSON.stringify({ backfilled: total }));
} finally {
  await client.close();
}
