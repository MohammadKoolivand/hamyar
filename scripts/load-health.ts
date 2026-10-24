/** Bounded HTTP smoke, not a classroom capacity benchmark; no student writes. */
import { performance } from "node:perf_hooks";
const target = new URL(
  "/api/health",
  process.env.APP_ORIGIN ?? "http://127.0.0.1:5174",
);
if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname))
  throw new Error("Load smoke is restricted to loopback");
const samples: number[] = [],
  statuses: Record<string, number> = {};
let next = 0;
await Promise.all(
  Array.from({ length: 10 }, async () => {
    while (next++ < 60) {
      const start = performance.now();
      const response = await fetch(target, {
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      await response.arrayBuffer();
      samples.push(performance.now() - start);
      statuses[response.status] = (statuses[response.status] ?? 0) + 1;
    }
  }),
);
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    requests: samples.length,
    concurrency: 10,
    statuses,
    p50Ms: Math.round(samples[Math.ceil(samples.length * 0.5) - 1]),
    p95Ms: Math.round(samples[Math.ceil(samples.length * 0.95) - 1]),
    scope: "loopback health only, not learning or inference capacity",
  }),
);
if (statuses["200"] !== 60) process.exitCode = 1;
