import { test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "mongodb";
import { requireTransactions } from "../../src/server/transactions";
import { assertOpen, transition } from "../../src/server/state";
test("topology guard rejects standalone instead of assuming transactions", async () => {
  const standalone = {
    admin: () => ({ command: async () => ({ isWritablePrimary: true }) }),
  } as unknown as Db;
  await assert.rejects(requireTransactions(standalone), /replica set required/);
  const replica = {
    admin: () => ({ command: async () => ({ setName: "hamyar-rs" }) }),
  } as unknown as Db;
  await requireTransactions(replica);
});
test("state transitions cannot reopen, complete a draft, or write cancelled/submitted assignments", () => {
  for (const state of ["completed", "cancelled"])
    for (const target of ["published", "in_progress", "submitted"])
      assert.throws(() => transition(state, target));
  assert.throws(() => transition("draft", "completed"));
  for (const state of ["draft", "completed", "submitted", "cancelled"])
    assert.throws(() => assertOpen(state));
  transition("draft", "published");
  transition("in_progress", "submitted");
  transition("submitted", "completed");
});
