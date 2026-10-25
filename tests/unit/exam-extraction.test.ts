import { test } from "node:test";
import assert from "node:assert/strict";
import { examMetadataSchema, splitExamPages } from "../../src/lib/exam-import";

test("recognizes Persian and English numbered questions without inventing answers", () => {
  const result = splitExamPages([
    "۱) سرعت متوسط یک جسم چند است؟\nاطلاعات مسئله را بنویسید\n۲- نیرو را محاسبه کنید.",
    "۳. کدام گزینه درست است؟\nالف) ۱\nب) ۲",
  ]);
  assert.deepEqual(result.map((x) => x.number), [1, 2, 3]);
  assert.equal(result[0].page, 1);
  assert.match(result[0].statement, /اطلاعات/);
  assert.ok(!("reference" in result[0]));
});
test("does not claim scanned or unnumbered text has reliable question boundaries", () => {
  assert.deepEqual(splitExamPages(["", "   "]), []);
  const result = splitExamPages(["صورت یک مسئله بدون شماره‌گذاری"]);
  assert.equal(result[0].confidence, "low");
  assert.equal(result[0].number, null);
});
test("rejects malformed metadata", () => {
  assert.equal(examMetadataSchema.safeParse({title:"a"}).success,false);
  assert.equal(examMetadataSchema.safeParse({
    title: "فیزیک دوازدهم خرداد ۱۴۰۴", kind:"final", year:"1404",
    session:"خرداد", grade:"12", track:"experimental", subject:"فیزیک", sourceUrl:"",
  }).success,true);
});
