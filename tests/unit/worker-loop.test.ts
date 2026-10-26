import test from "node:test";
import assert from "node:assert/strict";
import { MongoNetworkError } from "mongodb";
import { workerLoop } from "../../src/server/imports/worker-loop";

test("worker recovers from network errors with bounded backoff and resets delay after work", async () => {
  let cycles = 0,
    warnings = 0;
  const delays: number[] = [];
  await workerLoop({
    running: () => cycles < 6,
    cycle: async () => {
      cycles++;
      if (cycles <= 2 || cycles === 4) throw new MongoNetworkError("synthetic outage");
      return cycles === 3 || cycles === 5;
    },
    pause: async (ms) => {
      delays.push(ms);
    },
    onReconnect: () => {
      warnings++;
    },
  });
  assert.equal(cycles, 6);
  assert.equal(warnings, 3);
  assert.deepEqual(delays, [1500, 3000, 1500]);
});
test("worker retries cap at thirty seconds and respects shutdown between cycles", async () => {
  let cycles = 0;
  const delays: number[] = [];
  await workerLoop({
    running: () => cycles < 9,
    cycle: async () => {
      cycles++;
      throw new MongoNetworkError("synthetic outage");
    },
    pause: async (ms) => {
      delays.push(ms);
    },
    onReconnect: () => {},
  });
  assert.deepEqual(
    delays,
    [1500, 3000, 6000, 12000, 24000, 30000, 30000, 30000],
  );
});
test("worker does not hide programming or validation errors behind infinite retries", async () => {
  await assert.rejects(
    workerLoop({
      running: () => true,
      cycle: async () => {
        throw new Error("invalid state");
      },
      pause: async () => {
        assert.fail("must not retry");
      },
      onReconnect: () => {
        assert.fail("must not hide");
      },
    }),
    /invalid state/,
  );
});
