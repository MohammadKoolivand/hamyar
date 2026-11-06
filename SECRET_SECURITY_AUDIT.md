# Hodhod secret exposure audit (offline snapshot)

## Scope and limitations

- Source: the supplied `hamyar-input-hardened.zip` snapshot, with previous API, OTP and session fixes retained.
- Offline review only; no calls to production databases, SMS, email, AI, GitHub, or deployment hosts.
- `node scripts/scan-secrets.mjs .` scans text files, including checked-in logs and any present `.next`/`dist` output. Reports filenames, line numbers, rule names and severity **without secret values**.
- There is no `.git` history, installed dependency tree, or generated production bundle in the supplied archive. Historical Git commits, deployed environment variables, remote logs, published artifacts and actual runtime secrets could not be audited.
- This heuristic scanner is **not a substitute** for Gitleaks/TruffleHog over full history and all CI artifacts. It detects known token formats, PEM headers, credential-bearing MongoDB URLs, and potentially sensitive literals. False negatives and false positives are possible.

## Findings

| Finding | Result | Action |
|---|---|---|
| Recognizable real access tokens / private keys / MongoDB credential URLs in present snapshot | **0 high-confidence matches**, 413 text files scanned | Keep CI scanner mandatory; scan complete Git history separately |
| Literal values under sensitive-looking variable names | **9 manual-review matches** in integration/unit test fixtures | These appear synthetic. Keep test credentials isolated and do not reuse in deployed systems; manually verify if environment-specific values are added later |
| `.env` with populated production secrets in snapshot | None found | Keep production secrets in a managed secret store; `.gitignore` ignores `.env.*` with explicit template exceptions |
| `docs/uat/closure-evidence/credential-presence.json` | Recorded `AVALAI_API_KEY: true` (presence flag only; no key value) | No disclosure of the key confirmed. Review real CI/runtime log retention and consider rotating if history or other channels indicate exposure |
| Production `.next` / `dist` build | Not present in supplied archive | Run scanner on real build artifacts and client JS bundles before publishing |
| Session secret | Session implementation uses randomly generated session tokens hashed server-side; no separate `SESSION_SECRET` configuration identified | Protect the DB/session tokens and force session revocation on suspected leakage |

## Added controls

- `scripts/scan-secrets.mjs`: offline scanner prints **locations and rule names only**, never matches or credential values. Exits nonzero on high-confidence leaks. `--strict` also fails on manual-review warnings.
- `npm run security:scan-secrets` and the source scan in `.github/workflows/verify.yml` before install/build.
- `.env.production.example` uses blank credential fields and illustrative non-secret configuration only.
- `.gitignore` extended for environment variants and private key formats.
- `tests/unit/secret-scanner.test.mjs` verifies detection of synthetic GitHub tokens, MongoDB credential URLs, private keys, scanning build/logs, and redacted output.

## Safe rotation runbook (operator approval required; not executed)

1. **Contain and assess.** Restrict access to affected artifacts, logs and repository history; identify provider, environment, privilege scope, issuance, last use, and whether credentials were actually exposed. Do not copy values into issue trackers or chat. If an active key is exposed, treat it as compromised.
2. **Prepare a replacement** in the provider's secure UI or secret manager. Favor scoped, least-privilege credentials and overlapping active keys where supported. Put new values in secret storage (not source code, logs or shell history); update all relevant web/workers together. Never include secrets in build arguments or `NEXT_PUBLIC_*` variables.
3. **Database (`MONGO_URL`):** provision a new dedicated least-privilege MongoDB user, deploy replacement URI across web/workers, confirm connectivity and authorization, then disable the old user. Watch connection logs and update backup/maintenance service secrets separately.
4. **SMS (`MELIPAYAMAK_PASSWORD` or `MELIPAYAMAK_SHARED_ENDPOINT`):** create/reissue provider credential or token, update only relevant server-side secret, verify SMS using an approved non-production account, then revoke old credential. Avoid putting secret-bearing endpoints in request logs, metrics or traces.
5. **AI (`AVALAI_API_KEY`):** issue a replacement with usage/budget limits, update server secret, verify minimal API calls, then revoke old key and review provider usage for anomalies.
6. **SMTP (`SMTP_PASSWORD`):** create/rotate an app password, update the mail worker, confirm safe delivery, then revoke the old password.
7. **OTP (`AUTH_OTP_SECRET`):** rotate with coordinated deployment on every auth instance; outstanding codes created under the old HMAC key become invalid. Schedule during a short window and inform users they may need to request a new code.
8. **Encrypted mail outbox (`MAIL_OUTBOX_KEY`):** this key decrypts pending email-verification/password-reset jobs. Before changing it, drain or safely invalidate pending jobs and arrange reissuance; otherwise they become unreadable. Coordinate all web/mail workers. Preserve an old key only under a time-limited, approved migration procedure.
9. **Sessions:** on credential compromise, revoke affected (or all) MongoDB sessions and bump `securityRevision` as required; ask users to sign in again. No distinct `SESSION_SECRET` was identified in this snapshot.
10. **Verify and finish.** Check new credentials work, old credentials fail, and logs/artifacts contain no leaked values; scrub authorized retained copies, rotate affected downstream secrets if necessary, and record incident metadata **without values**. Removing a secret from the working tree does not remove it from Git history or cached build artifacts—coordinate history cleanup and cache/artifact revocation with repository administrators.

## Commands (offline)

```bash
npm run security:scan-secrets
node scripts/scan-secrets.mjs . --strict
node --test tests/unit/secret-scanner.test.mjs
```

For Git history / hosted build artifacts, have an authorized maintainer run an established scanner (e.g. Gitleaks) with full Git history and CI artifact access in a secured environment. Do not export production secrets to the scanning machine.
