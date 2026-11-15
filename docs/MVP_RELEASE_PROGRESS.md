# MVP release progress — Hamyar

## Step 1 — audit baseline (owner-provided, 2026-11-15)

- Reported baseline: `f2cbbbb` on `main`.
- Owner-reported validation: typecheck PASS, lint PASS, 142/142 fast tests PASS outside sandbox, production build PASS.
- MongoDB integration, browser E2E, OCR and live deployment were **not** verified in that audit.
- The audit report text was supplied in the conversation; the named progress file was not present on the fetched default GitHub branch at the beginning of this change. This file preserves that provenance, rather than inventing missing test logs.

## Step 2 — codebase stabilization (2026-11-15)

### Verified by source inspection

- `src/lib/app-routes.ts` already maps unknown paths to the public question-selection home.
- `src/components/mobile-bottom-nav.tsx` already places Home in the middle for 5-item menus.
- `lucide-react` is the dependency and source for inspected navigation icons.
- `src/app/globals.css` supplies B Nazanin Persian glyphs and Poppins Latin glyphs from local assets; removed duplicate Latin font-face rule.
- `HeaderDropdownController` supports outside-pointer closing, Escape, and mutually exclusive open menus; removed redundant outside-click handler.
- The Next.js API bridge previously included an explicit 512 KiB limit for PDF library chunk paths, despite a 64 KiB general request limit.

### Implemented

1. Extracted the existing Next-to-Fastify injection and payload handling into `src/server/api-bridge.ts` for focused regression coverage; the route now delegates to the bridge.
2. Added `tests/unit/api-bridge.test.ts`, covering exact 512 KiB chunk acceptance, 512 KiB + 1 rejection with HTTP 413 before backend handling, and retention of the ordinary 64 KiB limit.
3. Removed a duplicate Poppins `@font-face` declaration and duplicated header outside-click listener.

### Test evidence and limitations

- **Not run in this integration:** typecheck, lint, unit test suite, production build, actual browser E2E and live-server smoke test; only remote source reading/writing was available.
- The new unit tests exercise the real API forwarding implementation with in-process Fastify, **not** a network request served by Next.js and a real MongoDB. A full HTTP/DB integration test, real PDF upload, and deployed smoke check remain required before release.
- Font loading on deployed devices, OCR and live authentication were not independently confirmed.
- All implementation changes are code-level and do not change production data or server configuration.

### Remaining release gates

- Execute `npm run typecheck && npm run lint && npm run test:fast && npm run build` in a complete checkout with dependencies installed.
- Run MongoDB replica-set integration and browser end-to-end tests, including actual HTTP PDF upload from the Next.js server.
- Validate font assets, real browser rendering, live server health, external services and privacy requirements.
- Avoid promoting this step to Production based solely on source changes.

### Status

**Step 2: CODE CHANGES COMPLETE; TEST/DEPLOYMENT VERIFICATION PENDING.**

## Step 3 — independent student practice (partial implementation, 2026-11-15)

### Verified in existing source

- Public questions already start an authorized individual assignment using `courseId = questionVersionId` as an **intentional synthetic identifier**, not an accidental course-ID bug.
- `activeLibraryAccess` independently rechecks current public visibility/version, and existing integration coverage verifies access revocation.
- The current authenticated practice entry point is still single-question. A multi-question persisted session is **not** implemented here.

### Changes made

1. Added a clearly labeled, up-to-ten-question **guest preview** that accepts input locally without grading, sending answers or permanently storing personal responses; completion reports only how many answers were entered.
2. Added a `practiceMode: "self"` marker for newly created independent public-library assignments, retaining compatibility with legacy records identified by `courseId === libraryQuestionId`.
3. Restrict direct assignment access for non-students, list visibility and teacher review access for independently initiated public-library practice. Publishing a question must not grant its author access to a learner's independent exercise records.
4. Added tests for classification of current/legacy independent practice and cross-role access to independent student assignments.

### Verification and limitations

