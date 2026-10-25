import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitExamText,
  examImportSchema,
  examDraftSchema,
} from "../../src/lib/exam-import";
import { extractPdfText } from "../../src/server/imports/pdf";
import { textPdf } from "../helpers/pdf";
test("PDF text is really extracted, numbered question candidates stay drafts and empty files have an honest fallback", async () => {
  const result = await extractPdfText(
    textPdf(["1. What is 1 + 1?", "2. What is 2 + 2?"]),
  );
  assert.ok(result.text.includes("1 + 1"), result.notice);
  assert.equal(splitExamText(result.text).length, 2);
  assert.equal(splitExamText("۱. سؤال اول\n۲) سؤال دوم").length, 2);
  assert.equal(splitExamText("\n ").length, 0);
  const broken = await extractPdfText(Buffer.from("%PDF-broken"));
  assert.equal(broken.text, "");
  assert.ok(broken.notice.includes("استخراج"));
  assert.ok(
    examImportSchema.safeParse({
      title: "آزمون تست",
      subject: "درس دلخواه",
      year: 1500,
      source: { family: "practice" },
    }).success,
  );
  assert.equal(
    examImportSchema.safeParse({
      title: "آزمون",
      subject: "درس",
      year: 1501,
      source: { family: "practice" },
    }).success,
    false,
  );
  assert.ok(
    examDraftSchema.safeParse({
      statement: "پیش‌نویس بی‌پاسخ",
      reference: "",
      type: "numeric",
    }).success,
  );
});
