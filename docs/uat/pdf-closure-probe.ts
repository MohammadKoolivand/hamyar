import { processDocument } from "../../src/server/imports/document-engine";
import { parseQuestions } from "../../src/server/imports/layout";
import { mkdir } from "node:fs/promises";
const root = "/private/tmp/hodhod-closure-pdf";
await mkdir(root + "/output", { recursive: true });
const pages = await processDocument(root + "/columns.pdf", root + "/output");
const sizes = Object.fromEntries(pages.map(p => [p.page, { width: p.width, height: p.height }]));
const parsed = parseQuestions(pages.flatMap(p => p.lines), sizes);
let encryptedRejected = false;
try { await processDocument(root + "/encrypted.pdf", root + "/output"); } catch { encryptedRejected = true; }
console.log(JSON.stringify({ expected: [12,19,24,31,42,49,54,61], detected: parsed.map(p => p.number), encryptedRejected, maxRss: process.resourceUsage().maxRSS, pages: pages.length }));
