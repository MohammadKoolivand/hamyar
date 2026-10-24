import { URL } from "node:url";
import console from "node:console";
import { MongoClient } from "mongodb";
import process from "node:process";
const uri = new URL(
  process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017/?replicaSet=hamyar-rs",
);
const name = uri.searchParams.get("replicaSet") ?? "hamyar-rs";
uri.searchParams.delete("replicaSet");
uri.searchParams.set("directConnection", "true");
const client = new MongoClient(uri.toString());
await client.connect();
try {
  try {
    await client.db("admin").command({
      replSetInitiate: { _id: name, members: [{ _id: 0, host: uri.host }] },
    });
    console.log(
      "Replica set initialized; wait for primary election before serving requests.",
    );
  } catch (error) {
    if (error.code !== 23) throw error;
    console.log("Replica set already initialized.");
  }
} finally {
  await client.close();
}
