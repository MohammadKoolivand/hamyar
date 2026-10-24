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
    ["assignments", { missionId: 1, studentId: 1 }],
    ["evaluations", { attemptId: 1 }],
  ] as const)
    await db.collection(name).createIndex(keys, { unique: true });
  await db
    .collection("sessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return { client, db };
}
