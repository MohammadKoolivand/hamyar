import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "../helpers/fixture";

const privateQuestion = {
  classification: "free", visibility: "private",
  statement: "مساحت مستطیل با ضلع های ۳ و ۴ چقدر است؟",
  type: "short", reference: "۱۲",
};
const proposal = (versionId: string) => ({
  versionId, licenseBasis: "original", sourceReference: "تألیف خود معلم",
  rightsNote: "صورت سؤال توسط مؤلف ثبت شده است",
  consentToShare: true,
});

async function adminCookie(f: Awaited<ReturnType<typeof fixture>>) {
  await f.post("/api/auth/register", {
    name: "Bank Admin", email: "bank-manager@test.dev", password: "StrongPass123!",
  });
  await f.c("users").updateOne({ email: "bank-manager@test.dev" }, { $set: { role: "super_admin" } });
  const login = await f.request("/api/auth/login", {
    email: "bank-manager@test.dev", password: "StrongPass123!",
  });
  assert.equal(login.statusCode, 200, login.body);
  return "session=" + login.cookies[0].value;
}

test("teacher submission remains private until a super-admin approves a NEW immutable version", async () => {
  const f = await fixture();
  try {
    const admin = await adminCookie(f);
    const q = await f.post("/api/questions", privateQuestion, f.teacher);
    assert.equal((await f.request("/api/questions/public")).json().length, 1,
      "The fixture already creates one unrelated public question");
    const denyStudent = await f.request(`/api/questions/${q._id}/propose-public`, proposal(q._id), f.student);
    assert.equal(denyStudent.statusCode, 403);
    await f.post(`/api/questions/${q._id}/propose-public`, proposal(q._id), f.teacher);
    const pending = (await f.request("/api/admin/public-question-submissions", undefined, admin)).json();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].question.statement, privateQuestion.statement);
    assert.equal(pending[0].question.reference, privateQuestion.reference, "Only the administrator review response can include the answer key");
    assert.equal((await f.request("/api/admin/public-question-submissions", undefined, f.teacher)).statusCode, 403);
    const rejectedRole = await f.request(
      `/api/admin/public-question-submissions/${q.questionId}/review`,
      { decision: "approve", reason: "سؤال از نظر علمی و مجوز بررسی شد" }, f.teacher);
    assert.equal(rejectedRole.statusCode, 403);

    const approved = await f.post(
      `/api/admin/public-question-submissions/${q.questionId}/review`,
      { decision: "approve", reason: "بررسی منبع و پاسخ انجام شد و مجوز معتبر است" },
      admin,
    );
    assert.equal(approved.status, "approved");
    const current = await f.c("questions").findOne({ _id: q.questionId });
    assert.equal(current?.currentVersionId, approved.publishedVersionId);
    const old = await f.c("questionVersions").findOne({ _id: q._id });
    const published = await f.c("questionVersions").findOne({ _id: approved.publishedVersionId });
    assert.equal(old?.visibility, "private");
    assert.equal(published?.visibility, "public");
    assert.equal(published?.ownerId, old?.ownerId);
    assert.equal(published?.verifiedBy, (await f.c("users").findOne({ email: "bank-manager@test.dev" }))?._id);
    assert.equal((await f.c("questionVersions").countDocuments({ questionId: q.questionId })), 2);
    assert.ok((await f.request("/api/questions/public")).json()
      .some((v: { _id: string }) => v._id === published?._id));
    const replay = await f.request(
      `/api/admin/public-question-submissions/${q.questionId}/review`,
      { decision: "approve", reason: "بررسی منبع و پاسخ انجام شد و مجوز معتبر است" },
      admin,
    );
    assert.equal(replay.statusCode, 409);
  } finally { await f.close(); }
});

