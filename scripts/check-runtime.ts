/** Read-only liveness/resource probe; output contains no student data or prompts. */
import { performance } from "node:perf_hooks";
import { MongoClient } from "mongodb";
const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:5174";
const start = performance.now();
const response = await fetch(new URL("/api/health", origin), {
  signal: AbortSignal.timeout(5000),
  redirect: "error",
});
if (!response.ok) throw new Error(`Health HTTP ${response.status}`);
const health = await response.json();
const healthLatency = performance.now() - start;
if (health.status !== "ok") throw new Error("Health check failed");
const client = new MongoClient(process.env.MONGO_URL!);
try {
  await client.connect();
  const since = new Date(Date.now() - 86400000).toISOString();
  const requests = await client
    .db(process.env.MONGO_DB)
    .collection("aiRequests")
    .aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { provider: "$provider", state: "$state" },
          requests: { $sum: 1 },
          inputTokens: { $sum: "$usage.inputTokens" },
          outputTokens: { $sum: "$usage.outputTokens" },
          knownUsage: {
            $sum: { $cond: [{ $isNumber: "$usage.inputTokens" }, 1, 0] },
          },
        },
      },
    ])
    .toArray();
  console.log(
    JSON.stringify({
      status: health.status,
      ai: health.ai,
      healthLatencyMs: Math.round(healthLatency),
      windowHours: 24,
      aiRequests: requests.map((r) => ({
        provider: r._id.provider ?? "unknown",
        state: r._id.state,
        requests: r.requests,
        knownUsage: r.knownUsage,
        unknownUsage: r.requests - r.knownUsage,
        inputTokens: r.knownUsage ? r.inputTokens : null,
        outputTokens: r.knownUsage ? r.outputTokens : null,
      })),
    }),
  );
} finally {
  await client.close();
}
