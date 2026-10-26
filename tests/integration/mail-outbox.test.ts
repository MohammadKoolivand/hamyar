import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import {
  deliverNextMail,
  encryptMail,
} from "../../src/server/auth/mail-outbox";

test("encrypted durable mail survives retry and lease recovery; stale tokens and concurrent consumers are safe", async () => {
  const f = await fixture();
  const ctx = createContext(f.db);
  const email = "t@test.dev";
  const user = await f.c("users").findOne({ email });
  await f
    .c("users")
    .updateOne({ _id: user!._id }, { $set: { emailVerified: true } });
  const token = "b".repeat(64);
  const jobId = ctx.id();
  const payload = encryptMail({ email, token }, jobId);
  assert.ok(!JSON.stringify(payload).includes(token));
  assert.ok(!JSON.stringify(payload).includes(email));
  async function seed() {
    await f.c("passwordResetTokens").replaceOne(
      { _id: user!._id },
      {
        _id: user!._id,
        tokenHash: ctx.hash(token),
        usedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      },
      { upsert: true },
    );
    await f.c("mailOutbox").replaceOne(
      { _id: jobId },
      {
        _id: jobId,
        userId: user!._id,
        payload,
        tokenHash: ctx.hash(token),
        state: "queued",
        attempts: 0,
        availableAt: new Date(0),
        expiresAt: new Date(Date.now() + 600000),
      },
      { upsert: true },
    );
  }
  try {
    await seed();
    await deliverNextMail(ctx, async () => {
      throw new Error("SMTP unavailable");
    });
    let job = await f.c("mailOutbox").findOne({ _id: jobId });
    assert.equal(job!.state, "queued");
    assert.equal(job!.attempts, 1);
    assert.equal(job!.lastError, "delivery_failed");
    // A crashed worker leaves a lease. Another context/process recovers it.
    await f
      .c("mailOutbox")
      .updateOne(
        { _id: jobId },
        { $set: { state: "sending", leaseUntil: new Date(0) } },
      );
    const sent: string[] = [];
    const mailer = async (to: string, value: string) => {
      assert.equal(to, email);
      sent.push(value);
    };
    await Promise.all([
      deliverNextMail(createContext(f.db), mailer),
      deliverNextMail(createContext(f.db), mailer),
    ]);
    assert.deepEqual(sent, [token]);
    assert.equal(await f.c("mailOutbox").countDocuments(), 0);
    await seed();
    await f.c("passwordResetTokens").deleteOne({ _id: user!._id });
    await deliverNextMail(ctx, mailer);
    assert.deepEqual(sent, [token], "revoked tokens must never be delivered");
    await seed();
    await f.c("mailOutbox").updateOne(
      { _id: jobId },
      {
        $set: {
          attempts: 4,
          "payload.tag": Buffer.alloc(16).toString("base64"),
        },
      },
    );
    await deliverNextMail(ctx, mailer);
    job = await f.c("mailOutbox").findOne({ _id: jobId });
    assert.equal(job!.state, "failed");
    assert.equal(job!.payload, undefined);
    assert.equal(await f.c("passwordResetTokens").countDocuments(), 0);
    assert.deepEqual(sent, [token]);
  } finally {
    await f.close();
  }
});
