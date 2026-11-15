import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { textPdf } from "../helpers/pdf";
import { matchesPdfTaxonomy } from "../../src/lib/pdf-library";

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

test("private PDFs remain owner-only and super admin can view everyone’s exam imports without editing", async () => {
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
    assert.equal((await f.request(`/api/pdf-library/${teacherPdf._id}/file`, undefined, adminCookie)).statusCode, 404);
    assert.ok(own._id);
  } finally { await f.close(); }
});