- No Typecheck, Build, unit/integration or E2E tests were executed in this connector-only environment. Added tests are **unverified**.
- Guest preview deliberately has no score, server-side answer validation, or saved history and does not bypass consent/authorization to use existing authenticated practice.
- Authenticated multi-question sessions, guest auto-grading (if authorized), durable session continuation, separate progress reports, and full browser tests remain **outstanding**.
- Publication/deployment of Step 3 is **not authorized by CI evidence** merely because these source changes are committed.
- The earlier Stage 2 staging deployment `43754665073` was in progress when queried; a successful website activation was not independently established.

### Status

**STEP 3 PARTIAL — SOURCE CHANGES COMMITTED; COMPLETE MVP ACCEPTANCE NOT MET.**

## Step 4 — teacher lessons, individual assignments and group tasks (2026-11-15)

### Existing behavior confirmed from source

- Teacher course creation, enrollment requests with explicit approval, question selection/paging/preview, individual mission drafts and publication already exist.
- Group classes, immutable student recipient snapshots, atomic per-student publication, distinct student evidence and teacher reports already exist.
- Server-side ownership is enforced for individually/group-assigned question versions. Allowing a teacher to assign questions in the shared public bank **owned by other teachers** needs an explicit cross-owner permission/reference model and is not yet provided by these changes.

### Implemented

1. Individual and group mission creation accept optional ISO `dueAt` and carry it to student assignments; existing records without `dueAt` are unaffected.
2. Teacher interfaces now offer optional date/time fields; individual mission creation shows publication as a distinct follow-up step, with advanced hint configuration under a collapsible control.
3. Group tasks can be cancelled with a teacher-only, transaction-backed endpoint. Draft cancellation does not publish, and cancellation of an already published task cancels only `published`/`in_progress` assignments and missions; existing completed/submitted evidence is retained.
4. Group task list includes deadlines and cancellation state; teacher can still inspect saved per-student reports after cancellation.
5. Added MongoDB integration regression tests for due-date propagation, idempotent group cancellation, authorization and blocking publication after cancellation.

### Notes and remaining work

- A due date is currently **metadata for scheduling/display**, not a hard server-side submission cutoff. Do not advertise automatic late-submission enforcement.
- The shared public question bank is not automatically assignable by a different teacher, because authorization/data ownership and reference control need a compatible design.
- Group recipient selection remains a separate class-management workflow, rather than a single unified assignment wizard.
- Client end-to-end wizard/mobile verification and full MongoDB integration were **not run** from this connector-only environment.
- The Step 3 multi-question, saved independent practice acceptance gate remains open.
- Tests requiring a real MongoDB replica set, browser E2E, build, typecheck and lint need to be run in a full local/CI checkout; no success is claimed without execution.

### Status

**STEP 4 PARTIAL — deadlines, group cancellation and targeted tests implemented; end-to-end acceptance not verified.**

## Step 5 — direct private PDF assignments to course members (2026-11-16)

### Prior functionality reused

- The existing PDF library supports validated ready/pending PDF state, chunked upload (512 KiB), SHA-256 verification and independent optional OCR import.
- Teacher-owned courses, active student enrollments, class groups and per-student lesson authorization already exist.

### Implemented

