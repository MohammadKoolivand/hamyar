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

test("damaged option numbering cannot promote an orphan option into a question anchor", () => {
  for (const orphan of ["۴) هفت", "4. seven", "٣: six", "۲- five"]) {
    const parsed = parseQuestions(
      lines([
        "سؤال ۱۲. حاصل جمع چند است؟",
        "۱) چهار",
        "؟) گزینه با شماره خراب",
        orphan,
        "سؤال ۱۹. سؤال بعدی",
        "1) one 2) two 3) three 4) four",
      ]),
      sizes,
    );
    assert.deepEqual(
      parsed.map((q) => q.number),
      [12, 19],
    );
    assert.ok(parsed[0].warnings.some((w) => w.includes("شماره‌گذاری")));
    assert.ok(parsed[0].options.length < 4);
  }
  // Low-number questions remain valid after a complete option block or an explicit label.
  const actual = parseQuestions(
    lines([
      "3. Question three",
      "1) a 2) b 3) c 4) d",
      "4. Question four",
      "1) a 2) b 3) c 4) d",
      "سؤال ۲. Explicit restart",
    ]),
    sizes,
  );
  assert.deepEqual(
    actual.map((q) => q.number),
    [3, 4, 2],
  );
});

test("two-column RTL layout, continuation pages and low OCR confidence remain reviewable", () => {
  const right = lines([
    "سؤال ۱۲. پرسش راست",
    "1) a 2) b 3) c 4) d",
    "سؤال ۱۹. پرسش دوم راست",
    "1) a 2) b 3) c 4) d",
  ]).map((l) => ({ ...l, x: 335, width: 220 }));
  const left = lines([
    "سؤال ۲۰. پرسش چپ",
    "1) a 2) b 3) c 4) d",
    "سؤال ۳۱. پرسش دوم چپ",
    "1) a 2) b 3) c 4) d",
  ]).map((l) => ({
    ...l,
    x: 25,
    width: 220,
    method: "ocr" as const,
    confidence: 45,
  }));
  const parsed = parseQuestions([...right, ...left], sizes);
  assert.deepEqual(
    parsed.map((q) => q.number),
    [12, 19, 20, 31],
  );
  assert.ok(parsed.every((q) => q.options.length === 4));
  assert.ok(parsed[2].warnings.some((w) => w.includes("۸۰")));
  const continued = parseQuestions(
    [
      ...lines(["سؤال ۷. آغاز پرسش"]),
      ...lines(["ادامه در صفحه دیگر", "1) a 2) b 3) c 4) d"]).map((l) => ({
        ...l,
        page: 2,
      })),
    ],
    { ...sizes, 2: sizes[1] },
  );
  assert.equal(continued[0].regions.length, 2);
  assert.ok(continued[0].warnings.some((w) => w.includes("چندصفحه")));
});

test("aligned sequential text headings remain separate after incomplete options; option-like dash lines stay conservative", () => {
  const row = (text: string, y: number, x = 150, width = 800): TextLine => ({
    text,
    page: 1,
    x,
    y,
    width,
    height: 16,
    method: "text",
    confidence: null,
  });
  const source = [
    row("۲- متن پرسش دوم", 20),
    row("1) گزینه نخست", 50, 400, 500),
    row("۳- متن پرسش بعدی", 100, 200, 750),
    row("1) گزینه نخست", 130, 400, 500),
    row("۴- متن پرسش پایانی", 180),
    row("1) گزینه نخست", 210, 400, 500),
  ];
  assert.deepEqual(
    parseQuestions(source, { 1: { width: 1000, height: 1400 } }).map(
      (q) => q.number,
    ),
    [2, 3, 4],
  );
  const ambiguous = [
    row("۲- متن پرسش دوم", 20),
    row("1) گزینه نخست", 50, 400, 500),
    row("3- ادامه مبهم گزینه", 90, 400, 500),
    row("Question 9. Next genuine question", 140),
  ];
  assert.deepEqual(
    parseQuestions(ambiguous, { 1: { width: 1000, height: 1400 } }).map(
      (q) => q.number,
    ),
    [2, 9],
  );
});
