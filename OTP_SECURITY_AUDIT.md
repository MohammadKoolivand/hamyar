# Phone OTP security hardening (2026-11-06)

## Baseline findings
The existing implementation already uses a cryptographically random six-digit OTP, HMAC-SHA256 at rest, a 300-second server-enforced expiry, five failed attempts per challenge, a 60-second per-phone resend cooldown, five sends per hour, IP-based route limits, and a MongoDB transaction to consume the challenge alongside creating the login session. A development-only bypass is restricted to loopback app and local development MongoDB and is denied outside those conditions.

## Changes in this patch
- Bound code derivation, the stored challenge, and successful verification to the explicit `phone-login:v1` purpose; the existing phone and UUID challenge identifier also remain bound.
- Added MongoDB-backed `otpVerifyThrottle` (15 attempts per phone per rolling ten-minute window, including invalid challenge identifiers), using conditional atomic increments to work across application instances, plus a TTL index. Existing per-challenge five-attempt limit remains.
- Extended the Fastify log redaction list to include OTP code, challenge identifier, code hash and request/response bodies.
- Added integration regressions for cross-phone verification, wrong-purpose rejection, concurrent replay, parallel guessing, and the persistent rate limit; expanded TTL index coverage.

## Behavior and limits
- Verification budget failures return HTTP 429, ordinary bad/expired/consumed codes return HTTP 400, and SMS provider failure returns HTTP 503 without exposing provider errors.
- The first challenge created before deployment of this version becomes invalid because purpose is required; affected users can request a new OTP after the existing cooldown.
- Rate-limiting by phone can be abused for temporary denial-of-service against a victim; IP rate limiting and conservative thresholds reduce but cannot eliminate this risk.
- Route-level rate limits are in-memory per instance; the added phone-level verification limit and existing phone resend limits persist in MongoDB across instances.

## Validation performed
- `node --experimental-strip-types --check` succeeded for modified TypeScript files (syntax only).
- Full TypeScript typecheck and integration tests could NOT run here: package dependencies were not installed, `npm ci --offline` failed because package tarballs are not cached, and no test MongoDB replica set was available. Run `npm ci`, `npm run typecheck`, and `npm test` with the configured test replica set in CI before deployment.
