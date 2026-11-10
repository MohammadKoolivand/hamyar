import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

const directory = resolve(".private/dev-mongo");
await mkdir(directory, { recursive: true });
const client = new MongoClient("mongodb://127.0.0.1:27019/?directConnection=true", { serverSelectionTimeoutMS: 1000 });
try {
  await client.connect();
} catch {
  const result = spawnSync("mongod", ["--dbpath", directory, "--port", "27019", "--bind_ip", "127.0.0.1", "--replSet", "hamyar-rs", "--logpath", resolve(directory, "mongo.log"), "--fork"], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Start a local MongoDB replica set on port 27019 (mongod is required).");
  await client.connect();
}
try {
  let hello = await client.db("admin").command({ hello: 1 });
  if (!hello.setName) await client.db("admin").command({ replSetInitiate: { _id: "hamyar-rs", members: [{ _id: 0, host: "127.0.0.1:27019" }] } });
  for (let attempt = 0; attempt < 40; attempt++) {
    hello = await client.db("admin").command({ hello: 1 });
    if (hello.setName === "hamyar-rs" && hello.isWritablePrimary) break;
    if (attempt === 39) throw new Error("Development MongoDB primary is unavailable.");
    await new Promise(resolve => setTimeout(resolve, 500));
  }
} finally {
  await client.close();
}
