import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fixture } from "../helpers/fixture";
import { textPdf } from "../helpers/pdf";
import { matchesPdfTaxonomy, PDF_LIBRARY_UPLOAD_CHUNK_BYTES } from "../../src/lib/pdf-library";

test("teacher keeps a whole PDF, publishes it by topic, and independently sends a copy to exam review", async () => {
  const f = await fixture();
  try {
    const meta = {
      title: "نمونه‌سؤال فصل یک زیست",
      description: "آزمون معلم",
      taxonomy: {
        level: "متوسطه دوم", grade: "دوازدهم", book: "زیست",
        chapter: "فصل یک", topic: "گوارش",
      },
      visibility: "public",
    };
    const pdf = await f.post("/api/pdf-library", meta, f.teacher);
    assert.equal(pdf.state, "pending");
    assert.equal((await f.request("/api/pdf-library/public")).json().length, 0);
    const data = textPdf(["Exam questions"]);
    const url = `/api/pdf-library/${pdf._id}/file`;
    const upload = await f.app.inject({
      method: "POST", url,
      headers: {
        cookie: f.teacher,
        "content-type": "application/pdf",
        "x-file-name": encodeURIComponent("آزمون.pdf"),
      },
      payload: data,
    });
    assert.equal(upload.statusCode, 200, upload.body);
    assert.deepEqual((await f.request(url)).rawPayload, data);
    assert.equal((await f.request("/api/pdf-library/public")).json().length, 1);
    assert.equal(matchesPdfTaxonomy(
      { ...pdf, taxonomy: meta.taxonomy } as never,
      { chapter: "فصل دوم" },
    ), false);
    const before = await f.c("questionVersions").countDocuments();
    const handoff = await f.post(`/api/pdf-library/${pdf._id}/send-to-import`, {}, f.teacher);
    const detail = (await f.request(`/api/exam-imports/${handoff.examId}`, undefined, f.teacher)).json();
    assert.equal(detail.state, "collecting");
    assert.equal(detail.sourcePdfLibraryId, pdf._id);
    assert.deepEqual(
      (await f.request(`/api/exam-imports/${handoff.examId}/files/question`, undefined, f.teacher)).rawPayload,
      data,
    );
    assert.equal(await f.c("questionVersions").countDocuments(), before);
    assert.equal(
      (await f.app.inject({ method: "DELETE", url: `/api/pdf-library/${pdf._id}`, headers: { cookie: f.teacher } })).statusCode,
      200,
    );
    assert.equal((await f.request(url)).statusCode, 404);
    assert.deepEqual(
      (await f.request(`/api/exam-imports/${handoff.examId}/files/question`, undefined, f.teacher)).rawPayload,
      data,
    );
  } finally { await f.close(); }
});

test("private PDFs remain hidden from public, while super admin can inspect imports and copy sources without editing owners", async () => {
  const f = await fixture();
  try {
    const teacherPdf = await f.post("/api/pdf-library", {
      title: "فایل شخصی معلم",
      visibility: "private",
      taxonomy: { level: "", grade: "دهم", book: "ریاضی", chapter: "", topic: "" },
    }, f.teacher);
    const teacherExam = await f.post("/api/exam-imports", {
      title: "آزمون معلم",
      subject: "ریاضی",
      source: { family: "practice" },
    }, f.teacher);
    await f.post("/api/auth/register", {
      name: "Admin", email: "pdf-admin@test.dev", password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "pdf-admin@test.dev", password: "StrongPass123!",
    });
    const adminCookie = "session=" + login.cookies[0].value;
    await f.c("users").updateOne({ email: "pdf-admin@test.dev" }, { $set: { role: "super_admin" } });
    const own = await f.post("/api/exam-imports", {
      title: "آزمون مدیر", subject: "فیزیک", source: { family: "practice" },
    }, adminCookie);
    const listed = (await f.request("/api/exam-imports", undefined, adminCookie)).json();
    assert.equal(listed.length, 2);
    assert.ok(listed.find((x: { _id: string; ownerName: string }) => x._id === teacherExam._id && x.ownerName === "Teacher"));
    assert.equal((await f.request(`/api/exam-imports/${teacherExam._id}`, undefined, adminCookie)).statusCode, 200);
    assert.equal((await f.app.inject({
      method: "DELETE", url: `/api/exam-imports/${teacherExam._id}`,
      headers: { cookie: adminCookie },
    })).statusCode, 404);
    assert.equal((await f.request("/api/exam-imports", undefined, f.teacher)).json().length, 1);
    assert.equal((await f.request("/api/pdf-library/public")).json().length, 0);
    const source = textPdf(["Private teacher exam"]);
    const uploaded = await f.app.inject({ method: "POST", url: `/api/pdf-library/${teacherPdf._id}/file`,
      headers: { cookie: f.teacher, "content-type": "application/pdf", "x-file-name": "teacher.pdf" }, payload: source });
    assert.equal(uploaded.statusCode, 200, uploaded.body);
    assert.equal((await f.request(`/api/pdf-library/${teacherPdf._id}/file`)).statusCode, 401);
    assert.deepEqual((await f.request(`/api/pdf-library/${teacherPdf._id}/file`, undefined, adminCookie)).rawPayload, source);
    const adminLibrary = (await f.request("/api/pdf-library", undefined, adminCookie)).json();
    assert.ok(adminLibrary.find((x: { _id: string; ownerName: string }) => x._id === teacherPdf._id && x.ownerName === "Teacher"));
    const clone = await f.post(`/api/pdf-library/${teacherPdf._id}/send-to-import`, {}, adminCookie);
    const adminExam = (await f.request(`/api/exam-imports/${clone.examId}`, undefined, adminCookie)).json();
    assert.equal(adminExam.sourcePdfLibraryId, teacherPdf._id);
    assert.equal(adminExam.ownerId, own.ownerId);
    assert.equal((await f.request(`/api/exam-imports/${clone.examId}`, undefined, f.teacher)).statusCode, 404);
    assert.equal((await f.app.inject({ method: "DELETE", url: `/api/pdf-library/${teacherPdf._id}`, headers: { cookie: adminCookie } })).statusCode, 404);
    assert.ok(own._id);
  } finally { await f.close(); }
});

