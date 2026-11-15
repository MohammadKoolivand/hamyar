import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

const original = {
  classification: "free",
  visibility: "public",
  statement: "پایتخت کشور ایران کدام شهر است؟",
  type: "choice",
  options: ["تهران", "تبریز", "اصفهان", "شیراز"],
  reference: "تهران",
};

test("the public bank suggests close text while preventing exact duplicates, including Persian/Latin numbers", async () => {
  const f = await fixture();
  try {
    const first = await f.post("/api/questions", original, f.teacher);
    const exact = await f.request("/api/questions/duplicates/check", {
      statement: original.statement, type: original.type, options: original.options,
    }, f.teacher);
    assert.equal(exact.statusCode, 200, exact.body);
    assert.ok(exact.json().matches.some((m: { kind: string; questionVersionId: string }) =>
      m.kind === "exact" && m.questionVersionId === first._id));
    assert.ok(!exact.body.includes('"reference"'));
    const repeat = await f.request("/api/questions", original, f.teacher);
    assert.equal(repeat.statusCode, 409, repeat.body);
    const close = await f.request("/api/questions/duplicates/check", {
      type: "choice", statement: "پایتخت ایران کدام شهر است؟",
      options: ["تهران", "تبریز", "اصفهان", "شیراز"],
    }, f.teacher);
    assert.equal(close.statusCode, 200, close.body);
    assert.ok(close.json().matches.some((m: { kind: string }) => m.kind === "similar"));

    // Private questions are excluded from shared suggestions and may coexist.
    const privateQuestion = await f.post("/api/questions", {
      ...original, visibility: "private", statement: "سؤال خصوصی برای تست محرمانگی",
    }, f.teacher);
    const checked = await f.request("/api/questions/duplicates/check", {
      statement: "سؤال خصوصی برای تست محرمانگی", type: "choice",
      options: original.options,
    }, f.teacher);
    assert.equal(checked.statusCode, 200);
    assert.ok(!checked.body.includes(privateQuestion._id));
    assert.ok(!checked.body.includes("سؤال خصوصی برای تست محرمانگی"));
    const student = await f.request("/api/questions/duplicates/check", {
      statement: original.statement, type: "choice", options: original.options,
    }, f.student);
    assert.equal(student.statusCode, 403);
  } finally {
    await f.close();
  }
});

test("two teachers cannot reserve duplicate public question fingerprints simultaneously", async () => {
  const f = await fixture();
  try {
    const password = "StrongPass123!";
    await f.post("/api/auth/register", {
      email: "second-bank-teacher@test.dev", password, name: "Second Teacher", role: "teacher",
    });
    const login = await f.request("/api/auth/login", {
      email: "second-bank-teacher@test.dev", password,
    });
    const teacher2 = "session=" + login.cookies[0].value;
    const body = {
      classification: "free", visibility: "public",
      statement: "چند تعداد سیاره در منظومه شمسی وجود دارد؟",
      type: "short", reference: "هشت",
    };
    const [one, two] = await Promise.all([
      f.request("/api/questions", body, f.teacher),
      f.request("/api/questions", body, teacher2),
    ]);
    assert.equal([one.statusCode, two.statusCode].filter((v) => v === 200).length, 1,
      `${one.statusCode}: ${one.body} / ${two.statusCode}: ${two.body}`);
    assert.ok([409, 500].includes([one, two].find((v) => v.statusCode !== 200)!.statusCode),
      "The losing write must be rejected, not inserted as another public question");
    assert.equal(await f.c("publicQuestionFingerprints").countDocuments(), 1);
  } finally {
    await f.close();
  }
});

test("version revision retains history; identical own question version is allowed", async () => {
  const f = await fixture();
  try {
    const q = await f.post("/api/questions", original, f.teacher);
    const revised = await f.request(`/api/questions/${q._id}/revise`, {
      ...original, statement: original.statement,
    }, f.teacher);
    assert.equal(revised.statusCode, 200, revised.body);
    assert.equal((await f.c("questionVersions").countDocuments({ questionId: q.questionId })), 2);
  } finally {
    await f.close();
  }
});

test("making a public question private releases its reserved fingerprint without deleting its history", async () => {
  const f = await fixture();
  try {
    const originalQuestion = await f.post("/api/questions", original, f.teacher);
    const reservedBefore = await f.c("publicQuestionFingerprints").countDocuments();
    assert.equal(reservedBefore, 1);
    const result = await f.request(`/api/questions/${originalQuestion._id}/revise`, {
      ...original, visibility: "private",
    }, f.teacher);
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(await f.c("publicQuestionFingerprints").countDocuments(), 0);
    const again = await f.request("/api/questions", original, f.teacher);
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(await f.c("publicQuestionFingerprints").countDocuments(), 1);
    assert.equal((await f.c("questionVersions").countDocuments({ questionId: originalQuestion.questionId })), 2);
  } finally {
    await f.close();
  }
});
