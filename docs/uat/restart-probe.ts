/** Isolated UAT only: keep a session in memory while the UAT process restarts. */
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
const name = process.env.MONGO_DB;
assert.equal(name, "hodhodeh_audit_uat_1027_f962b582");
const origin = "http://127.0.0.1:5176";
const client = new MongoClient(process.env.MONGO_URL!);
try {
  await client.connect();
  const db = client.db(name);
  const assignment = await db
    .collection<{
      _id: string;
      teacherId: string;
      state: string;
      remediation?: boolean;
    }>("assignments")
    .findOne(
      { state: "completed", remediation: { $ne: true } },
      { sort: { _id: -1 } },
    );
  assert.ok(assignment, "A completed synthetic assignment is required");
  const teacher = await db
    .collection<{ _id: string; email?: string }>("users")
    .findOne({ _id: assignment.teacherId });
  assert.ok(teacher?.email?.startsWith("uat-a-"));
  const login = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      email: teacher.email,
      password: "UatSyntheticPass123!",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const path = `/api/assignments/${assignment._id}/report`;
  async function report() {
    const r = await fetch(origin + path, { headers: { cookie } });
    assert.equal(r.status, 200);
    return r.json();
  }
  const before = await report();
  console.log("READY_FOR_RESTART");
  let down = false,
    recovered = false;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(origin + "/api/health", {
        signal: AbortSignal.timeout(1000),
      });
      if (down && r.ok) {
        recovered = true;
        break;
      }
      if (!r.ok) down = true;
    } catch {
      down = true;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(down && recovered, "Actual process downtime and recovery required");
  assert.deepEqual(await report(), before);
  console.log(
    JSON.stringify({
      result: "pass",
      actualDowntimeObserved: down,
      sameSessionValid: true,
      reportUnchanged: true,
    }),
  );
} finally {
  await client.close();
}
