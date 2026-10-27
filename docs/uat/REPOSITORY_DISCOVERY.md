# Repository discovery — 2026-10-27

Base: `4356a58b3f6a50119e38b1e6710f4668bf8c61f0`, branch `main`. Initial tree: modified compact gauge, import form year/track visibility, generated public/sw.js; these are owner-authorized pending changes, not UAT fixes. Snapshot hashes in SOURCE_MANIFEST.json. No push is permitted.

Next App Router → Node route adapter → Fastify inject modular monolith → MongoDB replica set. Server auth/RBAC ownership and transactions are primary; UI hiding is not the permission boundary. Roles: student, teacher, parent, secretary, super_admin. Providers: explicit mock-approved hints, local Ollama, teacher-selected AvvalAI. OCR worker and encrypted outbox mail worker are independent processes. Catalog is teacher-scoped and versions immutable for assignments.

Routes: /, /dashboard, /students, /courses, /classes, /content, /content-new, /exam-import, /resources, /settings, /homeworks, /learning, /practice?assignment, /report?assignment, /verify-email.

Docs differ from runtime: old API_CONTRACT says same-host Origin accepted, while current guard uses configured APP_ORIGIN. ACCESS_CONTROL old invitation subsection says OTP inactive, while PHONE_OTP and runtime implement it. Brand in app/current accepted product is هدهده, while this UAT requests هدهد: owner decision, no broad rename. PRD covers long-term scope; consent/deletion, public independent bank, institutional billing, global statistical difficulty are not implemented by this audit.

The current globals.css contains custom tokens/styles; older documentation claiming it only imports Tailwind is stale. No redesign was performed during UAT.

Exact dependency versions come from installed lock in evidence. All current test names/paths/lines in TEST_INVENTORY.json; a test inventory alone does not imply PASS.

## API inventory

