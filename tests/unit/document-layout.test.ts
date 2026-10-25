import { test } from "node:test";
import assert from "node:assert/strict";
import {
  digits,
  normalized,
  parseQuestions,
  parseAnswerKey,
  matchKey,
  type TextLine,
} from "../../src/server/imports/layout";
const lines = (texts: string[]): TextLine[] =>
  texts.map((text, i) => ({
    text,
    page: 1,
    x: 30,
    y: 30 + i * 30,
    width: 500,
    height: 20,
    confidence: null,
    method: "text",
  }));
const sizes = { 1: { width: 600, height: 800 } };
test("Persian/Arabic normalization, questions, multiline and inline options keep actual numbers", () => {
  assert.equal(digits("۱۲٣٤"), "1234");
  assert.equal(normalized("علي كریم"), "علی کریم");
  const parsed = parseQuestions(
    lines([
      "سؤال ۱۲. سرعت جسم چند است؟",
      "۱) پنج",
      "ادامه گزینه اول",
      "۲) ده",
      "۳) پانزده",
      "۴) بیست",
      "13. Next question",
      "1) A  2) B  3) C  4) D",
    ]),
    sizes,
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].number, 12);
  assert.equal(parsed[0].options.length, 4);
  assert.ok(parsed[0].options[0].includes("ادامه"));
  assert.deepEqual(parsed[1].options, ["A", "B", "C", "D"]);
  assert.equal(parsed[0].confidence, null);
  assert.equal(parsed[0].regions[0].page, 1);
});
test("keys match numbers, reject duplicates, invalid and uncertain keys, and do not use array position", () => {
  const qs = parseQuestions(
    lines([
      "12. First question",
      "1) A",
      "2) B",
      "3) C",
      "4) D",
      "19. Second question",
      "1) A",
      "2) B",
      "3) C",
      "4) D",
    ]),
    sizes,
  );
  const key = parseAnswerKey(lines(["19: 2", "12: 3", "20: 9"]));
  assert.equal(key.entries.length, 2);
  assert.equal(key.warnings.length, 1);
  assert.equal(matchKey(qs[0], key.entries).option, 3);
  assert.equal(matchKey(qs[1], key.entries).option, 2);
  assert.equal(matchKey(qs[0], [...key.entries, key.entries[1]]).option, null);
  assert.equal(matchKey(qs[0], []).status, "needs_review");
  assert.equal(
    matchKey(qs[0], [{ ...key.entries[1], confidence: 50 }]).option,
    null,
  );
  assert.equal(
    parseAnswerKey(lines(["جدول تصویری علامت‌خورده"])).entries.length,
    0,
  );
});
test("duplicate numbers and unnumbered pages are explicit review cases", () => {
  const qs = parseQuestions(
    lines(["12. One question", "12. Duplicate question"]),
    sizes,
  );
  assert.ok(qs.every((q) => q.warnings.some((w) => w.includes("تکراری"))));
  const unnumbered = parseQuestions(lines(["متن بدون شماره و فرمول"]), sizes);
  assert.equal(unnumbered[0].number, null);
  assert.ok(unnumbered[0].warnings.length);
});
