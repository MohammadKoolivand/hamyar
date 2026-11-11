# Question authoring and visibility

Teachers, super administrators and secretaries can author their own questions and import exams. Existing ownership checks remain enforced. Super administrators retain the access management console; secretaries retain delegated administration and cannot manage users globally.

Questions default to private. Manual creation, editing and import review expose a private/public selector. Public current verified versions appear in every authenticated student's library, including students without course enrollment. Course-specific publication remains supported for private questions.

Public practice uses the question version ID as its catalog scope. The server resolves visibility and the current version on catalog, start, practice, submissions and image access. A private revision removes the previous version from the library and blocks later access. Transactions serialize submissions against revision of the current question pointer. Answer keys are excluded from the catalog and practice payloads.

Regression coverage: `tests/integration/public-library.test.ts`, existing course publication, IDOR, mass assignment, authentication and result confidentiality suites. No existing private questions are made public automatically.
