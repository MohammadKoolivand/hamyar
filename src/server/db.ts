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
  // Convert the legacy unique email index to sparse so phone-only accounts coexist.
  const userIndexes = await db
    .collection("users")
    .listIndexes()
    .toArray()
    .catch((e) => {
      if (e.code === 26) return [];
      throw e;
    });
  const emailIndex = userIndexes.find((i) => i.name === "email_1");
  if (emailIndex && !emailIndex.sparse)
    await db.collection("users").dropIndex("email_1");
  await db
    .collection("users")
    .createIndex({ email: 1 }, { unique: true, sparse: true });
  await db
    .collection("users")
    .createIndex({ phone: 1 }, { unique: true, sparse: true });
  for (const [name, keys] of [
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
  await db
    .collection("courseJoinCodes")
    .createIndex({ tokenHash: 1 }, { unique: true });
  await db
    .collection("courseJoinCodes")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("courseRequests")
    .createIndex({ courseId: 1, studentId: 1 }, { unique: true });
  await db
    .collection("courseRequests")
    .createIndex({ teacherId: 1, status: 1, updatedAt: -1 });
  await db
    .collection("courseRequests")
    .createIndex({ studentId: 1, updatedAt: -1 });
  await db.collection("classGroups").createIndex({ teacherId: 1, courseId: 1 });
  await db
    .collection("groupTasks")
    .createIndex({ teacherId: 1, groupId: 1, createdAt: -1 });
  await db
    .collection("assignments")
    .createIndex({ groupTaskId: 1, studentId: 1 });
  await db.collection("learningEvidence").createIndex({
    teacherId: 1,
    studentId: 1,
    assignmentId: 1,
    createdAt: -1,
  });
  await db.collection("courses").createIndex({ teacherId: 1, status: 1 });
  await db
    .collection("enrollments")
    .createIndex({ teacherId: 1, studentId: 1, status: 1 });
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
  await db.collection("examImports").createIndex({ ownerId: 1, createdAt: -1 });
  await db
    .collection("examImportItems")
    .createIndex({ examId: 1, ownerId: 1, state: 1 });
  await db
    .collection("examImportChunks")
    .createIndex({ examId: 1, kind: 1, position: 1 }, { unique: true });
  for (const name of [
    "examImportChunks",
    "examImportPages",
    "examImportPreviewAssets",
  ])
    await db
      .collection(name)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("examImportJobs")
    .createIndex({ state: 1, leaseUntil: 1, createdAt: 1 });
  await db
    .collection("staffAssignments")
    .createIndex({ secretaryId: 1, teacherId: 1 }, { unique: true });
  return { client, db };
}
