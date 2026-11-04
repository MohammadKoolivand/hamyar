import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedRequestOrigin } from "../../src/server/security/request-origin";

test("development accepts equivalent loopback origins on the configured port", () => {
  const allowed = new URL("http://127.0.0.1:5174");
  assert.equal(
    isAllowedRequestOrigin(new URL("http://localhost:5174"), allowed, "development"),
    true,
  );
  assert.equal(
    isAllowedRequestOrigin(new URL("http://[::1]:5174"), allowed, "development"),
    true,
  );
});

test("loopback relaxation rejects other ports, protocols and production", () => {
  const allowed = new URL("http://127.0.0.1:5174");
  assert.equal(
    isAllowedRequestOrigin(new URL("http://localhost:5175"), allowed, "development"),
    false,
  );
  assert.equal(
    isAllowedRequestOrigin(new URL("https://localhost:5174"), allowed, "development"),
    false,
  );
  assert.equal(
    isAllowedRequestOrigin(new URL("http://localhost:5174"), allowed, "production"),
    false,
  );
  assert.equal(
    isAllowedRequestOrigin(new URL("http://attacker.test:5174"), allowed, "development"),
    false,
  );
});

test("the exact configured origin remains valid in every environment", () => {
  const allowed = new URL("https://hodhodedu.ir");
  assert.equal(
    isAllowedRequestOrigin(new URL("https://hodhodedu.ir"), allowed, "production"),
    true,
  );
});
