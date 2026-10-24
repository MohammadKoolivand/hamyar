/** Quiesced small-pilot backup drill. Never restores over an existing database. */
import { spawn } from "node:child_process";
import { mkdir, chmod, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { MongoClient, BSON } from "mongodb";
if (process.env.WRITES_PAUSED !== "true")
  throw new Error("Stop application writes, then set WRITES_PAUSED=true");
const uri = process.env.MONGO_URL;
const name = process.env.MONGO_DB;
if (!uri || !name || !/^[-\w]+$/.test(name))
  throw new Error("Explicit database configuration required");
const client = new MongoClient(uri);
const target = "hamyar_restore_" + randomUUID().replaceAll("-", "");
const directory = resolve(".private/backups");
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const file = resolve(directory, `${name}-${Date.now()}.archive.gz`);
async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    // Tool diagnostics can contain credentials: never forward raw stderr.
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => reject(new Error(`${command} unavailable`)));
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`)),
    );
  });
}
async function digest(dbName: string) {
  const db = client.db(dbName);
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const result: Record<
    string,
    { count: number; hash: string; indexes: string[] }
  > = {};
  for (const { name } of collections.sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const hash = createHash("sha256");
    let count = 0;
    for await (const row of db.collection(name).find({}).sort({ _id: 1 })) {
      hash.update(BSON.EJSON.stringify(row, { relaxed: false }));
      count++;
    }
    const indexes = (await db.collection(name).listIndexes().toArray())
      .map((i) =>
        BSON.EJSON.stringify({
          key: i.key,
          name: i.name,
          unique: i.unique ?? false,
          expireAfterSeconds: i.expireAfterSeconds ?? null,
        }),
      )
      .sort();
    result[name] = { count, hash: hash.digest("hex"), indexes };
  }
  return result;
}
try {
  await client.connect();
  if ((await client.db(target).listCollections().toArray()).length)
    throw new Error("Restore target must be empty");
  const before = await digest(name);
  await run("mongodump", [
    "--uri",
    uri,
    "--db",
    name,
    `--archive=${file}`,
    "--gzip",
  ]);
  await chmod(file, 0o600);
  await run("mongorestore", [
    "--uri",
    uri,
    `--archive=${file}`,
    "--gzip",
    `--nsInclude=${name}.*`,
    `--nsFrom=${name}.*`,
    `--nsTo=${target}.*`,
  ]);
  const restored = await digest(target);
  const after = await digest(name);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error("Source changed during backup; drill invalid");
  if (JSON.stringify(before) !== JSON.stringify(restored))
    throw new Error("Restored documents/indexes differ");
  console.log(
    JSON.stringify({
      result: "pass",
      collections: Object.keys(before).length,
      documents: Object.values(before).reduce((n, c) => n + c.count, 0),
      bytes: (await stat(file)).size,
      archive: file,
      restoredToIsolatedDatabase: true,
    }),
  );
} finally {
  // Only the random drill database is removed. Source and backup are never deleted.
  await client
    .db(target)
    .dropDatabase()
    .catch(() => {});
  await client.close();
}
