import process from "node:process";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { deploymentChecks } from "../../scripts/check-deployment.mjs";
const base = {
  MONGO_URL: "mongodb://127.0.0.1:27019/?replicaSet=test",
  MONGO_DB: "hodhodeh_staging_test",
  HODHOD_EXPECTED_DB: "hodhodeh_staging_test",
  APP_ORIGIN: "https://staging.example.test",
  COOKIE_SECURE: "true",
};
test("deployment guard rejects wrong database, insecure origin and unsafe mail configuration", () => {
  assert.deepEqual(deploymentChecks(base, "exams").errors, []);
  assert.ok(
    deploymentChecks({ ...base, MONGO_DB: "production" }).errors.includes(
      "EXPECTED_DATABASE_MISMATCH",
    ),
  );
  assert.ok(
    deploymentChecks({
      ...base,
      APP_ORIGIN: "http://staging.example.test",
    }).errors.includes("APP_ORIGIN_REQUIRES_HTTPS_ORIGIN"),
  );
  assert.ok(
    deploymentChecks({ ...base, COOKIE_SECURE: "false" }).errors.includes(
      "SECURE_COOKIES_REQUIRED",
    ),
  );
  const missing = deploymentChecks(base, "mail").errors;
  assert.ok(missing.includes("MAIL_OUTBOX_KEY_INVALID"));
  assert.ok(missing.includes("SMTP_CREDENTIALS_REQUIRED"));
  const configured = {
    ...base,
    SMTP_HOST: "smtp.example.test",
    SMTP_USER: "fixture",
    SMTP_PASSWORD: "fixture",
    SMTP_FROM: "noreply@example.test",
    SMTP_PORT: "465",
    MAIL_OUTBOX_KEY: Buffer.alloc(32, 2).toString("base64"),
  };
  assert.deepEqual(deploymentChecks(configured, "mail").errors, []);
  assert.ok(
    deploymentChecks(
      {
        ...configured,
        SMTP_FROM: "sender@example.test\r\nBcc: other@example.test",
      },
      "mail",
    ).errors.includes("SMTP_FROM_REQUIRED_OR_INVALID"),
  );
});
test("deployment preflight reports only codes and never secrets; optional SMS is truthful", () => {
  assert.ok(
    deploymentChecks(base).warnings.includes("REAL_SMS_NOT_CONFIGURED"),
  );
  const secret = "never-print-this-private-value";
  const result = spawnSync(
    process.execPath,
    ["scripts/check-deployment.mjs", "mail"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...base,
        SMTP_USER: secret,
        SMTP_PASSWORD: secret,
        SMTP_FROM: secret,
        MAIL_OUTBOX_KEY: secret,
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes("NEEDS CONFIGURATION"));
  assert.ok(!result.stdout.includes(secret));
  assert.ok(!result.stderr.includes(secret));
});
test("OPS-019: actual rollback function restores previous code/services and never invokes database restore", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("ops/deploy-staging.sh", "utf8");
  const body = source.match(/rollback\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const script = `previous=/fixture/previous\nmail_active=true\n` +
    `systemctl(){ echo "systemctl $*"; }\nln(){ echo "ln $*"; }\nmv(){ echo "mv $*"; }\nmongorestore(){ echo "FORBIDDEN_DATABASE_RESTORE"; return 9; }\n` +
    `rollback(){${body}\n}\nrollback\n`;
  const r = spawnSync("bash", ["-c", script], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /ln -sfn \/fixture\/previous \/srv\/hodhod.rollback/);
  assert.match(r.stdout, /systemctl start hodhod-web hodhod-exam-worker/);
  assert.match(r.stdout, /systemctl start hodhod-mail-worker/);
  assert.ok(!r.stdout.includes("FORBIDDEN_DATABASE_RESTORE"));
  assert.match(r.stderr, /Database was not rolled back/);
});
