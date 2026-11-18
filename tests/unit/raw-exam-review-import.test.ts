import { test } from "node:test";
import assert from "node:assert/strict";
import { rawReviewPayloadSchema } from "../../src/server/modules/raw-exam-review";

function subject(number: number) {
  return number <= 75 ? "فیزیک" : number <= 110 ? "شیمی" :
    number <= 140 ? "ریاضی" : number <= 155 ? "زمین‌شناسی" : "بهیاری";
}

function validPayload() {
  return {
    format: "hamyar-raw-review-v1",
    items: Array.from({length: 10}, (_, index) => {
      const number = index + 57;
      return {
        number, state: "pending", subject: subject(number),
        statement: `سؤال ${number}`, suggestedTopic: "مبحث پیشنهادی",
        correctOption: 1, imageBase64: "A".repeat(60),
        source: {
          sourcePage: 12, bookletNumber: number <= 110 ? 2 : number <= 155 ? 3 : 4,
          sourceFileSha256: "a".repeat(64),
        },
      };
    }),
  };
}

test("a 10-question raw review batch parses", () => {
  assert.equal(rawReviewPayloadSchema.safeParse(validPayload()).success, true);
});

test("the raw import schema rejects missing or invalid answer keys", () => {
  const payload = validPayload();
  payload.items[0].correctOption = 5;
  assert.equal(rawReviewPayloadSchema.safeParse(payload).success, false);
});

test("the raw import schema rejects batches larger than 10", () => {
  const payload = validPayload();
  payload.items.push({ ...payload.items[0], number: 67 });
  assert.equal(rawReviewPayloadSchema.safeParse(payload).success, false);
});

test("the raw import schema rejects an empty batch", () => {
  const payload = validPayload();
  payload.items = [];
  assert.equal(rawReviewPayloadSchema.safeParse(payload).success, false);
});
