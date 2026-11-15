import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { textPdf } from "../helpers/pdf";

const taxonomy = {
  level: "متوسطه", grade: "دهم", book: "ریاضی", chapter: "اول", topic: "تمرین",
};

test("private PDF is sent to one enrolled learner without OCR; learner can download, mark done, and lose access after cancellation", async () => {
  const f = await fixture();
  try {
    const course = await f.post("/api/courses", { title: "ریاضی دهم", subject: "ریاضی" }, f.teacher);
    const invitation = await f.post("/api/invitations", {
      email: "s@test.dev", courseId: course._id,
    }, f.teacher);
    await f.post("/api/invitations/claim", { token: invitation.token }, f.student);

    const pdf = await f.post("/api/pdf-library", {
      title: "تمرین فصل اول", visibility: "private", taxonomy,
    }, f.teacher);
    const bytes = textPdf(["Private teacher homework"]);
    const upload = await f.app.inject({
      method: "POST", url: `/api/pdf-library/${pdf._id}/file`,
      headers: { cookie: f.teacher, "content-type": "application/pdf", "x-file-name": "homework.pdf" },
      payload: bytes,
    });
    assert.equal(upload.statusCode, 200, upload.body);
    assert.equal((await f.request("/api/pdf-library/public")).json().length, 0);
    assert.equal((await f.request(`/api/pdf-library/${pdf._id}/file`)).statusCode, 401);

    const input = {
      pdfId: pdf._id,
      courseId: course._id,
      studentIds: [f.assignment.studentId],
      title: "تمرین PDF ریاضی",
      description: "سؤال‌ها را در دفتر حل کنید",
      dueAt: "2027-02-01T10:00:00.000Z",
    };
    const firstSend = await f.request("/api/pdf-deliveries", input, f.teacher, "pdf-delivery-replay");
    const secondSend = await f.request("/api/pdf-deliveries", input, f.teacher, "pdf-delivery-replay");
    assert.equal(firstSend.statusCode, 200, firstSend.body);
    assert.equal(secondSend.statusCode, 200, secondSend.body);
    const assignment = firstSend.json();
    assert.equal(assignment.count, 1);
    assert.equal(secondSend.json().batchId, assignment.batchId);
    assert.equal(await f.c("questionVersions").countDocuments({ statement: "Private teacher homework" }), 0);

    const teacherRows = (await f.request("/api/pdf-deliveries", undefined, f.teacher)).json();
    const studentRows = (await f.request("/api/pdf-deliveries", undefined, f.student)).json();
    assert.equal(teacherRows.length, 1);
    assert.equal(studentRows.length, 1);
    assert.equal(studentRows[0].title, input.title);
    assert.equal(studentRows[0].dueAt, input.dueAt);
    const fileUrl = `/api/pdf-deliveries/${studentRows[0]._id}/file`;
    await f.post("/api/auth/register", {
      email: "pdf-outsider@test.dev", password: "StrongPass123!",
      name: "Other Student", role: "student",
    });
    const outsiderLogin = await f.request("/api/auth/login", {
      email: "pdf-outsider@test.dev", password: "StrongPass123!",
    });
    const outsiderCookie = "session=" + outsiderLogin.cookies[0].value;
    assert.equal((await f.request(fileUrl, undefined, outsiderCookie)).statusCode, 404);
    assert.equal((await f.request(fileUrl)).statusCode, 401);
    assert.equal((await f.request(fileUrl, undefined, f.teacher)).statusCode, 404);
    assert.deepEqual((await f.request(fileUrl, undefined, f.student)).rawPayload, bytes);
    assert.equal((await f.c("pdfDeliveries").findOne({ _id: studentRows[0]._id }))?.state, "assigned",
      "download must not be treated as completion");

    assert.equal((await f.request(`/api/pdf-deliveries/${studentRows[0]._id}/complete`, {}, f.teacher)).statusCode, 404);
    await f.post(`/api/pdf-deliveries/${studentRows[0]._id}/complete`, {}, f.student);
    await f.post(`/api/pdf-deliveries/${studentRows[0]._id}/complete`, {}, f.student);
    assert.equal((await f.c("pdfDeliveries").findOne({ _id: studentRows[0]._id }))?.state, "completed");

    const deleteAttempt = await f.app.inject({
      method: "DELETE", url: `/api/pdf-library/${pdf._id}`, headers: { cookie: f.teacher },
    });
    assert.equal(deleteAttempt.statusCode, 409);
    await f.post(`/api/pdf-deliveries/${assignment.batchId}/cancel`, {}, f.teacher);
    await f.post(`/api/pdf-deliveries/${assignment.batchId}/cancel`, {}, f.teacher);
    assert.equal((await f.request("/api/pdf-deliveries", undefined, f.student)).json().length, 0);
    assert.equal((await f.request(fileUrl, undefined, f.student)).statusCode, 404);
    assert.equal((await f.request(`/api/pdf-deliveries/${studentRows[0]._id}/complete`, {}, f.student)).statusCode, 404);
    assert.equal((await f.request("/api/pdf-deliveries", undefined, f.teacher)).json().length, 1);
  } finally {
    await f.close();
  }
});

