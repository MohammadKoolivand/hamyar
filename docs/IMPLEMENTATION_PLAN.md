# Prioritized Engineering Roadmap

Baseline: commit `541ac2f1531686d1ade3cfa5503df90ae33526de`; clean working tree; origin https://github.com/MohammadKoolivand/hamyar.git. No push/merge/history changes authorized or performed.

## P0 — Data Integrity

Status: Completed

### Tasks

- [x] Inspect implementation and verify split-write, retry, completion/review race defects.
- [x] Real MongoDB replica-set transaction infrastructure; fail closed on standalone.
- [x] Atomic practice/evaluation/hint records and idempotency; serialize completion/review.
- [x] Explicit mission/assignment transitions and cancellation.
- [x] Security audit: origin/proxy, sessions, invites, logs, data exposure, proprietary fonts.
- [x] Failure injection, concurrency, restart/retry, state/isolation tests and existing E2E.

### Verification

- Tests run: typecheck, lint, production build, 20 unit/integration tests, 4 Chrome E2E; topology/state unit checks added and run separately.
- Results: PASS; isolated replica set on 27019; existing DB copied without mutating standalone source; read-only audit=0 mismatches.
- Remaining risks: actual OS/process kill was not injected; abort-at-write-boundary and lost-response/app-restart were tested. Replica-set deployment required; historical Git font exposure and verified licensing need owner action. Distributed proxy/rate-limit deployment remains P5.

## P1 — Extensible Evaluation

Status: Completed

### Tasks

- [x] Numeric tolerances/invalid input; bounded symbolic subset and rubric contracts.
- [x] Deterministic reference/adversarial tests, existing review flow.

### Verification

- Tests run: typecheck/lint/build; 28 unit/integration tests including 374 generated algebra comparisons, invalid/adversarial inputs and symbolic→review integration; 4 Chrome E2E including symbolic authoring.
- Results: PASS.
- Remaining risks: explicitly bounded polynomial/linear-real subset, not a universal CAS; unsupported syntax/domain/precision routes to teacher. No arbitrary model/code execution.

## P2 — Real Practice Assistant

Status: Completed

### Tasks

- [x] Provider/orchestrator, Ollama configuration, output validation, policy and failure tests.

### Verification

- Tests run: typecheck/lint/build; 36 unit/integration tests; real Ollama qwen2.5:3b two-request smoke (token counts 145/12 and 202/15); 4 browser E2E with locally configured Ollama.
- Results: PASS.
- Remaining risks: inference-assisted selection from teacher-approved text only, not free-form generated diagnosis. An unconstrained introductory selection was too advanced in the initial real-model smoke; the pre-attempt candidate pool is now enforced in code. Scientific quality still needs pilot validation. Provider outages are explicitly labeled fallback or unavailable.

## P3 — Learning Analytics

Status: Completed

### Tasks

- [x] Evidence, role-specific reports, persistent mistake notebook, transparent mastery and recommendations.

### Verification

- Tests run: typecheck/lint/build, 42 unit/integration tests, 4 browser E2E; additive rebuild of 20 legacy attempts and integrity audit.
- Results: PASS; 0 quota/evaluation mismatches. Teacher corrections and concurrent same-skill missions tested.
- Remaining risks: explainable mastery thresholds are provisional, not scientifically validated; descriptive trends do not establish causality.

## P4 — UI Architecture

Status: Completed

### Tasks

- [x] Incremental feature/component extraction, preserving input and RTL/mobile flows.

### Verification

- Tests run: typecheck/lint/build; 4 E2E including unsent draft navigation/reload, 360px overflow and keyboard focus. P3 backend suite remains 42 passing tests.
- Results: PASS; root component reduced from 1666 to 447 lines; existing JSX extracted, not rewritten.
- Remaining risks: content/mission forms still use controlled root state; future hooks may reduce prop plumbing. This is not a full WCAG audit.

## P5 — Pilot Readiness

Status: In Progress

### Tasks

- [x] Real backup/isolated restore drill with document/index equality and source verification.
- [x] Single-process rate-limit test; bounded loopback HTTP load smoke; runtime/AI-usage probe and sanitized error correlation.
- [x] Pilot target recorded: Iran, grades 1–12; three roles and parent-access revocation implemented in extension below.
- [x] HTTPS deployment template and operational runbook; deployment explicitly unverified.
- [ ] Guardian verification, age-appropriate consent/versioning/withdrawal flow, retention and deletion decision + implementation.
- [ ] Account recovery through a verified channel, teacher/student relationship revocation, deletion/anonymization with backup policy.
- [ ] Actual HTTPS host, shared edge limiting/monitoring alerts, classroom/inference load and external restore drill.
- [ ] Independent security/WCAG/browser/device and scientific content review.

### Verification

- Tests run: 125-request authenticated limiter test, 60 HTTP health requests/concurrency 10; real mongodump/mongorestore of 436 documents/22 collections, document/index hashes equal; source audit 0 quota/evaluation mismatches.
- Results: implemented technical slices pass. P5 is NOT completed and the product is not cleared for a real-child pilot.
- Remaining risks: invitation is a technical link, not legal guardian verification/consent. Country/grades supplied by owner; retention duration and responsible verification process remain undecided. No live deployment or scientific validation performed. See PILOT_READINESS.md.

## Owner extension — Human + AI question authoring

Status: In Progress

### Tasks

- [x] Separate real Ollama QuestionGenerator, bounded structured output and timeout; no runtime mock generation.
- [x] Persistent private queue; edit/reference correction, explicit teacher approval or reasoned rejection.
- [x] Atomic approved question/version/draft/audit and idempotent retry; manual question creation also transactional.
- [x] Structurally readable but invalid grading references remain flagged drafts; cannot enter bank before correction.
- [ ] Final real-model browser verification and final test result recorded.

### Verification

- Tests run: authoring integration/unit checks, genuine qwen2.5:3b generation in Chrome; final rerun in progress.
- Results: previous real-model test exposed an invalid numeric reference on a second generation; draft correction path implemented rather than bypassing grading validation.
- Remaining risks: output remains unverified educational material until human review; no automatic publishing or claim of scientific accuracy. Concurrent same-key inference can consume extra model work; educational drafts/versions remain unique.

## Owner extension — Parent portal and licensed local Persian font

Status: In Progress

### Tasks

- [x] Parent role/invite, per-parent/student/teacher link and read-only scoped analytics.
- [x] Teacher private notes/override reasons and unrelated relationships excluded; parent cannot submit answers/hints/reviews.
- [x] Parent access revocation, audit and pending invitation invalidation.
- [x] Licensed local IRANSans enabled outside Git, deterministic fallback in fresh checkouts; Poppins remains Latin font.
- [ ] Final integrated browser check: AI-approved question → student work → parent result → revoked access.

### Verification

- Tests run: real Mongo parent isolation/mutation/revocation checks; final cross-teacher/browser/font checks in progress.
- Results: implementation complete; final verification pending.
- Remaining risks: parent invitation is not guardian identity proof. Existing accounts are not rewritten; parent access is granted only for an explicit invitation/link.
