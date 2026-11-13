#!/usr/bin/env bash
# Root-owned hook called by hodhod-deploy AFTER writers are stopped.
# Real MongoDB dump; never restore, alter or delete a user database.
set -euo pipefail
umask 077
if [[ "$EUID" -ne 0 ]]; then echo "BACKUP_REQUIRES_ROOT" >&2; exit 2; fi
if ! command -v mongodump >/dev/null 2>&1; then echo "MONGODUMP_MISSING" >&2; exit 3; fi
if ! command -v node >/dev/null 2>&1; then echo "NODE_MISSING" >&2; exit 3; fi
backup_dir=/var/backups/hodhod-staging
if [[ -L "$backup_dir" ]]; then echo "BACKUP_PATH_IS_SYMLINK" >&2; exit 4; fi
install -d -o root -g root -m 0700 -- "$backup_dir"
if [[ "$(stat -c %u -- "$backup_dir")" != "0" ]]; then echo "BACKUP_DIR_OWNER_INVALID" >&2; exit 4; fi
chmod 0700 -- "$backup_dir"
node --env-file=/etc/hodhod/staging.env --input-type=module - "$backup_dir" <<'NODE'
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, stat, statfs, unlink } from "node:fs/promises";
import { join } from "node:path";

const uri = process.env.MONGO_URL || "";
const db = process.env.MONGO_DB || "";
const expected = process.env.HODHOD_EXPECTED_DB || "";
if (!/^mongodb(?:\+srv)?:\/\//.test(uri) || !/^[\w-]{1,63}$/.test(db) || db !== expected) {
  throw new Error("BACKUP_DATABASE_CONFIGURATION_INVALID");
}
const dir = process.argv[2];
const fs = await statfs(dir);
if (fs.bavail * fs.bsize < 256 * 1024 * 1024) {
  throw new Error("BACKUP_DISK_SPACE_INSUFFICIENT");
}
const id = randomUUID();
const cfg = join(dir, "mongo-connection-" + id + ".yaml");
const archive = join(dir, "staging-" + Date.now() + "-" + id + ".archive.gz");
// mongodump --config avoids leaking MongoDB credentials in the process argument list.
await writeFile(cfg, "uri: " + JSON.stringify(uri) + "\n", { mode: 0o600, flag: "wx" });
try {
  await new Promise((resolve, reject) => {
    const child = spawn("mongodump", [
      "--config=" + cfg, "--db=" + db, "--archive=" + archive, "--gzip", "--quiet"
    ], { stdio: "ignore" });
    child.once("error", () => reject(new Error("MONGODUMP_UNAVAILABLE")));
    child.once("exit", code => code === 0 ? resolve() : reject(new Error("MONGODUMP_FAILED")));
  });
  const result = await stat(archive);
  if (!result.isFile() || result.size === 0) throw new Error("BACKUP_ARCHIVE_INVALID");
  console.log("BACKUP_ARCHIVE_CREATED_AND_NONEMPTY");
} catch (error) {
  await unlink(archive).catch(() => {});
  throw error;
} finally {
  await unlink(cfg).catch(() => {});
}
NODE
