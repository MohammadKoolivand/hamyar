import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("teacher exam import entrypoint is reachable from MVP home and is not redirected", () => {
  const section = readFileSync("src/app/[section]/page.tsx", "utf8");
  const home = readFileSync("src/features/content/simple-question-home.tsx", "utf8");
  assert.match(section, /educatorEntries = new Set\(\["exam-import", "login"\]\)/);
  assert.match(section, /if \(educatorEntries\.has\(section\)\) return <HamyarApp\s*\/>/);
  assert.match(home, /href="\/exam-import"/);
  assert.match(home, /ورود آزمون و OCR/);
});