| Method | Path | Module |
|---|---|---|
| POST | `/api/auth/register` | `src/server/modules/identity.ts` |
| POST | `/api/auth/login` | `src/server/modules/identity.ts` |
| GET | `/api/auth/me` | `src/server/modules/identity.ts` |
| POST | `/api/auth/logout` | `src/server/modules/identity.ts` |
| POST | `/api/invitations` | `src/server/modules/identity.ts` |
| POST | `/api/invitations/accept` | `src/server/modules/identity.ts` |
| POST | `/api/invitations/claim` | `src/server/modules/identity.ts` |
| GET | `/api/students/:sid/parents` | `src/server/modules/identity.ts` |
| POST | `/api/students/:sid/parents/:pid/revoke` | `src/server/modules/identity.ts` |
| GET | `/api/children` | `src/server/modules/identity.ts` |
| GET | `/api/students` | `src/server/modules/identity.ts` |
| GET | `/api/students/:sid/progress` | `src/server/modules/learning.ts` |
| GET | `/api/students/:sid/mistakes` | `src/server/modules/learning.ts` |
| POST | `/api/students/:sid/mastery/:skillId/override` | `src/server/modules/learning.ts` |
| GET | `/api/students/:sid/remediation-candidates` | `src/server/modules/remediation.ts` |
| POST | `/api/students/:sid/remediation-missions` | `src/server/modules/remediation.ts` |
| GET | `/api/courses` | `src/server/modules/courses.ts` |
| POST | `/api/courses` | `src/server/modules/courses.ts` |
| GET | `/api/enrollments` | `src/server/modules/courses.ts` |
| POST | `/api/auth/password-reset/request` | `src/server/modules/password-reset.ts` |
| POST | `/api/auth/password-reset/confirm` | `src/server/modules/password-reset.ts` |
| GET | `/api/assignments/:aid/report` | `src/server/modules/analytics.ts` |
| POST | `/api/evaluations/:eid/review` | `src/server/modules/analytics.ts` |
| GET | `/api/question-drafts` | `src/server/modules/authoring.ts` |
| POST | `/api/question-drafts/generate` | `src/server/modules/authoring.ts` |
| POST | `/api/question-drafts/:did/approve` | `src/server/modules/authoring.ts` |
| POST | `/api/question-drafts/:did/reject` | `src/server/modules/authoring.ts` |
| GET | `/api/class-groups` | `src/server/modules/class-groups.ts` |
| POST | `/api/class-groups` | `src/server/modules/class-groups.ts` |
| POST | `/api/class-groups/:gid/members` | `src/server/modules/class-groups.ts` |
| GET | `/api/group-tasks` | `src/server/modules/class-groups.ts` |
| POST | `/api/group-tasks` | `src/server/modules/class-groups.ts` |
| POST | `/api/group-tasks/:tid/publish` | `src/server/modules/class-groups.ts` |
| GET | `/api/group-tasks/:tid/report` | `src/server/modules/class-groups.ts` |
| GET | `/api/question-assets/:assetId` | `src/server/modules/content.ts` |
| GET | `/api/curriculum/catalog` | `src/server/modules/content.ts` |
| POST | `/api/curriculum/catalog/import` | `src/server/modules/content.ts` |
| GET | `/api/curriculum` | `src/server/modules/content.ts` |
| POST | `/api/curriculum/:nodeId/remove` | `src/server/modules/content.ts` |
| POST | `/api/curriculum` | `src/server/modules/content.ts` |
| GET | `/api/questions` | `src/server/modules/content.ts` |
| POST | `/api/questions/select` | `src/server/modules/content.ts` |
| POST | `/api/questions/difficulty-batch` | `src/server/modules/content.ts` |
| GET | `/api/questions/:vid` | `src/server/modules/content.ts` |
| POST | `/api/questions/:vid/revise` | `src/server/modules/content.ts` |
| POST | `/api/questions` | `src/server/modules/content.ts` |
| POST | `/api/auth/otp/request` | `src/server/modules/phone-auth.ts` |
| POST | `/api/auth/otp/verify` | `src/server/modules/phone-auth.ts` |
| GET | `/api/access/me` | `src/server/modules/access-management.ts` |
| GET | `/api/admin/users` | `src/server/modules/access-management.ts` |
| GET | `/api/admin/audit` | `src/server/modules/access-management.ts` |
| POST | `/api/admin/users` | `src/server/modules/access-management.ts` |
| POST | `/api/admin/users/:uid/access` | `src/server/modules/access-management.ts` |
| GET | `/api/admin/staff-assignments` | `src/server/modules/access-management.ts` |
| POST | `/api/admin/staff-assignments` | `src/server/modules/access-management.ts` |
| POST | `/api/admin/staff-assignments/:gid/revoke` | `src/server/modules/access-management.ts` |
| GET | `/api/staff/workspaces` | `src/server/modules/access-management.ts` |
| GET | `/api/staff/workspaces/:tid/roster` | `src/server/modules/access-management.ts` |
| GET | `/api/staff/workspaces/:tid/courses` | `src/server/modules/access-management.ts` |
| POST | `/api/staff/workspaces/:tid/invitations` | `src/server/modules/access-management.ts` |
| GET | `/api/settings/authoring` | `src/server/modules/ai-settings.ts` |
| GET | `/api/settings/authoring/models` | `src/server/modules/ai-settings.ts` |
| POST | `/api/settings/authoring` | `src/server/modules/ai-settings.ts` |
| GET | `/api/assignments` | `src/server/modules/practice.ts` |
| GET | `/api/assignments/:aid` | `src/server/modules/practice.ts` |
| POST | `/api/assignments/:aid/attempts` | `src/server/modules/practice.ts` |
| POST | `/api/assignments/:aid/hints` | `src/server/modules/practice.ts` |
| POST | `/api/assignments/:aid/hints/:hid/report` | `src/server/modules/practice.ts` |
| POST | `/api/assignments/:aid/complete` | `src/server/modules/practice.ts` |
| GET | `/api/student/dashboard` | `src/server/modules/student-dashboard.ts` |
| POST | `/api/courses/:cid/join-code` | `src/server/modules/course-membership.ts` |
| POST | `/api/course-requests` | `src/server/modules/course-membership.ts` |
| GET | `/api/course-requests` | `src/server/modules/course-membership.ts` |
| POST | `/api/course-requests/:rid/decision` | `src/server/modules/course-membership.ts` |
| POST | `/api/enrollments/:eid/leave` | `src/server/modules/course-membership.ts` |
| GET | `/api/enrollment-history` | `src/server/modules/course-membership.ts` |
| GET | `/api/missions` | `src/server/modules/missions.ts` |
| POST | `/api/missions` | `src/server/modules/missions.ts` |
| POST | `/api/missions/:mid/publish` | `src/server/modules/missions.ts` |
| POST | `/api/missions/:mid/cancel` | `src/server/modules/missions.ts` |
| GET | `/api/exam-imports` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports` | `src/server/modules/exam-imports.ts` |
| GET | `/api/exam-imports/:eid` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports/:eid/files/:kind` | `src/server/modules/exam-imports.ts` |
| DELETE | `/api/exam-imports/:eid/files/:kind` | `src/server/modules/exam-imports.ts` |
| GET | `/api/exam-imports/:eid/files/:kind` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports/:eid/extract` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports/:eid/manual-review` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports/:eid/retry` | `src/server/modules/exam-imports.ts` |
| DELETE | `/api/exam-imports/:eid/files` | `src/server/modules/exam-imports.ts` |
| GET | `/api/exam-imports/:eid/pages/:kind/:page` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports/:eid/items` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports/:eid/approve-batch` | `src/server/modules/exam-imports.ts` |
| POST | `/api/exam-imports/:eid/items/:iid/review` | `src/server/modules/exam-imports.ts` |
| POST | `/api/auth/email-verification/request` | `src/server/modules/email-verification.ts` |
| POST | `/api/auth/email/change` | `src/server/modules/email-verification.ts` |
| POST | `/api/auth/email-verification/confirm` | `src/server/modules/email-verification.ts` |
