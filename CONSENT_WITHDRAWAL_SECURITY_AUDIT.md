# Consent withdrawal security review — implementation notes

## Scope and authority
- The existing `POST /api/privacy/children/:studentId/consent` accepts `decision: "revoke"` only from an authenticated `parent` with a currently **verified** `parentLinks` relationship to the specified student. The server determines the actor ID from the session, not from the request.
- Unrelated parents, teachers, students and forged student IDs receive a permission error. The request uses a strict body schema.
- Withdrawal is **not** acceptance of a revised policy. A previously granted version can be withdrawn even when the configured text version has changed.

## Effects
- The current guardian consent record is set to `revoked` and a new append-only, integrity-chained consent event is written. Both changes and the student-wide `consentProcessingSuspended` flag are written within one MongoDB transaction, alongside an audit entry.
- The student-wide suspension prevents an older grant by a second guardian from silently leaving processing enabled. The same suspension is triggered if an administrator rejects a guardian relationship. A **new** verified grant on the current policy explicitly clears suspension. Whether a subsequent grant by a different guardian should be legally sufficient requires counsel's approval for the market.
- In Production (and when `STUDENT_CONSENT_REQUIRED=true`), the API `preHandler` denies student educational actions, and teacher operations scoped to a specified student, through `ensureStudentConsent`. Login, logout, status and privacy rights endpoints remain available. The student-facing status endpoint exposes `allowed=false`/`requiresReconsent=true` after withdrawal.
- Enrollment records are **not** deleted automatically. They may continue to exist for institutional reporting, but their existence is not equivalent to consent to process new student activity.
- Historical learning results, responses, progress records, and consent events are retained pending the separately approved retention/deletion policy. Withdrawal is not a deletion request, and must never be reported as completed erasure.

## Remaining work / deployment conditions
- Execute integration tests with a MongoDB replica set and dependencies installed. Tests cover unauthorized actor, forged student ID, withdrawal on a stale text version, access denial, retained historical assignments, read-back of immutable consent history and re-grant on the current version.
- Audit background workers, asynchronous tasks, imported content pipelines, notification queues, third-party vendors, and report generation that could operate without the student/teacher `preHandler`. Apply the consent gate before these operations, and implement appropriate cancellation or suppression where necessary.
- Determine with legal counsel whether one verified guardian's revocation must suspend all processing, whether another verified guardian may restore consent, what processing may continue on other legal bases, and how historic education records/backup retention should work.
- Run race/concurrency and end-to-end tests in staging. In-flight requests or jobs that started before withdrawal may require a final authorization check immediately before committing new processing.
- No production data or external service was accessed or modified during this change.
