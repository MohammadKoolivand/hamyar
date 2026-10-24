/** Read-only audit: never invent or silently renumber legacy educational evidence. */
import { collection } from "../src/server/db";
import { MongoClient } from "mongodb";
const client = new MongoClient(
  process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
);
await client.connect();
const db = client.db(process.env.MONGO_DB ?? "hamyar");
let failures = 0;
try {
  for await (const a of collection(db, "assignments").find({})) {
    const attempts = await collection(db, "attempts")
        .find({ assignmentId: a._id })
        .toArray(),
      evaluations = await collection(db, "evaluations")
        .find({ assignmentId: a._id })
        .toArray(),
      hints = await collection(db, "hintEvents")
        .find({ assignmentId: a._id })
        .toArray();
    const issues: string[] = [];
    for (const q of a.questionVersionIds) {
      if (
        a.progress[q].attempts !==
        attempts.filter((t) => t.questionVersionId === q).length
      )
        issues.push("attempt quota mismatch:" + q);
      if (
        a.progress[q].hints !==
        hints.filter((h) => h.questionVersionId === q).length
      )
        issues.push("hint quota mismatch:" + q);
    }
    if (attempts.some((t) => !evaluations.some((e) => e.attemptId === t._id)))
      issues.push("missing evaluation");
    if (issues.length) {
      failures++;
      console.log(JSON.stringify({ assignmentId: a._id, issues }));
    }
  }
  console.log(JSON.stringify({ assignmentsNeedingReview: failures }));
  process.exitCode = failures ? 1 : 0;
} finally {
  await client.close();
}
