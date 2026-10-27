// Synthetic five-role demo identities. Never run against real student data.
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { roleSchema } from "../src/lib/access";

const fixtureTag = "hodhod-local-demo-users-v1";
const database = process.env.MONGO_DB ?? "";
const connection = process.env.MONGO_URL ?? "";
const origin = process.env.APP_ORIGIN ?? "";
function isLocal(url: string, protocol: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === protocol && ["127.0.0.1", "localhost"].includes(parsed.hostname);
  } catch { return false; }
}
if (
  process.env.NODE_ENV !== "development" ||
  process.env.HODHOD_DEMO_SEED_CONFIRM !== "true" ||
  !/^(hodhodeh_dev|hodhod_dev|hamyar_dev)(?:_[a-z0-9_-]+)?$/.test(database) ||
  !isLocal(connection, "mongodb:") ||
  !isLocal(origin, "http:")
) throw new Error("Refusing to seed: use an explicitly confirmed, loopback-only development database and web origin.");

export const sampleUsers = [
  { name: "مدیر آزمایشی هدهد", role: "super_admin", phone: "09000000001" },
  { name: "معلم اول آزمایشی", role: "teacher", phone: "09000000002" },
  { name: "معلم دوم آزمایشی", role: "teacher", phone: "09000000003" },
  { name: "دانش‌آموز اول آزمایشی", role: "student", phone: "09000000004" },
  { name: "دانش‌آموز دوم آزمایشی", role: "student", phone: "09000000005" },
  { name: "دانش‌آموز سوم آزمایشی", role: "student", phone: "09000000006" },
  { name: "والد آزمایشی", role: "parent", phone: "09000000007" },
  { name: "منشی آزمایشی", role: "secretary", phone: "09000000008" },
] as const;

const client = new MongoClient(connection, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const users = client.db(database).collection("users");
  // Validate the entire set before writing anything. Never adopt/promote an existing account.
  for (const entry of sampleUsers) {
    roleSchema.parse(entry.role);
    const existing = await users.findOne({ phone: entry.phone });
    if (existing && (existing.demoFixtureTag !== fixtureTag || existing.role !== entry.role))
      throw new Error(`Refusing to reuse an existing user for ${entry.phone}; no role or identity was changed.`);
  }
  for (const entry of sampleUsers) {
    await users.updateOne(
      { phone: entry.phone, demoFixtureTag: fixtureTag, role: entry.role },
      { $setOnInsert: {
        _id: randomUUID(), ...entry, demoFixtureTag: fixtureTag,
        phoneVerified: false, createdAt: new Date().toISOString(),
      } },
      { upsert: true },
    );
  }
  const count = await users.countDocuments({ demoFixtureTag: fixtureTag });
  if (count !== sampleUsers.length) throw new Error(`Unexpected fixture count: ${count}`);
  console.log(JSON.stringify({ database, users: sampleUsers }, null, 2));
} finally {
  await client.close();
}
