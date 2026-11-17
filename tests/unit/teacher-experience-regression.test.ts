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

test("question authoring is public-only and bulk publication is available", () => {
  const content = file("src/features/content/content-screen.tsx");
  const editor = file("src/features/content/question-editor.tsx");
  const authoring = file("src/server/modules/authoring.ts");
  const bank = file("src/features/content/question-bank.tsx");
  const api = file("src/server/modules/content.ts");
  assert.doesNotMatch(content, /setVisibility|<option value="private">خصوصی/);
  assert.doesNotMatch(editor, /<option value="private">خصوصی/);
  assert.match(authoring, /visibility: "public" as const/);
  assert.match(bank, /عمومی‌سازی همه سؤال‌ها/);
  assert.match(api, /\/api\/questions\/publish-all/);
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
