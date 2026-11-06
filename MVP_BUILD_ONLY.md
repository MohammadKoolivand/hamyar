# Simple MVP staging deployment (temporary)

The automatic `Verify HodHodeh MVP` workflow now runs only:

1. Checkout
2. Install locked dependencies with `npm ci`
3. Build once (`npm run build`)
4. Package and upload the exact build artifact for the `staging` push

Automatic `typecheck`, `lint`, security scans and tests are **not run**. The staging workflow deploys the successful build artifact without rebuilding.

To make a staging-only Next.js build, the Verify job sets `HODHOD_MVP_SKIP_TYPECHECK=1`. The Next.js config ignores TypeScript errors **only when this flag is set**. Never set this in production.

The separate `Deep HodHodeh verification` workflow remains manual.

## Deploy

```sh
git add .
git commit -m "Simplify staging MVP build"
git push origin staging
```

Deployment still requires the existing GitHub staging secrets/variables, remote deploy script, database preflight, server backup, health check, and rollback. First-time server bootstrap is not automated.

**Not suitable for real users:** re-enable all important CI checks and resolve any reported findings first. A successful build is not a security/behavioral validation.
