import { MongoClient, type Db, type Document } from "mongodb";
export type Row = Document & { _id: string; reviews?: Document[] };
export const collection = (db: Db, name: string) => db.collection<Row>(name);
export async function connect(
  url = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
  name = process.env.MONGO_DB ?? "hamyar",
) {
  const client = new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(name);
  for (const [name, keys] of [
    ["users", { email: 1 }],
    ["sessions", { tokenHash: 1 }],
    ["invitations", { tokenHash: 1 }],
    ["relations", { teacherId: 1, studentId: 1 }],
    ["enrollments", { courseId: 1, studentId: 1 }],
    ["parentLinks", { parentId: 1, studentId: 1, teacherId: 1 }],
    ["assignments", { missionId: 1, studentId: 1 }],
    ["evaluations", { attemptId: 1 }],
    ["hintReports", { hintId: 1, studentId: 1 }],
  ] as const)
    await db.collection(name).createIndex(keys, { unique: true });
  await db.collection("courseJoinCodes").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection("courseJoinCodes").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("courseRequests").createIndex({ courseId: 1, studentId: 1 }, { unique: true });
  await db.collection("courseRequests").createIndex({ teacherId: 1, status: 1, updatedAt: -1 });
  await db.collection("courseRequests").createIndex({ studentId: 1, updatedAt: -1 });
  await db.collection("classGroups").createIndex({ teacherId: 1, courseId: 1 });
  await db.collection("groupTasks").createIndex({ teacherId: 1, groupId: 1, createdAt: -1 });
  await db.collection("assignments").createIndex({ groupTaskId: 1, studentId: 1 });
  await db.collection("courses").createIndex({ teacherId: 1, status: 1 });
  await db.collection("enrollments").createIndex({ teacherId: 1, studentId: 1, status: 1 });
  await db.collection("enrollments").createIndex({ studentId: 1, status: 1 });
  await db
    .collection("sessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  // Additive indexes: existing question versions, assignments and evidence stay unchanged.
  await db
    .collection("attempts")
    .createIndex(
      { assignmentId: 1, questionVersionId: 1, sequence: 1 },
      { unique: true },
    );
  await db
    .collection("hintEvents")
    .createIndex(
      { assignmentId: 1, questionVersionId: 1, level: 1 },
      { unique: true },
    );
  for (const name of [
    "learningEvidence",
    "mistakeRecords",
    "masteryRecords",
    "masteryOverrides",
  ])
    await db.collection(name).createIndex({ studentId: 1, teacherId: 1 });
  await db
    .collection("questionDrafts")
    .createIndex({ ownerId: 1, state: 1, createdAt: -1 });
  return { client, db };
}