1. Added the isolated `pdfDeliveries` record family, with one record per recipient, batch association, optional `dueAt` and separate `assigned` / manually `completed` / `cancelled` states. It does **not** treat file access as completed homework or grading.
2. Added `POST /api/pdf-deliveries` for private, ready teacher-owned PDFs; checks course ownership, all active recipients, exact class roster when a group is selected and runs inside an idempotent transaction. Recipient IDs are snapshotted. Writes to enrollments and the source file protect against concurrent membership revocation and deletion.
3. Added role-scoped `GET /api/pdf-deliveries`, secured `GET /api/pdf-deliveries/:aid/file`, student `POST /api/pdf-deliveries/:aid/complete` and teacher `POST /api/pdf-deliveries/:batchId/cancel`. Student access checks current course + enrollment and cancelled state; PDF bytes are integrity-checked and response headers disable caching and PDF scripts.
4. Successful file retrieval increments a separate `fileAccessCount` / `lastFileAccessAt`, which means **file request**, not confirmed actual viewing or academic completion.
5. Blocked permanent deletion of a PDF referenced by any past delivery to preserve historical homework; per-file data remain intact after cancelling recipients. This needs future retention/cleanup policy review.
6. Wired a teacher send form and per-file 'Send to students' action into the existing PDF library, with choices for lesson, selected students or complete class and optional deadline; installed a receiving list on the student's homework screen with secure download and explicit "done" control.
7. Defaulted new PDF metadata and the teacher upload UI to **private** and requires private PDFs for recipient-only delivery; public PDFs remain separately browseable and are not misrepresented as exclusive to recipients.
8. Added per-teacher delivery history with counts of file requests and manually completed work, plus cancellation controls. Added transient 512-KiB chunk retry (up to 3 attempts; 4xx errors are not retried).
9. Extended the request client idempotency keys and added additive MongoDB indexes.
10. Added `tests/integration/pdf-deliveries.test.ts` for replay-safe sends, class/lesson enrollment, private-download RBAC, actual PDF bytes, cancellation, deletion protection, and independent completion status.

### Remaining or unverified

- Full `npm run typecheck`, `npm run lint`, `npm run test:fast`, `npm test`, `npm run build`, and actual browser E2E were **not executed** because only remote repository editing was available; direct cloning failed due to DNS resolution to GitHub. The tests above are **written, not passed**.
- The existing upload system still deletes a pending upload after final failure; new retry covers transient individual chunks but does not persist/restart an interrupted session across browser reloads.
- Due dates are metadata for the UI; automatic blocking of late submissions is **not implemented**.
- An actual file request is measured; the server cannot prove whether a document was read or that a download was saved.
- No browser E2E for a full teacher → student → secure PDF → complete workflow was run.
- Retention, storage quota, archival and legal/privacy review must be completed before general release.
- Previous Step 3 and Step 4 acceptance gates also remain partly open.

### Status

**STEP 5 CODE IMPLEMENTED — TEST EXECUTION, BROWSER VERIFICATION AND DEPLOYMENT PENDING. DO NOT DECLARE RELEASE READY.**

## Step 6 — public question exact-duplicate protection and similarity preview (2026-11-16)

### Existing functionality examined

- Import review had its own owner-scoped normalized statement/options fingerprint.
- `persistQuestion` is shared by manual question creation, confirmed PDF-extracted questions, and AI draft approval; version revision uses a separate write path.
- Public questions are currently accepted immediately as verified; the admin approval queue and licensing/moderation workflow is **Step 7** scope, not yet implemented here.

### Implemented

1. Added `src/server/question-duplicates.ts`: versioned SHA-256 exact fingerprint with Persian/Arabic letter and digit normalization. Mathematical operators, superscripts, options order and image references remain distinct to avoid unsafe auto-merging.
2. Added lexical similarity screening (not a claim of semantic/embedding equivalence) over up to 5,000 latest verified CURRENT public versions. The return is at most 10 matching questions, exposing only public statement/ID/classification/score, never private questions, answers, hints, or owner private data.
3. Added teacher-only `POST /api/questions/duplicates/check` to preview exact and probable matches before manual entry, with clear UI warning when text or choices change after a check.
4. Added transactional `publicQuestionFingerprints` claims keyed by the fingerprint. Exact matches reject new public submissions, and unique `_id` guarantees that concurrent writers cannot reserve the same fingerprint. Private teacher questions do not reserve public fingerprints.
5. Connected the guard to `persistQuestion` (manual, PDF, AI-reviewed) and the revision path, including release of old fingerprints when the CURRENT question becomes private or changes.
6. Preserved all prior versions and existing private question data; did not run a data migration/backfill.
7. Added unit and MongoDB integration tests for Persian normalization, numeric/math differences, option order, images, public/private filtering, exact/near matches, concurrent teachers, revision and fingerprint release.

### Limitations / outstanding acceptance

