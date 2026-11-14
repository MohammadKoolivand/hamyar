import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/print-questions.ts", "utf8");

test("question PDF printing suppresses browser-generated header and footer", () => {
  assert.match(source, /@page\{size:A4;margin:0\}/);
  assert.match(source, /@top-left\{content:none\}/);
  assert.match(source, /@bottom-right\{content:none\}/);
  assert.match(source, /hodhod-print-content/);
});

test("question PDF repeats the real Hodhod logo as a subtle watermark", () => {
  assert.match(source, /className = "hodhod-watermark"/);
  assert.match(source, /new URL\("\/icon\.svg", document\.baseURI\)/);
  assert.match(source, /position:fixed/);
  assert.match(source, /opacity:0\.075/);
  assert.match(source, /await Promise\.all\(\s*\[\.\.\.doc\.images\]/);
});
