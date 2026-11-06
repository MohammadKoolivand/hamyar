# Membership revocation and stale URL audit

## Security policy

An active course assignment is student-readable only if the exact student,
course and teacher still form an **active enrollment** and the course is active.
When an assignment was created with an `enrollmentId`, that same enrollment
record must still be active. Revoked or cancelled assignments may not be read,
answered, resumed, completed, or requested for hints through student APIs,
regardless of a previously issued URL or idempotency key.

The teacher retains access to historical evidence for authorized instructional
review. The system **does not delete** attempts, evaluations, activity history,
or audit records when access is revoked; retention and deletion periods remain
subject to the project's broader retention and privacy policy. Old cancelled
assignments do not reactivate automatically after a student rejoins. The
`accessRevokedAt` marker also invalidates old student content URLs for
completed/submitted work, while its historical state remains unchanged.

## Changes in this version

- Centralized course membership authorization for assignment detail, report,
  attempt, hint, completion and hint-report endpoints.
- Student assignment and mission lists filter course resources using current
  membership, publication and course state, not only cached ownership.
- Student dashboard excludes revoked course assignment content while retained
  evidence remains in the database.
- Membership revocation cancels unfinished assignments scoped by student,
  teacher and course, **including legacy and library assignments without an
  `enrollmentId`**. It marks *all* linked assignments with an irreversible
  student content access revocation timestamp, but retains finished states,
  attempts and reviews. This runs in a MongoDB transaction.
- Library unpublish cancels unfinished library assignments transactionally;
  it permanently marks all affected assignment links as revoked, including
  completed ones. Subsequent re-publication requires a fresh practice.
- Library start and course/group mission publishing write to the enrolled
  record inside the transaction to conflict with concurrent revocation;
  library starts additionally write the publication record to conflict with
  concurrent unpublishing.
- Replayed idempotency keys are authorization-checked before returning old
  responses in student practice entry points.

## Tests

Integration tests in `tests/integration/revocation-old-ids.test.ts` cover
revocation in the middle of an exercise, old detail/report/attempt/hint/complete
URLs, old start idempotency keys, library unpublish/re-publish, historical
attempt retention, and rejoining without resurrecting cancelled assignments.
`tests/integration/course-membership.test.ts` updates expected student
access after revocation to HTTP 404.

These tests require the project's dependencies and MongoDB replica set.
They must pass in CI/staging before production deployment. A static syntax
check alone is **not** a substitute for integration testing or concurrent
race testing under a running MongoDB service.

## Deployment verification

1. Run `npm ci` in a trusted build environment.
2. Start the documented MongoDB replica-set test instance.
3. Run `node --import tsx --test tests/integration/revocation-old-ids.test.ts tests/integration/course-membership.test.ts tests/integration/library-publication.test.ts`.
4. Test with two separate authenticated accounts, revoking one enrollment
   while that student's browser is open. Requests using old identifiers should
   return 404. Validate list/dashboard no longer expose private content.
5. Confirm retention of existing attempts, evaluations and audit logs.

No live database was accessed or modified during preparation of this version.

## Local verification performed

`node --experimental-strip-types --check` completed successfully for the
changed TypeScript files. Integration tests could not run here: `npm ci`
failed to finish in the isolated environment, so the `tsx` test runner was
not installed and no MongoDB test service was started. The test suite must be
run in staging before treating this change as release-approved.
