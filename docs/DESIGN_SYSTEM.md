# HamYar — Luminous Learning Design System (v2)

Reference direction: luminous Persian EdTech, white-on-pastel glass, gently dimensional illustrated education iconography, indigo/teal/warm gold/lavender/pink. This document describes the implemented UI source, **not a pixel-perfect vector trace of the illustrative reference**.

## Source of truth

All design tokens and reusable semantic classes live in `src/app/globals.css`. All views should use these classes instead of copying RGBA and CSS blur values. Fonts stay as the authorized local Persian font and Poppins; do not fetch proprietary fonts from a remote source.

| Meaning | Token | Value |
|---|---|---|
| Primary / headings | `--hy-primary` | `#1F3F97` |
| Primary hover | `--hy-primary-hover` | `#19347E` |
| Mid primary | `--hy-primary-mid` | `#2B56B4` |
| Teal | `--hy-secondary` | `#2EC8C3` |
| Teal readable ink | `--hy-secondary-ink` | `#08746F` |
| Warm gold | `--hy-accent` | `#F4C15D` |
| Lavender | `--hy-lavender` | `#8C6AF3` |
| Pink | `--hy-pink` | `#E86AA7` |
| Canvas | `--hy-background` | `#F8FBFF` |
| Dark text | `--hy-text` | `#17305E` |
| Muted text | `--hy-muted` | `#526886` |
| Translucent surface | `--hy-surface` | `rgba(255,255,255,.73)` |
| Strong surface | `--hy-surface-strong` | `rgba(255,255,255,.89)` |
| Glass border | `--hy-glass-border` | `rgba(207,224,246,.77)` |
| Glass blur | `--hy-glass-blur` | `18px` |
| Card radius | `--hy-radius-card` | `24px` |

## Brand identity

The original plain dark icon has been replaced with a new authored SVG mark at `public/icon.svg`: blue open book with a rising cyan/teal two-leaf sprout, matching the actual reference mark's silhouette. The file is shared by the header/sidebar and authentication via `src/components/ui/brand.tsx`, and as the manifest icon. It scales without rasterizing. **Do not suggest this was an exact extraction from the reference infographic**: it is a clean scalable vector redraw of the logo silhouette viewed in the reference.

## Primitive components

- `glass-panel`: important sections, forms, analytics panels.
- `glass-card`: slightly elevated card with hover only for pointers.
- `glass-stat`: KPI tile with a four-accent mini-line; numbers keep deep indigo contrast.
- `glass-sidebar`, `glass-header`: floating luminous navigation and topbar.
- `glass-hero`: bright white-indigo-teal hero with subtle ambient rings, never a dark gradient banner.
- `glass-note`, `glass-option`, `glass-kicker`: notes, option rows, compact category badges.
- `glass-field`: accessible text/select/textarea with focus ring.
- `glass-button-outline`, `hy-button-primary`: light secondary and indigo gradient primary button.
- `hy-navigation-item[data-active]`: indigo selected nav with translucent highlight; `hy-icon-container[data-tone]`: pastel backing for Lucide symbols.
- `practice-sheet`: high-opacity reading surface that protects formula and question contrast.
- `hy-status-success/warning/error`: restrained semantic feedback, not fluorescent filled panels.

## Scope and safeguards

This is a presentation-only refresh across auth, teacher navigation/sections, student sections/practice, reports, and read-only parent portal. It must not alter auth, role permissions, group or individual mission logic, enrollment status, evaluation, or persistence.

The interface remains right-to-left; isolated LTR snippets remain LTR. Avoid any parallax and large animated glows. Reduced-motion preference removes lift/transition; when blur is unavailable all glass surfaces become opaque. Glass is decorative, never a substitute for a readable opaque question area. Control focus indicators must stay visible.

## Verification

Run `npm run typecheck && npm run lint && npm run build && npm test` and `npm run test:e2e` against an initialized MongoDB replica set. Playwright's `tests/e2e/design-system.spec.ts` asserts the design token and brand icon integration, captures a login screenshot at desktop and mobile sizes, checks for horizontal overflow and reduced-motion behavior. Other flow tests cover teacher/student dashboards, missions, practice, learning reports and access controls.

GitHub Actions saves screenshots/traces as `hamyar-ui-evidence`. Verify visually against the user-supplied reference at desktop and mobile; generated-image exact visual equality cannot be guaranteed purely from CSS/token tests. Ensure an explicit manual review for pixel details and contrast before release.

## Runtime notes

Next.js loads environment variables itself; do not add `--env-file-if-exists` into `NODE_OPTIONS`. The CLI checks port 5174 before dev start, and does not automatically kill processes occupying it.

## Page sizing and URL navigation (October 2026)

Each tab has a directly resolvable Next.js URL: `/dashboard`, `/students`, `/courses`, `/classes`, `/content`, `/homeworks` (the individual/group assignment list), and `/learning`. Legacy `/` remains a working login/dashboard entrypoint; initial invitation URLs `/?invite=<token>` continue to work. `/practice?assignment=<uuid>` and `/report?assignment=<uuid>` restore an individually authorized assignment on reload; records are fetched from the protected API, never from the URL alone. An inaccessible or malformed assignment link falls back to `/homeworks`.

Route names and mappings are defined once in `src/lib/app-routes.ts`; `src/app/[section]/page.tsx` makes deep routes resolvable on direct HTTP requests. Within the authenticated app, navigation updates browser history with the History API; popstate rehydrates the selected section. Internal teacher/student shortcuts and practice completion use the same navigation function. Browser back and forward must work after a hard refresh.

App shell uses CSS Grid with `content-start` and the shared header uses `self-start h-fit` to prevent grid-track stretching. Header vertical padding is halved from `py-4/py-5` to `py-2/sm:py-2.5`. Parent header uses `py-2/sm:py-3`. At ≥651px, the side column sizes to `max-content`; the sidebar is `min-w-max` and navigation labels do not wrap. Below this breakpoint the sidebar takes the mobile width and navigation remains horizontally scrollable. Keep the 360/390px viewport overflow assertions.
