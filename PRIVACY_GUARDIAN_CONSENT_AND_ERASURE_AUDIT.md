# Guardian consent and data erasure: technical implementation and unresolved legal requirements

## Scope / status (2026-11-06)

This is a **technical implementation, not legal approval**. Market/jurisdiction, age threshold, legal basis, identification method, data retention periods and parental authority require documented legal decisions. **No live database or vendor was contacted and no live data was deleted.**

### Current design and limitations

- Student educational API processing is blocked in production until an independently reviewed guardian relationship and an affirmative, version-specific consent exist. Development/test can enable the same gate with `STUDENT_CONSENT_REQUIRED=true`. `STUDENT_CONSENT_REQUIRED=false` does **not** bypass production controls.
- In the absence of a reviewed jurisdiction-specific legal-age decision, *all student accounts* are treated as requiring this consent gate. This is intentionally conservative; the application does not collect a verified birthdate and does not infer legal minority from the student role.
- Teacher invitations and parent educational links are not evidence of legal guardianship. An authorized super-admin must review the evidence **out of band** and enter `evidenceReference` and `legalBasisReference`. The application records the reference and actor/time, NOT the underlying proof document. No automatic document/authenticity verification is claimed.
- The verified parent must authenticate and explicitly grant consent to `educational-processing:v1` using the exact `STUDENT_CONSENT_POLICY_VERSION`; the record contains subject, guardian, scope, version, status and timestamps. Revocation blocks future protected student interactions; already-sent content cannot be remotely recalled.
- Auth endpoints, consent status, logout, and deletion requests remain reachable to allow onboarding and exercising rights; staff/student operations directly referencing a student identifier are gated. **Remaining work:** endpoint-by-endpoint data flow review for teacher batch operations, parent reports, analytics workers, notifications, AI processing, imported files, and pre-existing queued jobs. A generic role-level guard is not proof that every background processor is blocked.
- Admin should not verify legal relationships based only on invitations or a reference string. Independent evidence review and reviewer authorization are operational prerequisites.

### API operations

- `POST /api/privacy/guardian-links/:linkId/review` — super-admin only; decision verified/rejected; requires external evidence and legal-basis references.
- `POST /api/privacy/children/:studentId/consent` — verified parent only; grant/revoke; exact version and fixed scope; always rechecks the link.
- `GET /api/privacy/consent/status` — own status; no sensitive evidence content returned.
- `POST /api/privacy/deletion-requests` — authenticated self, or verified guardian requesting for a linked student; no arbitrary subject ID.
- `GET /api/privacy/deletion-requests/:requestId` — requesting user or super-admin; no other user's request.
- `GET /api/privacy/deletion-requests/:requestId/inventory` — super-admin; count-only inventory for accounts, enrollments, assignments, attempts, evaluations, evidence and selected related collections. This is not a complete discovery of unstructured or external personal data.
- `POST /api/privacy/deletion-requests/:requestId/execute` — super-admin only; requires explicit out-of-band legal review and retention register references. Executes account anonymization, credential removal, session and token invalidation, and parent-link deletion in one transaction. Leaves education records and audit history under a documented hold and tracks external follow-up as outstanding. Repeated execution fails.
- `POST /api/privacy/deletion-requests/:requestId/finalize` — super-admin only; requires evidence references for manual external system processing and retention register; marks completed **with documented retention**, never claims that every record was erased.

### Important erasure limitations and retention holds

The deletion execution **does not** erase all student answers, assessments, marks, evidence, educational assets, backups, analytics artifacts, or external copies. It returns `partially_executed_retention_and_external_pending` and explicitly enumerates retained and external categories. The word *completed* is reserved for a reviewer-attested follow-up and remains qualified by retention. The legal team must decide the precise records eligible for erasure vs restricted statutory retention, retention period, closure evidence, restore-from-backup implications, and vendors' DPA/DSAR procedures before any production deletion is approved.

The inventory covers known direct references but must be extended to all collections and storage paths before treating it as exhaustive. A dedicated erasure worker, per-record anonymization/deletion mapping, controlled retention-expiry job and processor-specific deletion acknowledgements are still required for end-to-end compliance. Do not use the endpoint with production subjects before approving this plan.

### Legal decisions required before student production onboarding

1. Market(s), controller/processor roles and applicable privacy/children laws; whether the educational institution rather than a parent may rely on an alternate legal basis.
2. Age threshold and method of reliable age assurance; accessible notices; affirmative consent text/version and withdrawal effects.
3. Parent/guardian authority and evidence standard, secure verification and review procedure, disputes, dual-guardian requirements, audit retention and appeal.
4. Data mapping, processor list, cross-border transfers, storage locations, child-specific minimization, purpose limitation and DPIA/risk assessment.
5. Erasure/objection rights, mandated retention periods for assessments and audit evidence, backups and archival restoration, response deadlines and identity verification.
6. Legal authority and accountable sign-off for `STUDENT_CONSENT_POLICY_VERSION`, retention register, and each deletion execution.

### Release conditions

- Configure `STUDENT_CONSENT_POLICY_VERSION` to a **reviewed** version; deployment preflight fails when absent.
- Document how admins verify guardian documents and how evidence references resolve to encrypted records with limited access.
- Run full integration tests with a throwaway MongoDB replica set, including concurrent grant/revocation and deletion races, read/write pathways, workers and outbound processors.
- Verify actual deletion/retention on representative staging data, backup retention and downstream vendors before allowing production execution.
- Keep this report with secure change-management approval and the outcome of an external legal review. **This document is not an attestation of legal compliance.**

### Tests

`node --experimental-strip-types --test tests/unit/privacy-policy.test.mjs` exercises policy rules without dependencies. `tests/integration/privacy-consent-erasure.test.ts` covers unverified guardian rejection, admin-only review, verified parental consent, withdrawal, wrong-subject deletion attempts, ownership-scoped tracking, admin execution, session invalidation, retention, and replay. Integration tests require application dependencies and a MongoDB replica set; they were written but not executed in the standalone archive review environment.
