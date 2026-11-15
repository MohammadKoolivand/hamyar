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
