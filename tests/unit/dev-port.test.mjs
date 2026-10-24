import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { once } from "node:events";
import { inspectDevPort } from "../../scripts/check-dev-port.mjs";

test("dev port probe reports a free port", async () => {
  const ephemeral = createServer();
  ephemeral.listen(0, "127.0.0.1");
  await once(ephemeral, "listening");
  const port = ephemeral.address().port;
  await new Promise((resolve) => ephemeral.close(resolve));
  assert.deepEqual(await inspectDevPort(port), { available: true });
});

test("dev port probe does not kill or take over an occupied port", async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  try {
    assert.deepEqual(await inspectDevPort(port), {
      available: false,
      code: "EADDRINUSE",
    });
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