test("resumable PDF upload verifies every chunk before publishing and copies the complete file to exam import", async () => {
  const f = await fixture();
  try {
    const pdf = await f.post("/api/pdf-library", {
      title: "PDF چندبخشی",
      taxonomy: { level: "متوسطه دوم", grade: "دهم", book: "زیست", chapter: "اول", topic: "سلول" },
      visibility: "public",
    }, f.teacher);
    const prefix = textPdf(["Full source document"]);
    const data = Buffer.concat([
      prefix.subarray(0, prefix.length - 8),
      Buffer.alloc(PDF_LIBRARY_UPLOAD_CHUNK_BYTES + 173, 65),
      Buffer.from("\\n%%EOF\\n"),
    ]);
    const sha256 = createHash("sha256").update(data).digest("hex");
    const chunkCount = Math.ceil(data.length / PDF_LIBRARY_UPLOAD_CHUNK_BYTES);
    const start = await f.post(`/api/pdf-library/${pdf._id}/upload-session`, {
      name: "full-source.pdf", size: data.length, sha256, chunkCount,
    }, f.teacher);
    for (let position = 0; position < chunkCount; position++) {
      const offset = position * PDF_LIBRARY_UPLOAD_CHUNK_BYTES;
      const chunk = data.subarray(offset, Math.min(data.length, offset + PDF_LIBRARY_UPLOAD_CHUNK_BYTES));
      const response = await f.app.inject({
        method: "POST",
        url: `/api/pdf-library/${pdf._id}/chunks/${start.uploadId}/${position}`,
        headers: { cookie: f.teacher, "content-type": "application/octet-stream" },
        payload: chunk,
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().accepted, chunk.length);
    }
    const completed = await f.post(`/api/pdf-library/${pdf._id}/complete`, { uploadId: start.uploadId }, f.teacher);
    assert.equal(completed.state, "ready");
    assert.equal(completed.file.size, data.length);
    assert.equal(completed.file.sha256, sha256);
    assert.deepEqual((await f.request(`/api/pdf-library/${pdf._id}/file`)).rawPayload, data);

    const handoff = await f.post(`/api/pdf-library/${pdf._id}/send-to-import`, {}, f.teacher);
    const copied = await f.request(`/api/exam-imports/${handoff.examId}/files/question`, undefined, f.teacher);
    assert.equal(copied.statusCode, 200);
    assert.deepEqual(copied.rawPayload, data);
  } finally { await f.close(); }
});

test("resumable PDF upload refuses finalization when even one chunk is missing", async () => {
  const f = await fixture();
  try {
    const pdf = await f.post("/api/pdf-library", {
      title: "PDF ناقص",
      taxonomy: { level: "", grade: "یازدهم", book: "زیست", chapter: "", topic: "" },
    }, f.teacher);
    const data = Buffer.concat([textPdf(["Incomplete source"]), Buffer.alloc(PDF_LIBRARY_UPLOAD_CHUNK_BYTES, 66), Buffer.from("\\n%%EOF\\n")]);
    const sha256 = createHash("sha256").update(data).digest("hex");
    const chunkCount = Math.ceil(data.length / PDF_LIBRARY_UPLOAD_CHUNK_BYTES);
    const start = await f.post(`/api/pdf-library/${pdf._id}/upload-session`, {
      name: "incomplete.pdf", size: data.length, sha256, chunkCount,
    }, f.teacher);
    const first = data.subarray(0, PDF_LIBRARY_UPLOAD_CHUNK_BYTES);
    const upload = await f.app.inject({
      method: "POST",
      url: `/api/pdf-library/${pdf._id}/chunks/${start.uploadId}/0`,
      headers: { cookie: f.teacher, "content-type": "application/octet-stream" },
      payload: first,
    });
    assert.equal(upload.statusCode, 200, upload.body);
    const complete = await f.request(`/api/pdf-library/${pdf._id}/complete`, { uploadId: start.uploadId }, f.teacher);
    assert.equal(complete.statusCode, 409);
    assert.equal((await f.request("/api/pdf-library/public")).json().length, 0);
  } finally { await f.close(); }
});