test("PDF class delivery checks course membership and group snapshot; outsiders cannot retrieve file", async () => {
  const f = await fixture();
  try {
    const course = await f.post("/api/courses", { title: "درس گروهی", subject: "علوم" }, f.teacher);
    const invite = await f.post("/api/invitations", { email: "s@test.dev", courseId: course._id }, f.teacher);
    await f.post("/api/invitations/claim", { token: invite.token }, f.student);
    const group = await f.post("/api/class-groups", {
      courseId: course._id, title: "کلاس الف", studentIds: [f.assignment.studentId],
    }, f.teacher);
    const privatePdf = await f.post("/api/pdf-library", {
      title: "PDF خصوصی کلاس", taxonomy, visibility: "private",
    }, f.teacher);
    const publicPdf = await f.post("/api/pdf-library", {
      title: "PDF عمومی کلاس", taxonomy, visibility: "public",
    }, f.teacher);
    const bytes = textPdf(["Class homework"]);
    for (const pdf of [privatePdf, publicPdf]) {
      const response = await f.app.inject({
        method: "POST", url: `/api/pdf-library/${pdf._id}/file`,
        headers: { cookie: f.teacher, "content-type": "application/pdf", "x-file-name": "class.pdf" },
        payload: bytes,
      });
      assert.equal(response.statusCode, 200);
    }
    const input = {
      pdfId: privatePdf._id, courseId: course._id,
      groupId: group._id, studentIds: [f.assignment.studentId], title: "کاربرگ کلاسی",
    };
    assert.equal((await f.request("/api/pdf-deliveries", {
      ...input, studentIds: ["33333333-3333-4333-8333-333333333333"],
    }, f.teacher)).statusCode, 409);
    assert.equal((await f.request("/api/pdf-deliveries", {
      ...input, pdfId: publicPdf._id,
    }, f.teacher)).statusCode, 404, "public file must not masquerade as private delivery");

    const sent = await f.post("/api/pdf-deliveries", input, f.teacher);
    assert.equal(sent.count, 1);
    const item = (await f.request("/api/pdf-deliveries", undefined, f.student)).json()[0];
    assert.equal((await f.request(`/api/pdf-deliveries/${item._id}/file`, undefined, f.student)).statusCode, 200);
    const enrollment = await f.c("enrollments").findOne({
      studentId: f.assignment.studentId, courseId: course._id, status: "active",
    });
    await f.post(`/api/enrollments/${enrollment!._id}/leave`, {}, f.student);
    assert.equal((await f.request("/api/pdf-deliveries", undefined, f.student)).json().length, 0);
    assert.equal((await f.request(`/api/pdf-deliveries/${item._id}/file`, undefined, f.student)).statusCode, 404);
  } finally {
    await f.close();
  }
});
