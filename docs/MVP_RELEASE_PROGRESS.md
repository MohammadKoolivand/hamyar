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
