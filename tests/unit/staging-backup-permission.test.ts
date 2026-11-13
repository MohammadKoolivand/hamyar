import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("staging deploy checks hook ownership and restrictive mode, not service user execute access", () => {
  const workflow = readFileSync(".github/workflows/staging.yml", "utf8");
  assert.ok(workflow.includes('0:700:regular file'));
  assert.ok(workflow.includes('BACKUP_HOOK_ROOT_ONLY_READY'));
  assert.ok(workflow.includes('BACKUP_HOOK_EXISTS_BUT_NEEDS_ROOT_REVIEW'));
  assert.ok(!workflow.includes('[ -x /etc/hodhod/backup-before-release ]'));
  assert.ok(!workflow.includes('[[ -x /etc/hodhod/backup-before-release ]]'));
  const deploy = readFileSync("ops/deploy-staging.sh", "utf8");
  assert.ok(deploy.includes('[[ -x /etc/hodhod/backup-before-release ]]'));
  assert.ok(deploy.includes('/etc/hodhod/backup-before-release'));
});
