import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { textPdf } from "../helpers/pdf";
import { createHash } from "node:crypto";
test("exam PDF upload/download/extraction/save/review is durable, private, atomic and idempotent", async () => {
  let failWrite = false;
  const f = await fixture({
    hooks: {
      boundary: async (n) => {
        if (failWrite && n === "after_question_version_insert")
          throw new Error("test interruption");
      },
    },
  });
  try {
    const metadata = {
      title: "آزمون ورود واقعی",
      subject: "ریاضی",
      year: 1405,
      source: { family: "school", administration: "final", session: "خرداد" },
    };
    const exam = await f.post(
      "/api/exam-imports",
      metadata,
      f.teacher,
      "create-exam-1",
    );
    const root = `/api/exam-imports/${exam._id}`;
    assert.equal(
      (await f.post("/api/exam-imports", metadata, f.teacher, "create-exam-1"))
        ._id,
      exam._id,
    );
    assert.equal((await f.request(root, undefined, f.student)).statusCode, 403);
    assert.equal((await f.request(root)).statusCode, 401);
    const pdf = textPdf(["1. What is 1 + 1?", "2. What is 2 + 2?"]);
    const upload = (bytes: Buffer, cookie = f.teacher, key = "pdf-intent-1") =>
      f.app.inject({
        method: "POST",
        url: root + "/files/question",
        headers: {
          cookie,
          "content-type": "application/pdf",
          "x-file-name": encodeURIComponent("آزمون.pdf"),
          "idempotency-key": key,
        },
        payload: bytes,
      });
    assert.equal((await upload(Buffer.from("bad"))).statusCode, 400);
    assert.equal((await upload(pdf, f.student)).statusCode, 403);
    assert.equal((await upload(pdf)).statusCode, 200);
    assert.equal((await upload(pdf)).statusCode, 200);
    assert.equal(
      await f.c("examImportChunks").countDocuments({ examId: exam._id }),
      1,
    );
    const download = await f.request(
      root + "/files/question",
      undefined,
      f.teacher,
    );
    assert.deepEqual(download.rawPayload, pdf);
    const detail = (await f.request(root, undefined, f.teacher)).json();
    assert.equal(
      detail.files.question.sha256,
      createHash("sha256").update(pdf).digest("hex"),
    );
    const before = await f.c("questionVersions").countDocuments();
    await f.post(root + "/extract", {}, f.teacher, "extract-intent-1");
    await f.post(root + "/extract", {}, f.teacher, "extract-intent-2");
    const extracted = (await f.request(root, undefined, f.teacher)).json();
    assert.equal(extracted.items.length, 2, JSON.stringify(extracted));
    assert.equal(await f.c("questionVersions").countDocuments(), before);
    assert.equal(
      (await upload(pdf, f.teacher, "replace-after-review")).statusCode,
      409,
    );
    const first = extracted.items[0],
      second = extracted.items[1];
    const review = root + `/items/${first._id}/review`;
    const q = {
      ...first.question,
      statement: "Edited text with no answer yet",
      type: "numeric",
    };
    await f.post(
      review,
      { action: "save", question: q },
      f.teacher,
      "save-question-1",
    );
    assert.equal(
      (await f.c("examImportItems").findOne({ _id: first._id }))!.question
        .reference,
      "",
    );
    assert.equal(
      (
        await f.request(
          review,
          { action: "approve", confirmed: true, question: q },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    const approve = {
      action: "approve",
      confirmed: true,
      originalNumber: 7,
      question: {
        ...q,
        reference: "2",
        year: 1400,
        source: { family: "practice" },
      },
    };
    failWrite = true;
    assert.equal(
      (await f.request(review, approve, f.teacher, "approve-rollback"))
        .statusCode,
      500,
    );
    assert.equal(await f.c("questionVersions").countDocuments(), before);
    assert.equal(
      (await f.c("examImportItems").findOne({ _id: first._id }))!.state,
      "pending",
    );
    failWrite = false;
    const approved = await f.post(review, approve, f.teacher, "approve-exam-1");
    const replay = await f.post(review, approve, f.teacher, "approve-exam-1");
    assert.equal(approved.questionVersionId, replay.questionVersionId);
    assert.equal(await f.c("questionVersions").countDocuments(), before + 1);
    const stored = (await f
      .c("questionVersions")
      .findOne({ _id: approved.questionVersionId }))!;
    assert.equal(stored.year, 1405);
    assert.deepEqual(stored.source, { ...metadata.source, questionNumber: 7 });
    assert.equal(stored.origin, "exam_import_reviewed");
    assert.equal(
      (await f.request(review, approve, f.teacher, "second-approve-key"))
        .statusCode,
      409,
    );
    await f.post(
      root + `/items/${second._id}/review`,
      { action: "reject", reason: "متن ناقص استخراج شده" },
      f.teacher,
    );
    const added = await f.post(
      root + "/items",
      { statement: "سؤال دستی مکمل" },
      f.teacher,
      "manual-exam-1",
    );
    assert.equal(added.state, "pending");
    await f.post("/api/auth/register", {
      name: "Other",
      email: "other-exam@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "other-exam@test.dev",
      password: "StrongPass123!",
    });
    const other = "session=" + login.cookies[0].value;
    for (const suffix of ["", "/files/question"])
      assert.equal(
        (await f.request(root + suffix, undefined, other)).statusCode,
        404,
      );
    assert.deepEqual(
      (await f.request("/api/exam-imports", undefined, other)).json(),
      [],
    );
  } finally {
    await f.close();
  }
});

test("textless PDF stays review-only, manual fallback works and ordinary JSON request limits stay unchanged", async () => {
  const f = await fixture();
  try {
    const e = await f.post(
      "/api/exam-imports",
      {
        title: "فایل بدون متن",
        subject: "آزمون آزاد",
        source: { family: "practice" },
      },
      f.teacher,
    );
    const root = `/api/exam-imports/${e._id}`;
    const upload = await f.app.inject({
      method: "POST",
      url: root + "/files/question",
      headers: { cookie: f.teacher, "content-type": "application/pdf" },
      payload: textPdf([]),
    });
    assert.equal(upload.statusCode, 200);
    await f.post(root + "/extract", {}, f.teacher);
    const detail = (await f.request(root, undefined, f.teacher)).json();
    assert.equal(detail.items.length, 0);
    assert.ok(detail.extractionNotice.includes("OCR"));
    const item = await f.post(
      root + "/items",
      { statement: "سؤال دستی از فایل اسکن" },
      f.teacher,
    );
    const question = { ...item.question, reference: "3", type: "numeric" };
    const request = { action: "approve", confirmed: true, question };
    const results = await Promise.all([
      f.request(
        root + `/items/${item._id}/review`,
        request,
        f.teacher,
        "concurrent-exam-1",
      ),
      f.request(
        root + `/items/${item._id}/review`,
        request,
        f.teacher,
        "concurrent-exam-2",
      ),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    assert.equal(
      await f
        .c("questionVersions")
        .countDocuments({ sourceExamItemId: item._id }),
      1,
    );
    const large = await f.request(
      "/api/questions",
      { statement: "a".repeat(70000) },
      f.teacher,
    );
    assert.equal(large.statusCode, 413);
  } finally {
    await f.close();
  }
});