test("exact public duplicate can be linked without exposing or replacing private contributor history", async () => {
  const f = await fixture();
  try {
    const admin = await adminCookie(f);
    const first = await f.post("/api/questions", privateQuestion, f.teacher);
    await f.post(`/api/questions/${first._id}/propose-public`, proposal(first._id), f.teacher);
    const firstApproved = await f.post(
      `/api/admin/public-question-submissions/${first.questionId}/review`,
      { decision: "approve", reason: "مالکیت منبع و کیفیت سؤال تأیید شد" }, admin);
    const secondTeacher = await f.post("/api/auth/register", {
      name: "Second Teacher", email: "bank-second@test.dev", password: "StrongPass123!",
    });
    assert.ok(secondTeacher);
    const login = await f.request("/api/auth/login", {
      email: "bank-second@test.dev", password: "StrongPass123!",
    });
    const teacher2 = "session=" + login.cookies[0].value;
    const second = await f.post("/api/questions", privateQuestion, teacher2);
    await f.post(`/api/questions/${second._id}/propose-public`, proposal(second._id), teacher2);
    const cannotApprove = await f.request(
      `/api/admin/public-question-submissions/${second.questionId}/review`,
      { decision: "approve", reason: "نیاز به بررسی دارد ولی سؤال تکراری است" }, admin);
    assert.equal(cannotApprove.statusCode, 409);
    const linked = await f.post(
      `/api/admin/public-question-submissions/${second.questionId}/review`,
      { decision: "use_existing", existingVersionId: firstApproved.publishedVersionId,
        reason: "صورت و گزینه ها دقیقاً یکسان هستند؛ از سؤال موجود استفاده می کنیم" }, admin);
    assert.equal(linked.status, "linked_existing");
    assert.equal((await f.c("questions").findOne({ _id: second.questionId }))?.currentVersionId, second._id);
    assert.equal((await f.c("questionVersions").findOne({ _id: second._id }))?.visibility, "private");
    assert.equal(await f.c("questionContributions").countDocuments({
      canonicalVersionId: firstApproved.publishedVersionId,
    }), 1);
  } finally { await f.close(); }
});

test("a stale public proposal cannot publish an older revised private version", async () => {
  const f = await fixture();
  try {
    const admin = await adminCookie(f);
    const q = await f.post("/api/questions", privateQuestion, f.teacher);
    await f.post(`/api/questions/${q._id}/propose-public`, proposal(q._id), f.teacher);
    await f.post(`/api/questions/${q._id}/revise`, {
      ...privateQuestion, statement: "مساحت مستطیل با ضلع های ۵ و ۴ چقدر است؟",
      reference: "۲۰",
    }, f.teacher);
    const denied = await f.request(
      `/api/admin/public-question-submissions/${q.questionId}/review`,
      { decision: "approve", reason: "بررسی کامل منبع انجام شد" }, admin);
    assert.equal(denied.statusCode, 409);
  } finally { await f.close(); }
});

test("users may report only current published questions; manager resolves without altering answers", async () => {
  const f = await fixture();
  try {
    const admin = await adminCookie(f);
    const q = await f.post("/api/questions", privateQuestion, f.teacher);
    const privateReport = await f.request(`/api/questions/${q._id}/report`, {
      category: "wrong_answer", description: "پاسخ این سؤال به بررسی نیاز دارد",
    }, f.student);
    assert.equal(privateReport.statusCode, 404);
    await f.post(`/api/questions/${q._id}/propose-public`, proposal(q._id), f.teacher);
    const approved = await f.post(
      `/api/admin/public-question-submissions/${q.questionId}/review`,
      { decision: "approve", reason: "صحت علمی و مجوز حق استفاده بررسی شد" }, admin);
    const report = await f.post(`/api/questions/${approved.publishedVersionId}/report`, {
      category: "wrong_answer", description: "لطفاً صحت جواب پیشنهادی را بررسی کنید",
    }, f.student);
    assert.equal(report.status, "pending");
    const listed = (await f.request("/api/admin/public-question-reports", undefined, admin)).json();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].reporterId, undefined);
    assert.equal((await f.request("/api/admin/public-question-reports", undefined, f.teacher)).statusCode, 403);
    assert.equal((await f.request(
      `/api/admin/public-question-reports/${report.reportId}/resolve`,
      { decision: "resolved", note: "محتوای سؤال با منبع علمی مقایسه شد" }, f.student,
    )).statusCode, 403);
    await f.post(`/api/admin/public-question-reports/${report.reportId}/resolve`, {
      decision: "resolved", note: "محتوای سؤال با منبع علمی مقایسه شد",
    }, admin);
    assert.equal((await f.c("publicQuestionReports").findOne({ _id: report.reportId }))?.status, "resolved");
    assert.equal((await f.c("questionVersions").findOne({ _id: approved.publishedVersionId }))?.visibility, "public");
  } finally { await f.close(); }
});
