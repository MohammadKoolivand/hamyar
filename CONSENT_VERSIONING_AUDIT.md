# Guardian consent versioning — technical audit

## Implementation and data model

- `guardianConsents` is the current consent projection: `studentId`, `guardianId`, `scope`, `policyVersion`, `textSha256`, `status`, `method`, `acknowledgedAt`, `revokedAt`, `latestEventId`.
- `guardianConsentEvents` is append-only **at the application API layer**: `_id`, `consentId`, `sequence`, `guardianId`, `studentId`, `consentType`, `textVersion`, `textSha256`, `recordedAt`, `method`, `status`, `actorId`, `relationshipId`, `reason`, `previousHash`, `integrityAlgorithm`, `integrityHash`. All transitions insert an event inside the same MongoDB transaction as changing current state. No API supports modifying or deleting a history event.
- Production event hashes use `HMAC-SHA256` with `CONSENT_AUDIT_HMAC_KEY`, **distinct from session and OTP keys**. A missing production key causes fail-closed behavior. Development uses explicitly marked unkeyed checksums ONLY for local tests.
- Query `GET /api/privacy/children/:studentId/consent/history` is restricted to the subject, a related parent (only their own grants), or `super_admin`. It returns metadata without raw evidence/consent documents. It reports `integrityVerified`, `historyComplete`, and `truncated`; do not interpret these as external legal attestation. Historical event lists are capped at 500 entries: requests reaching the cap require archival/export workflow before using for legal audit.
- The approved text is maintained outside the database (immutable release artifact/document store) and pinned by its SHA-256 digest in `STUDENT_CONSENT_TEXT_SHA256`. No text/body/PDF or personal evidence is stored in the event log.

## Version and re-consent policy

Any change of `STUDENT_CONSENT_POLICY_VERSION` or the approved text SHA-256 automatically makes existing grants inadequate for protected student processing. Existing events are retained. The parent must approve the current version again through the authenticated portal. Nonmaterial updates may be classified and exempted **only after legal/product policy approval and implementing an explicit change-classification workflow**. Today the safe default is **always re-consent**, never infer consent from silence.

Production must configure `STUDENT_CONSENT_POLICY_VERSION`, `STUDENT_CONSENT_TEXT_SHA256` (64 lowercase hex digits), and a secret `CONSENT_AUDIT_HMAC_KEY` (at least 32 random characters). Store the HMAC key in a secrets manager with limited access; do not commit it or print it. Key rotation requires key IDs, historical verification keys, and a tested migration; replacing the key outright makes older signatures uncheckable. Keep append-only exports in protected WORM/immutable storage where legally required; a MongoDB administrator can still modify or delete events if they have write privileges. External signed checkpoints are recommended to detect wholesale deletion/rollback.

## Existing data and deployment

Older `guardianConsents` rows may not have `latestEventId` or history. They remain legible as current state; the history endpoint marks incomplete historical evidence rather than fabricating past events. Before treating them as legally adequate, verify original evidence or request fresh approval; **do not automatically mark a legacy record legally verified**. Schema creation adds `guardianConsentEvents` indexes (unique sequence per consent, student/guardian/time).

Configure the approved consent text in the UI, test the exact deployed text hash, ensure the parent is shown the corresponding version before pressing Grant, and obtain counsel review on age threshold, lawful basis, guardian identification, retention and user notices. This change does not independently establish that the consent is legally valid.

## Tests / operational limitations

`node --test tests/unit/consent-version-policy.test.mjs` tests version history integrity, tampering, re-consent, and production config. The existing consent integration scenario now asserts the ability to retrieve original and renewed versions and that older versions are rejected. Full integration tests require project dependencies and an isolated MongoDB replica set. No production DB is contacted or mutated.

### Additional caveats

The `legacyHistoryIncomplete` flag is persisted after a legacy current-state record is updated; a first newly generated event is **not** proof of the earlier consent history. The retrieval endpoint includes `historyComplete=false` where legacy history cannot be reconstructed. The collection is append-only through this application's routes but not immutable against administrators with database write access; export signed checkpoints to independent immutable storage for high-assurance audit.

**Deployment readiness:** Consent text shown on screen must be confirmed as exactly the configured SHA-256 digest. Production rollout requires both environment variables (text digest and audit HMAC secret); missing values cause new consent submissions or protected processing to fail closed. An HMAC rotation strategy with retained historical verification keys is not implemented. The MongoDB-backed integration scenario is written but not executed in this environment.
