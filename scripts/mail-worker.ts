import { connect } from "../src/server/db";
import { createContext } from "../src/server/context";
import { deliverNextMail, outboxKey } from "../src/server/auth/mail-outbox";
import { workerLoop } from "../src/server/imports/worker-loop";
import { smtpConfigured } from "../src/server/auth/reset-mail";

outboxKey();
if (!smtpConfigured())
  throw new Error("Configure SMTP before starting mail worker");
const { client, db } = await connect();
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
try {
  const ctx = createContext(db);
  await workerLoop({
    running: () => running,
    cycle: () => deliverNextMail(ctx),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onReconnect: () =>
      console.warn("Mail worker: database unavailable; retrying"),
  });
} catch {
  console.error(
    "Mail worker stopped; inspect configuration and database availability",
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
