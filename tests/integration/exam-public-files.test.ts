import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { textPdf } from "../helpers/pdf";

test("super admin can publish durable exam booklet and answer key beside the public catalog row", async () => {
  const f = await fixture();
  try {
    const exam = await f.post("/api/exam-imports", {
      title: "آزمون نمونه برای انتشار فایل",
      subject: "ریاضی",
      year: 1405,
      categoryIds: ["konkur-1405-mathematics-general"],
      source: { family: "practice" },
    }, f.teacher);
    const root = `/api/exam-imports/${exam._id}`;
    const booklet = textPdf(["1. What is 1 + 1?"]);
    const answerKey = textPdf(["1 2"]);
    for (const [kind, data, name] of [
      ["question", booklet, "booklet.pdf"],
      ["answer", answerKey, "answer-key.pdf"],
    ] as const) {
      const uploaded = await f.app.inject({
        method: "POST",
        url: `${root}/files/${kind}`,
        headers: {
          cookie: f.teacher,
          "content-type": "application/pdf",
          "x-file-name": encodeURIComponent(name),
          "idempotency-key": `publish-file-${kind}`,
        },
        payload: data,
      });
      assert.equal(uploaded.statusCode, 200, uploaded.body);
    }
    // This integration test isolates the publication workflow; the import
    // review pipeline has its own PDF/OCR integration coverage.
    await f.c("examImports").updateOne(
      { _id: exam._id }, { $set: { state: "review" } },
    );
    assert.equal((await f.request(root, undefined, f.teacher)).json().state, "review");

    await f.post("/api/auth/register", {
      name: "Exam Admin", email: "exam-public-admin@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "exam-public-admin@test.dev", password: "StrongPass123!",
    });
    const admin = "session=" + login.cookies[0].value;
    await f.c("users").updateOne(
      { email: "exam-public-admin@test.dev" },
      { $set: { role: "super_admin" } },
    );

    const publishPath = `/api/admin/exam-imports/${exam._id}/public-files`;
    assert.equal((await f.request(publishPath, { published: true }, f.teacher)).statusCode, 403);
    assert.deepEqual((await f.request("/api/exam-catalog/public-progress")).json(), []);

    const result = await f.post(publishPath, { published: true }, admin);
    assert.equal(result.published, true);
    assert.ok(result.files.question.id);
    assert.ok(result.files.answer.id);

    const detail = (await f.request(root, undefined, admin)).json();
    assert.equal(detail.publicFiles.question.id, result.files.question.id);
    assert.equal(detail.publicFiles.answer.id, result.files.answer.id);
    const adminImports = (await f.request("/api/admin/exam-catalog/imports", undefined, admin)).json();
    const adminEntry = adminImports.find((row: { _id: string }) => row._id === exam._id);
    assert.equal(adminEntry.hasQuestionFile, true);
    assert.equal(adminEntry.hasAnswerFile, true);
    assert.deepEqual(adminEntry.publicFiles, result.files);

    const catalog = (await f.request("/api/exam-catalog/public-progress")).json();
    const entry = catalog.find((row: { title: string }) => row.title === exam.title);
    assert.ok(entry, JSON.stringify(catalog));
    assert.equal(entry.hasPublicQuestions, false);
    assert.deepEqual(entry.files, result.files);
    assert.ok(entry.categoryIds.includes("konkur-1405-mathematics-general"));

    assert.deepEqual(
      (await f.request(`/api/pdf-library/${result.files.question.id}/file`)).rawPayload,
      booklet,
    );
    assert.deepEqual(
      (await f.request(`/api/pdf-library/${result.files.answer.id}/file`)).rawPayload,
      answerKey,
    );
    assert.equal((await f.request("/api/pdf-library/public")).json().length, 0);
    assert.equal((await f.request(root + "/files/question")).statusCode, 401);

    await f.post(publishPath, { published: false }, admin);
    assert.deepEqual((await f.request("/api/exam-catalog/public-progress")).json(), []);
    assert.equal(
      (await f.request(`/api/pdf-library/${result.files.question.id}/file`)).statusCode,
      401,
    );

    const republished = await f.post(publishPath, { published: true }, admin);
    assert.deepEqual(republished.files, result.files);
    assert.ok((await f.request("/api/exam-catalog/public-progress")).json().length);
    await f.request(root, undefined, f.teacher);
    const archived = await f.app.inject({
      method: "DELETE", url: root, headers: { cookie: f.teacher },
    });
    assert.equal(archived.statusCode, 200, archived.body);
    assert.deepEqual((await f.request("/api/exam-catalog/public-progress")).json(), []);
    assert.equal(
      (await f.request(`/api/pdf-library/${result.files.question.id}/file`)).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
