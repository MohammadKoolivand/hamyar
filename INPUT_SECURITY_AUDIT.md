# API / NoSQL input hardening audit

## Scope reviewed
- Fastify API registration, API proxy, MongoDB access through `ctx.c` and existing route-level Zod parsing.
- Server-side search filtering: the only route consuming a client-supplied query parameter is `GET /api/students/:sid/remediation-candidates` (`courseId`). Database `$in`, `$or`, sorts, and projections examined elsewhere were constructed on the server from scoped records, not passed through as arbitrary client-provided selectors.
- Question creation and content import use structured Zod validation; binary PDF/image import has separate content-type, size and signature checks.

## Changes
- `src/server/security/input-validation.ts`: shared recursive structural validator; rejects MongoDB `$`-prefixed operator keys, dotted selector paths, `__proto__` / `constructor` / `prototype`, excessive nesting, array lengths, object fields, long keys/strings, invalid numbers and non-JSON objects.
- `src/server/app.ts`: `preValidation` hook verifies body (excluding bytes), parameters and query before all route handlers. Query parameter allowlist defaults to empty, with `courseId` enabled for remediation candidate search only. The 64 KiB request body limit is retained, as is the separate 20 MiB binary import limit.
- `src/server/modules/remediation.ts`: strict scope schema for the one supported search query (`courseId` UUID).
- Unit and integration regression tests cover operator and dotted-key injection, prototype pollution, malformed strings and values, unknown filters and ordinary valid inputs.

## Verification
- `node --experimental-strip-types --test tests/unit/api-input-validation.test.mjs`: **4 passed / 0 failed**.
- MongoDB-backed integration tests were **written, not executed** because this checkout does not have installed npm dependencies and a running test MongoDB replica set. Run `npm ci && npm run typecheck && npm test` in configured CI.
- Remaining defense-in-depth work: verify full request schemas for every individual route (some Zod object schemas strip unknown fields rather than rejecting them), content pipeline resource limits, and environment-specific HTTP end-to-end fuzzing. Do not treat these static checks alone as a complete penetration test.