- **Tests and production build were not executed**: the available connector can edit GitHub contents but cannot execute a full checkout; direct GitHub clone failed due to DNS resolution. Added tests are not evidence of passing tests.
- The 5,000-record recent-public catalog cap means similarity (and legacy unindexed duplicate coverage) is **best effort**, not a guarantee across a larger bank. New exact duplicates are transactionally protected only within the new fingerprint registry; an approved, indexed backfill strategy is needed before claiming comprehensive cross-bank protection.
- Lexical similarity is a suggestion, not semantic equivalence. Image and formula matching still require human review.
- Similar-but-not-exact questions currently remain eligible to register separately; only exact duplicates are blocked. A structured "use existing", "independent with reason", and "send to moderator" workflow, full rights/provenance policy and public moderation belong to Step 7.
- Existing owner-scoped PDF import check remains for import-specific idempotency; the shared public guard is an additional cross-owner check.
- All prior incomplete Step 3/4/5 test/release gates remain open.

### Status

**STEP 6 CODE IMPLEMENTED PARTIALLY — EXACT-GUARD AND TEXT PREVIEW ADDED; TESTS, SCALE VALIDATION, MODERATION AND RELEASE NOT VERIFIED.**

## Step 7 — moderated public question bank and contributions (2026-11-16)

### Implemented

1. Introduced `publicQuestionSubmissions` (one reusable proposal record per logical question), `questionContributions` (an attribution record for exact-duplicate links), and `publicQuestionReports` for user quality reports. Added additive MongoDB indexes.
2. Teacher-side publication proposal for a **CURRENT PRIVATE version** with attested rights basis (`original`, `licensed`, or `public_domain`), source reference and optional rights note. Only the owning teacher can submit; privacy remains unchanged while pending. Existing private versions and assignments are not rewritten.
3. Administrator-only pending queue; reviewers can approve, reject with a reason, or link an **exact duplicate** to an existing current public question. Approval creates a NEW immutable version pointing the logical question to the approved public version, preserves original owner, registers a fingerprint, and records the moderator, justification and source/rights statements.
4. Linking an exact duplicate does **not** publish the teacher's private question or duplicate the canonical public version. It creates an owner-scoped contributor record to preserve its separate provenance.
5. Review operations are transaction-backed and change the pending status conditionally, with audit entries. Stale requests after a revision cannot be approved.
6. In environments where `NODE_ENV=production` (including production-built staging), create and revise APIs now **fail closed** to `private`, even if a client requests direct public publication. The moderation endpoint is the only route here that promotes a private version to public. Development/test environments intentionally retain legacy direct-public API semantics for older tests; **do not infer production behavior from tests alone**.
7. Connected the teacher proposal form and the administrator moderation queue to the content bank. Manual authoring UI defaults private and directs public publication through moderation.
8. Added a signed-in quality-report workflow for current public questions, with rate limiting, category, description, and an admin-only report queue. Marking a report resolved records review but does not silently change a question's answer or version.
9. Added unit tests for publication policy and MongoDB integration regression tests for private submissions, admin RBAC, immutable publication, duplicate canonical linking, stale revisions, private-report blocking and quality-report resolution.

### Significant remaining limitations

- **No test execution in this connector context.** Typecheck, lint, production build, MongoDB integration and Playwright tests are UNRUN; no deployment was performed. Direct Git clone failed due to GitHub DNS resolution.
- The source/license declaration is an **attestation**. Independent verification of rights, publisher permissions, scientific accuracy and moderator training are manual release requirements.
- Existing public versions remain public for backwards compatibility. A historical-content moderation/backfill and licensing review has NOT happened. Existing public examples therefore are not evidence of having passed this new review.
- The Step 6 fingerprint comparison uses a capped recent-public candidate scan. Full legacy duplicate coverage, accuracy calibration and large-catalog performance tests are outstanding.
- The report queue resolves complaints but does not provide a one-click editing/takedown workflow; a correct, versioned revision still belongs to the author or a separately authorized operator.
- Linking duplicates records contributor provenance but does not yet automatically grant other teachers the right to assign a canonical question in private class assignments. That requires the cross-owner reference policy from the remaining MVP work.
- Existing prior test/deployment and privacy gates from Steps 2–6 are still open. This stage must be verified in CI and an isolated MongoDB replica set before staging or production release.

