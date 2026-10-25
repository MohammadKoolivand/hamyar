import { MongoClient } from "mongodb";
import { createContext } from "../src/server/context";
import { runNextExamJob, expireExamSources } from "../src/server/imports/jobs";
const client = new MongoClient(
  process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
);
await client.connect();
const ctx = createContext(client.db(process.env.MONGO_DB ?? "hamyar"));
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
try {
  while (running) {
    await expireExamSources(ctx);
    if (!(await runNextExamJob(ctx)))
      await new Promise((resolve) => setTimeout(resolve, 1500));
  }
} finally {
  await client.close();
}
