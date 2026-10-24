# HamYar — Light Glassmorphism Design System

Scope: visual styling only; no changes to APIs, authorization, teacher/student workflow or learning data.

## Brand

Primary #233B8F; secondary #19B7AE; accent #F4B544; canvas #F8FAFC; text #1F2937.
Translucent white surfaces, blur 20px, white borders and soft indigo shadows. Tokens live in src/app/globals.css.

## Primitives

- glass-panel: main panels and forms.
- glass-card and glass-stat: compact cards and numeric KPIs.
- glass-sidebar and glass-header: floating light navigation.
- glass-hero: luminous white/turquoise hero, not a dark indigo rectangle.
- glass-kicker, glass-note, glass-option: readable chips, notes and list items.
- glass-field and glass-button-outline: keyboard-accessible form controls.
- practice-sheet: near-opaque readable question area.

Glass must never make mathematical content difficult to read. Limit nested glass surfaces.
Persian: authorized local IRANSans with system fallback; Latin: Poppins. Respect RTL and LTR isolation for math.

## QA

The Playwright flow captures teacher dashboard, missions, student dashboard/mobile practice, teacher report and student report.
An additional test inspects the login panel's computed backdrop and saves a login screenshot.
To verify: start a MongoDB replica set and Next.js server, run npm run typecheck, npm run lint, npm run build, npm test and npm run test:e2e.
Inspect saved screenshots for glass depth, light hero, mobile overflow and contrast.
Also check Safari/Firefox, keyboard operation, reduced motion and WCAG contrast before public use.
These instructions do not imply that browser tests have been executed.

## Runtime/CI verification (2026-10-24)

The standard Next.js CLI loads `.env` files; `npm run dev` and `npm start` no longer inject Node's `--env-file-if-exists` argument into Next workers. The dev script reports port collisions without killing any processes. CI tests both the CSS glass surface and the existing teacher/student flows with Playwright Chromium, and uploads screenshots/traces. CI visual assertions are not a substitute for a manual screenshot and contrast review. 
