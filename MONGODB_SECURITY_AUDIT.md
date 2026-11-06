# MongoDB security audit — code and configuration scope

## Findings and changes

- **Production connection:** preflight and application startup now reject missing URI credentials, implicit/non-replica-set `mongodb://` topology, `directConnection=true`, invalid database name, missing TLS or weakened certificate verification. SRV DNS records and actual CA validity can only be verified at runtime.
- **Staging mongod:** `deploy/mongod-staging.conf` now requires TLS with configured server PEM and CA file. Existing `authorization: enabled`, keyFile and loopback bind remain. **Provision certificate files and test client connectivity before deployment.** No server was changed.
- **CI compose.yaml:** unauthenticated loopback replica set is intentionally for **ephemeral local/CI use only**, NEVER production. Container port is bound to 127.0.0.1; production must use isolated private networking and authentication.
- **Transactions:** `src/server/transactions.ts` uses MongoDB transactions with majority writes and snapshot read concern; application startup calls `requireTransactions`. The read-only check verifies replica set / sharded topology, session support and wire version; it does not run a write transaction. Validate majority write availability and write transaction in staging separately.
- **Indexes:** application creates unique token/relationship indexes and TTL indexes at startup. `scripts/check-mongo-readonly.mjs` inspects critical TTL index metadata without changing it. TTL removal is asynchronous; session validation must enforce expiry too (it does).
- **Credentials:** store `MONGO_URL` in permission-restricted secret manager or environment file outside the repository. URL-encode passwords; use an app-specific identity, never `root`/`dbOwner`. Rotate credentials with overlap and deploy/restart clients, then revoke previous credentials.
- **Least privilege:** start from `{role:'readWrite',db:'<application database>'}` for runtime (MongoDB built-in readWrite has index management). Avoid cluster-wide roles, admin roles and cross-db privileges. Use separate migration/backup identities. Ensure default or custom roles are reviewed by a DBA; read-only script reports direct assigned roles only, not expanded inherited privileges.
- **Network:** only allow application/worker hosts to reach TCP 27017 over a private interface/VPC or SSH/VPN tunnel; firewall or Atlas IP allowlist, no public MongoDB listener. This cannot be proved from application code. Keep operational backups encrypted and restore-tested.
- **TLS:** require CA-validated encrypted connections, valid SAN names, and protected server key files; monitor certificate expiry. If the server listens on loopback with a private CA, provision the client CA through driver-supported certificate validation settings, never bypass validation.

## Run production read-only checker

1. Provision separate audited read-only access to the **same** target database for this check, or run with the application credential while preventing any writes via the script. The script only issues `hello`, `connectionStatus`, and `listIndexes` commands.
2. Set `MONGO_URL` and `MONGO_DB` securely (do not pass credentials in command line or ticket comments).
3. Explicitly opt in: `HODHOD_MONGO_AUDIT_CONFIRM=read-only npm run security:mongo:readonly`.
4. Review code-only error labels and warnings; the script never prints connection string, usernames, IPs, roles, document contents or PII.

**Important:** The role test expects an application `readWrite` role and will flag separate read-only audit identities; a read-only audit account can inspect TLS/topology/indexes, but its role outcome must be interpreted accordingly. `PASS_WITH_EXTERNAL_CHECKS` is not approval of firewall, CA trust chain, encryption at rest, backups, inherited custom role privileges or a successful write transaction.

## Release blockers

- Confirm runtime service credential is restricted to app DB and auth is enabled.
- Verify real MongoDB is private, TLS-validated, stable replica set (or compatible shard), majority write concern and backups work.
- Test sample transaction commit/rollback only in staging, never during this read-only inspection.
- Inspect critical TTL and uniqueness indexes on target deployment, verify cert expiry and log redaction.
