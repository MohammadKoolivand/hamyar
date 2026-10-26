import { MongoClient } from "mongodb";
import { createContext } from "../src/server/context";
import { runNextExamJob, expireExamSources } from "../src/server/imports/jobs";
import { workerLoop } from "../src/server/imports/worker-loop";
const client = new MongoClient(
  process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
);
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
try {
  await client.connect();
  const ctx = createContext(client.db(process.env.MONGO_DB ?? "hamyar"));
  await workerLoop({
    running: () => running,
    cycle: async () => {
      await expireExamSources(ctx);
      return runNextExamJob(ctx);
    },
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onReconnect: () =>
      console.warn(
        "Exam worker: database temporarily unavailable; retrying with bounded backoff",
      ),
  });
} catch {
  console.error(
    "Exam worker stopped: check database configuration and service diagnostics; private error details withheld",
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
