/** Local-only ops drill: owns its mongod, dbpath and process; never stops shared Mongo. */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import { fixture } from "../../tests/helpers/fixture";
import { buildApp } from "../../src/server/app";
const uri = "mongodb://127.0.0.1:27190/?replicaSet=closure_ops";
process.env.TEST_MONGO_URL = uri;
if (process.argv.includes("log-child")) {
  const f = await fixture();
  process.env.NODE_ENV = "production";
  const app = await buildApp(f.db);
  try {
    const originalCommand = f.db.command.bind(f.db);
    f.db.command = async (...args: Parameters<typeof f.db.command>) => {
      if (args[0].ping) throw new Error("SECRET_LOG_SENTINEL");
      return originalCommand(...args);
    };
    const failedLogin = await app.inject({ method: "POST", url: "/api/auth/login?token=SECRET_LOG_SENTINEL", payload: { email: "absent@test.dev", password: "SECRET_LOG_SENTINEL" } });
    assert.equal(failedLogin.statusCode, 401);
    const r = await app.inject({ method: "GET", url: "/api/health?token=SECRET_LOG_SENTINEL", headers: { authorization: "Bearer SECRET_LOG_SENTINEL", cookie: f.teacher + "; extra=SECRET_LOG_SENTINEL" } });
    assert.equal(r.statusCode, 500);
    assert.ok(r.headers["x-request-id"]);
    assert.ok(!r.body.includes("SECRET_LOG_SENTINEL"));
  } finally {
    await app.close();
    await f.close();
  }
} else {
  const directory = await mkdtemp(join(tmpdir(), "hodhod-closure-ops-"));
  let child: ChildProcess | undefined;
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function start() {
    child = spawn(
      "mongod",
      [
        "--dbpath",
        directory,
        "--port",
        "27190",
        "--bind_ip",
        "127.0.0.1",
        "--replSet",
        "closure_ops",
        "--logpath",
        join(directory, "mongo.log"),
      ],
      { stdio: "ignore" },
    );
    child.on("error", () => {});
    for (let i = 0; i < 100; i++) {
      const c = new MongoClient(
        "mongodb://127.0.0.1:27190/?directConnection=true",
        { serverSelectionTimeoutMS: 150 },
      );
      try {
        await c.connect();
        return;
      } catch {
        await pause(100);
      } finally {
        await c.close();
      }
    }
    throw new Error("Temporary mongod did not start");
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const exit = once(child, "exit");
      child.kill("SIGTERM");
      await exit;
    }
  }
  let f: Awaited<ReturnType<typeof fixture>> | undefined;
  try {
    const offline = new MongoClient(uri, { serverSelectionTimeoutMS: 300 });
    await assert.rejects(offline.connect());
    await offline.close();
    await start();
    const admin = new MongoClient(
      "mongodb://127.0.0.1:27190/?directConnection=true",
    );
    await admin.connect();
    await admin.db("admin").command({
      replSetInitiate: {
        _id: "closure_ops",
        members: [{ _id: 0, host: "127.0.0.1:27190" }],
      },
    });
    await admin.close();
    f = await fixture();
    assert.equal((await f.request("/api/health")).statusCode, 200);
    const original = (await f.request(f.path, undefined, f.student)).json();
    await stop();
    assert.equal((await f.request("/api/health")).statusCode, 500);
    await start();
    let recovered = false;
    for (let i = 0; i < 12; i++) {
      if ((await f.request("/api/health")).statusCode === 200) {
        recovered = true;
        break;
      }
      await pause(500);
    }
    assert.ok(recovered);
    assert.deepEqual(
      (await f.request(f.path, undefined, f.student)).json(),
      original,
    );
    const times: number[] = [];
    let errors = 0;
    for (let batch = 0; batch < 6; batch++)
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          const start = performance.now();
          const r = await f!.request(f!.path, undefined, f!.student);
          times.push(performance.now() - start);
          if (r.statusCode !== 200) errors++;
        }),
      );
    times.sort((a, b) => a - b);
    assert.equal(errors, 0);
    const logs = await new Promise<string>((resolve, reject) => {
      const p = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          "docs/uat/closure-operations-probe.ts",
          "log-child",
        ],
        { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
      );
      let out = "",
        err = "";
      p.stdout.on("data", (x) => (out += x));
      p.stderr.on("data", (x) => (err += x));
      p.on("error", reject);
      p.on("exit", (code) =>
        code === 0
          ? resolve(out)
          : reject(new Error(`Log probe failed: ${code} ${err}`)),
      );
    });
    assert.ok(!logs.includes("SECRET_LOG_SENTINEL"));
    assert.ok(logs.includes("requestId"));
    console.log(
      JSON.stringify({
        startupOfflineRejected: true,
        healthyStartup: true,
        outageReturns500: true,
        reconnectPreservesSessionAndData: true,
        productionLogSentinelAbsent: true,
        traceableError: true,
        practiceReadWorkload: {
          requests: times.length,
          concurrency: 5,
          errors,
          p50Ms: times[15],
          p95Ms: times[28],
        },
        capacityQualification:
          "local synthetic app.inject read workload; not public-classroom capacity",
      }),
    );
  } finally {
    if (f) await f.close();
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
}
