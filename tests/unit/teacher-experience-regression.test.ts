import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (path: string) => readFileSync(path, "utf8");

test("signed-in teacher pages use the shared site header without a separate sidebar", () => {
  const app = file("src/components/hamyar-app.tsx");
  const css = file("src/app/globals.css");
  assert.match(app, /hy-student-site-header/);
  assert.doesNotMatch(app, /glass-sidebar/);
  assert.doesNotMatch(app, /معلم آموزش می‌دهد/);
  assert.match(css, /hy-header-dropdown/);
});

test("new questions are private by default and require public-bank moderation", () => {
  const content = file("src/features/content/content-screen.tsx");
  const authoring = file("src/server/modules/authoring.ts");
  const review = file("src/server/modules/public-question-review.ts");
  assert.match(content, /useState<"private" \| "public">\("private"\)/);
  assert.match(content, /<option value="private">خصوصی<\/option>/);
  assert.match(content, /<option value="public" disabled>/);
  assert.match(authoring, /visibilityForAuthoredQuestion\(b\.visibility\)/);
  assert.match(review, /propose-public/);
  assert.match(review, /verifiedBy: admin\._id/);
});

test("bank removes global difficulty bulk action and preserves current page when editing", () => {
  const bank = file("src/features/content/question-bank.tsx");
  const list = file("src/components/ui/paged-list.tsx");
  assert.doesNotMatch(bank, /تعیین گروهی سختی نتایج فیلترشده/);
  assert.doesNotMatch(bank, /questions\/difficulty-batch/);
  assert.match(bank, /resetOnItemsChange=\{false\}/);
  assert.match(list, /Math\.min\(state\.page, maxPage\)/);
});

test("PDF upload reports measured aggregate chunk progress and distinct server confirmation", () => {
  const input = file("src/features/content/pdf-library-teacher.tsx");
  assert.match(input, /new XMLHttpRequest\(\)/);
  assert.match(input, /xhr\.upload\.onprogress/);
  assert.match(input, /PDF_LIBRARY_UPLOAD_CHUNK_BYTES/);
  assert.match(input, /offset \+ event\.loaded/);
  assert.match(input, /upload-session/);
  assert.match(input, /xhr\.timeout = 60_000/);
  assert.match(input, /role="progressbar"/);
  assert.match(input, /xhr\.status >= 200 && xhr\.status < 300/);
  assert.match(input, /uploadProgress}%/);
});
