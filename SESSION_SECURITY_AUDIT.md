# Session & cookie hardening audit

## Implemented
- Shared host-only session cookie options for password and OTP login (`src/server/security/session.ts`): HttpOnly, SameSite=Strict, Path=/, 7-day Max-Age, no Domain attribute.
- `Secure` is unconditional in NODE_ENV=production, regardless of COOKIE_SECURE override; local HTTP remains supported for development.
- Server-side expiry check remains in `src/server/context.ts`, independent of MongoDB TTL cleanup. Session tokens are high-entropy 32-byte random hex values and only SHA-256 hashes are stored in MongoDB.
- `securityRevision` is captured at session creation and checked on every authenticated request; administrative role change increments this revision and removes all target sessions.
- Logout deletes the matching server-side session and clears its cookie using consistent flags. Password reset and destructive email verification also clear with consistent flags.
- Login always creates an independently random token; any supplied pre-login cookie is never adopted as the authenticated session identifier.
- New regression coverage for cookie flags, invalid/fixed cookies, login token rotation, logout replay against protected APIs, server-side expiry and security-revision changes in `tests/integration/session-hardening.test.ts`.

## Already present in base project
- Origin and Sec-Fetch-Site validation for state-changing requests.
- Session removal on access changes, password reset, and account removal.
- Existing authentication and revocation integration tests in `tests/integration/auth-session.test.ts`.

## Verification performed
- Syntax-only TypeScript transpilation of all seven modified/new TS files completed without diagnostics.
- Full TypeScript type-check, MongoDB-backed integration suite, browser E2E and live deployment checks were **not run** (dependencies and test MongoDB were not available in this environment).

## Operational notes
- Serve production exclusively over HTTPS and configure APP_ORIGIN to the canonical HTTPS origin; otherwise Secure cookies will not be sent by browsers.
- All application nodes must use the same MongoDB session store; cookie flags do not replace server-side revocation.
- Review trust proxy / HTTPS termination and configuration before deployment; cookie is host-only and SameSite Strict so cross-origin frontends will require an explicit architecture redesign.
- If sessions created on very old code without `securityRevision` exist, the server interprets missing revision as 0 for backwards compatibility; admins can revoke existing sessions via administrative access changes or session DB purge.
