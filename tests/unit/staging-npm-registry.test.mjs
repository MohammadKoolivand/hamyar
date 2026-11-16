import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { test } from "node:test";

test("staging release lockfile resolves tarballs from official npm registry", () => {
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const packages = Object.values(lock.packages ?? {});
  for (const entry of packages) {
    if (!entry || typeof entry !== "object" || !entry.resolved) continue;
    const url = new URL(entry.resolved);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "registry.npmjs.org");
    assert.match(entry.integrity ?? "", /^sha(256|384|512)-/);
  }
});

test("staging cleanup preserves npm download cache between deployments", () => {
  const cleanup = readFileSync("ops/cleanup-staging-artifacts.sh", "utf8");
  assert.doesNotMatch(cleanup, /rm\s+-rf\s+--\s+"\$HOME\/\.npm\/_cacache"/);
  assert.match(cleanup, /Preserve the npm content-addressed download cache/);
});
