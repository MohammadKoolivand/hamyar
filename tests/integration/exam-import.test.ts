import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

test("extracted exam drafts remain teacher-only until individually approved", async () => {
  const f = await fixture();
  try {
    const input = {
      metadata: {
        title: "فیزیک دوازدهم خرداد", kind: "final", year: "1404",
        session: "خرداد", grade: "12", track: "experimental", subject: "فیزیک", sourceUrl: "",
      },
      questions: [{ number: 1, page: 1, statement: "سرعت متوسط چقدر است؟", confidence: "medium" }],
      questionHash: "a".repeat(64), questionFile: "exam.pdf", questionPages: 1,
    };
    assert.equal((await f.request("/api/exams/import", input, f.student)).statusCode, 403);
    const uploaded = await f.post("/api/exams/import", input, f.teacher, "exam-import-fixture");
    assert.equal(uploaded.count, 1);
    const detail = await f.request("/api/exams/" + uploaded.examId, undefined, f.teacher);
    assert.equal(detail.statusCode, 200);
    assert.equal((await f.request("/api/exams/" + uploaded.examId, undefined, f.student)).statusCode, 403);
    const draft = detail.json().questions[0];
    assert.equal(draft.state, "pending_review");
    const privateBefore = (await f.request("/api/questions", undefined, f.teacher)).json();
    assert.equal(privateBefore.some((q: { statement: string }) => q.statement === draft.statement), false);
    const approved = await f.post("/api/exam-questions/" + draft._id + "/approve", {
      confirmed: true, question: {
        classification:"free", statement: draft.statement, type:"short",
        reference:"10", options:[], hints:[],
      },
    }, f.teacher, "exam-approve-fixture");
    assert.ok(approved.questionVersionId);
    assert.equal((await f.request("/api/exam-questions/" + draft._id + "/approve", {
      confirmed: true, question: {
        classification:"free", statement: draft.statement, type:"short",
        reference:"10", options:[], hints:[],
      },
    }, f.teacher, "new-review")).statusCode, 409);
    const privateAfter = (await f.request("/api/questions", undefined, f.teacher)).json();
    assert.ok(privateAfter.some((q: { _id: string }) => q._id === approved.questionVersionId));
  } finally { await f.close(); }
});
