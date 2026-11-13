import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("root backup hook matches driver admin authentication and protects stderr", () => {
  const source = readFileSync("ops/backup-before-release.sh", "utf8");
  assert.ok(source.includes("useDefaultAdminAuth"));
  assert.ok(source.includes("--authenticationDatabase=admin"));
  assert.ok(source.includes('!/(?:\\?|&)authSource=/i.test(uri)'));
  assert.ok(source.includes('stdio: ["ignore", "ignore", "pipe"]'));
  assert.ok(source.includes('MONGODUMP_AUTH_OR_READ_ROLE_REJECTED'));
  assert.ok(source.includes('MONGODUMP_TLS_HANDSHAKE_FAILED'));
  assert.ok(source.includes("MONGODUMP_NETWORK_FAILED"));
  assert.ok(!source.includes('"--quiet"'));
  assert.ok(source.includes('pinnedCaPath = "/etc/hodhod/tls/mongodb-ca.pem"'));
  assert.ok(source.includes("--sslCAFile="));
  assert.ok(source.includes("uriHasCa"));
  assert.ok(source.includes("MONGODUMP_TLS_CA_UNTRUSTED"));
  assert.ok(source.includes("MONGODUMP_TLS_CERTIFICATE_NAME_MISMATCH"));
  assert.ok(source.includes("MONGODUMP_TLS_CERTIFICATE_EXPIRED"));
  assert.ok(!source.includes("--sslAllowInvalidCertificates"));
  assert.ok(!source.includes("--sslAllowInvalidHostnames"));
  assert.ok(!source.includes("--tlsInsecure"));
  assert.ok(!source.includes("console.log(diagnostic)"));
});