### Status

**STEP 7 CODE ADDED; INDEPENDENT TESTS, RIGHTS REVIEW, FULL CATALOG VALIDATION AND PUBLIC RELEASE APPROVAL PENDING.**

## Step 7 — common public bank, private proposals, human review (2026-11-16)

### Changes committed in the Step 7 feature branch

1. Added a dedicated private-to-public submission workflow (`src/server/modules/public-question-review.ts`), separated from original teacher-owned questions. A teacher may propose only the CURRENT private version of a question they own, with a rights-basis declaration, source reference, affirmative publication permission, and optional supporting note.
2. Added a super-admin-only queue to approve, reject, or link an **exact** duplicate to an already current, verified public question. Decisions require a human explanation. Approval generates a NEW immutable public question version; historical private versions, owner IDs and existing question-related evidence remain intact.
3. Added `publicQuestionContributions` **conceptually** via the actual `questionContributions` collection: a canonical link for a matched duplicate that keeps the submitted question private and attributes its original owner internally, without duplicating the public question.
4. Added `publicQuestionSubmissionEvents` as an append-only audit trail for submission and moderation decisions, alongside the existing audit logs. Proposal rows may be reused following rejection or revision while the event history remains intact.
5. Added a centralized fail-closed policy: in Node production environments (including deployment environments using `NODE_ENV=production`), normal manual, PDF-import and AI-approved question creation/revision persists private regardless of a client-provided public-visibility flag. Only the dedicated administrator review can publish a new version. Existing public questions are not retroactively unpublished.
6. Teacher-side proposal form and status list were added to the content bank; the manual question editor now defaults private. Admin content bank now displays pending proposals and the reference answer/options for *authorized human review only*. Private answers are not returned to the public duplicate-preview endpoint.
7. Added an authenticated `POST /api/questions/:vid/report` for public CURRENT question mistakes (category, explanation, rate limit), and an administrator-only list/resolve workflow for reports, with audit records. Closing a report does **not** silently rewrite a historical question version.
8. Added the required explicit role registry entries and additive MongoDB indexes. Also repaired the missing registered access-route entry for the earlier duplicate preview endpoint.
9. Wrote unit and MongoDB integration tests for the production publication policy, ownership/RBAC, immutable admin approval, linking canonical exact matches, rejection, stale version protection, reporting and privacy of answer keys.

### Open limitations and release gates

- **Tests are written, NOT executed**. This environment has repository-content tools but no working clone/network access to GitHub; `git ls-remote` failed DNS resolution. Typecheck, lint, unit/integration suites, build, E2E and real deployments are not verified.
- Legacy previously-published question versions remain public and have not undergone a rights/scientific/duplicate audit. A non-destructive moderation/backfill plan for those is required.
- The Step 6 similarity search is bounded to the 5,000 latest public candidates; full-bank uniqueness and matching for legacy data remain best-effort until a reviewed backfill and scaling/index strategy is completed.
- Licensing/source assertions must be checked by a trained human; code cannot establish ownership or permission. No automated science or copyright clearance is claimed.
- Canonical contribution links preserve provenance but do not yet implement cross-owner classroom assignment permissions.
- User reports can be administratively closed, but changes to erroneous questions still require separately authorized versioned editing; automatic takedown, appeals and cross-system retention remain future work.
- Development/test mode retains legacy direct-public behavior to avoid silently breaking old test fixtures; test plans must explicitly validate `NODE_ENV=production` fail-closed enforcement before release.
- Privacy, backup, monitoring, production deployment, complete browser workflows and prior Steps 2–6 unverified gates are still open.

### Status

**STEP 7 IMPLEMENTATION COMMITTED IN SOURCE; TEST EXECUTION AND PUBLIC RELEASE READINESS NOT VERIFIED.**
