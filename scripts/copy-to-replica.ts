/** Offline copy into an EMPTY target. Source is never mutated. Stop application writes first. */
import { MongoClient } from "mongodb";
const sourceUrl = process.env.MIGRATION_SOURCE_URL,
  targetUrl = process.env.MONGO_URL,
  name = process.env.MONGO_DB;
if (!sourceUrl || !targetUrl || !name || sourceUrl === targetUrl)
  throw new Error(
    "Set distinct MIGRATION_SOURCE_URL, MONGO_URL and MONGO_DB; stop application writes first",
  );
const source = new MongoClient(sourceUrl),
  target = new MongoClient(targetUrl);
await source.connect();
await target.connect();
try {
  const hello = await target.db("admin").command({ hello: 1 });
  if (!hello.setName) throw new Error("Target must be a replica set");
  const from = source.db(name),
    to = target.db(name);
  if ((await to.listCollections().toArray()).length)
    throw new Error("Target database must be empty; refusing to overwrite");
  for (const { name: collectionName } of await from
    .listCollections()
    .toArray()) {
    let total = 0;
    for await (const document of from.collection(collectionName).find({})) {
      await to.collection(collectionName).insertOne(document);
      total++;
    }
    if ((await to.collection(collectionName).countDocuments()) !== total)
      throw new Error("Count mismatch");
    console.log(JSON.stringify({ collection: collectionName, copied: total }));
  }
  console.log(
    "Copy complete. Run audit:integrity before accepting writes. Original source is untouched.",
  );
} finally {
  await source.close();
  await target.close();
}
