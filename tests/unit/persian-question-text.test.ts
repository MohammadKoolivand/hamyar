import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePersianQuestionText,
  normalizeQuestionTextFields,
} from "../../src/lib/persian-question-text";
import { questionSchema } from "../../src/server/domain";
import { examDraftSchema } from "../../src/lib/exam-import";

test("Persian yeh and final heh normalize while valid ezafe, mathematics and URLs remain unchanged", () => {
  const input =
    "اين جملة و جملۀ بعد و جملهٔ سوم $\\text{ي}+x^۲$ https://example.com/ي";
  assert.equal(
    normalizePersianQuestionText(input),
    "این جمله و جملهٔ بعد و جملهٔ سوم $\\text{ي}+x^۲$ https://example.com/ي",
  );
  assert.equal(
    normalizePersianQuestionText(normalizePersianQuestionText(input)),
    normalizePersianQuestionText(input),
  );
  assert.equal(
    normalizePersianQuestionText("<u>كدام جملة صحيح است</u>"),
    "<u>كدام جمله صحیح است</u>",
  );
});

test("bank and review persistence normalize matching options and answer together without mutating source", () => {
  const input = {
    classification: "free" as const,
    statement: "كدام جملة صحيح است؟",
    type: "choice" as const,
    options: ["اولي", "دومي"],
    reference: "دومي",
    hints: [],
  };
  for (const result of [
    questionSchema.parse(input),
    examDraftSchema.parse(input),
    normalizeQuestionTextFields(input),
  ]) {
    assert.equal(result.statement, "كدام جمله صحیح است؟");
    assert.deepEqual(result.options, ["اولی", "دومی"]);
    assert.equal(result.reference, "دومی");
  }
  assert.equal(input.reference, "دومي");
  assert.equal(input.statement, "كدام جملة صحيح است؟");
});

test("plural ها uses ZWNJ without splitting non-plural words or touching math", () => {
  const input =
    "سوالها و گزینه های درست و یاختههايي و سلولهایمان؛ تنها رها بها انتهای تنهایی بهایی اژدها اشتها گرانبها. آنها و اینها و دهها $xها$";
  const expected =
    "سوال‌ها و گزینه‌های درست و یاخته‌هایی و سلول‌هایمان؛ تنها رها بها انتهای تنهایی بهایی اژدها اشتها گرانبها. آن‌ها و این‌ها و ده‌ها $xها$";
  assert.equal(normalizePersianQuestionText(input), expected);
  assert.equal(normalizePersianQuestionText(expected), expected);
});
