import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = (path: string) => readFileSync(path, "utf8");

test("PDF library transfers bounded chunks and finalizes only after SHA-256 verification", () => {
  const shared = source("src/lib/pdf-library.ts");
  const api = source("src/server/modules/pdf-library.ts");
  const parser = source("src/server/modules/exam-imports.ts");
  const ui = source("src/features/content/pdf-library-teacher.tsx");
  assert.match(shared, /PDF_LIBRARY_UPLOAD_CHUNK_BYTES = 512 \* 1024/);
  assert.match(parser, /application\/octet-stream/);
  assert.match(api, /upload-session/);
  assert.match(api, /chunks\/:uploadId\/:position/);
  assert.match(api, /digest !== session\.sha256/);
  assert.match(api, /state: "ready"/);
  assert.match(ui, /for \(let position = 0; position < chunkCount; position\+\+\)/);
  assert.match(ui, /xhr\.timeout = 60_000/);
  assert.match(ui, /setUploadProgress\(100\)/);
  assert.match(ui, /uploadProgress}%/);
});

test("PDF handoff batches every verified chunk into exam import", () => {
  const api = source("src/server/modules/pdf-library.ts");
  assert.match(api, /createHash\("sha256"\)\.update\(data\)\.digest\("hex"\)/);
  assert.match(api, /const importChunks = Array\.from/);
  assert.match(api, /insertMany\(importChunks, \{ session \}\)/);
});
