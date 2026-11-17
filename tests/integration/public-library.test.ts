import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "../helpers/fixture";
import sharp from "sharp";

test("guests and every role can browse public questions without keys or private questions", async () => {
  const f = await fixture();
  try {
    const q = await f.post(
      "/api/questions",
      {
        classification: "free",
        visibility: "public",
        statement: "سؤال عمومی مشترک",
        type: "short",
        reference: "PRIVATE_KEY_42",
      },
      f.teacher,
    );
    const guest = await f.request("/api/questions/public");
    assert.equal(guest.statusCode, 200);
    assert.deepEqual(
      guest.json().map((row: { _id: string }) => row._id),
      [q._id],
    );
    assert.equal(guest.body.includes("PRIVATE_KEY_42"), false);
    for (const role of [
      "student",
      "teacher",
      "parent",
      "secretary",
      "super_admin",
    ]) {
      await f.c("users").updateOne({ email: "s@test.dev" }, { $set: { role } });
      const response = await f.request(
        "/api/questions/public",
        undefined,
        f.student,
      );
      assert.equal(response.statusCode, 200, `${role}: ${response.body}`);
      assert.deepEqual(
        response.json().map((row: { _id: string }) => row._id),
        [q._id],
      );
      assert.equal(response.body.includes("PRIVATE_KEY_42"), false);
      assert.equal(response.body.includes('"reference"'), false);
    }
    await f.post(
      `/api/questions/${q._id}/revise`,
      {
        classification: "free",
        visibility: "private",
        statement: "سؤال عمومی مشترک",
        type: "short",
        reference: "PRIVATE_KEY_42",
      },
      f.teacher,
    );
    const revised = (await f.request("/api/questions/public", undefined, f.student)).json();
    assert.equal(revised.length, 1);
    assert.notEqual(revised[0]._id, q._id);
    assert.equal(revised[0].statement, "سؤال عمومی مشترک");
    assert.equal(revised[0].reference, undefined);
  } finally {
    await f.close();
  }
});

test("public library remains public after question revision without exposing keys", async () => {
  const f = await fixture();
  try {
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const upload = await f.app.inject({
      method: "POST",
      url: "/api/question-assets",
      headers: { cookie: f.teacher, "content-type": "image/png" },
      payload: image,
    });
    assert.equal(upload.statusCode, 200, upload.body);
    const visual = upload.json();
    const body = {
      topicId: f.question.topicId,
      statement: "سؤال عمومی آزمایشی",
      type: "choice",
      options: ["الف", "ب"],
      reference: "الف",
      visibility: "public",
      visuals: [visual],
    };
    const q = await f.post("/api/questions", body, f.teacher);
    assert.equal(
      (await f.request(`/api/question-assets/${visual.assetId}`)).statusCode,
      200,
    );
    const catalog = await f.request(
      "/api/student/library",
      undefined,
      f.student,
    );
    assert.equal(catalog.statusCode, 200);
    assert.ok(
      catalog
        .json()
        .items.some((i: { questionId: string }) => i.questionId === q._id),
    );
    assert.equal(catalog.body.includes('"reference"'), false);
    const started = await f.post(
      `/api/student/library/${q._id}/start`,
      { courseId: q._id },
      f.student,
    );
    const practice = await f.request(
      `/api/assignments/${started.assignmentId}`,
      undefined,
      f.student,
    );
    assert.equal(practice.statusCode, 200, practice.body);
    assert.equal(practice.body.includes('"reference"'), false);
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${visual.assetId}`,
          undefined,
          f.student,
        )
      ).statusCode,
      200,
    );
    await f.post(
      `/api/questions/${q._id}/revise`,
      { ...body, visibility: "private" },
      f.teacher,
    );
    assert.equal(
      (await f.request(`/api/question-assets/${visual.assetId}`)).statusCode,
      200,
    );
    const currentQuestion = await f.c("questions").findOne({ _id: q.questionId });
    assert.ok(currentQuestion?.currentVersionId);
    const revisedPractice = await f.post(
      `/api/student/library/${currentQuestion!.currentVersionId}/start`,
      { courseId: currentQuestion!.currentVersionId },
      f.student,
    );
    assert.equal((await f.request(`/api/assignments/${revisedPractice.assignmentId}`, undefined, f.student)).statusCode, 200);
    assert.equal(
      (
        await f.request(
          `/api/assignments/${started.assignmentId}`,
          undefined,
          f.student,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${visual.assetId}`,
          undefined,
          f.student,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await f.request(
          `/api/student/library/${f.question._id}/start`,
          { courseId: f.question._id },
          f.student,
        )
      ).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});

for (const role of ["super_admin", "secretary"]) {
  test(`${role} can author own questions; students cannot; secretary cannot manage users`, async () => {
    const f = await fixture();
    try {
      await f.c("users").updateOne({ email: "t@test.dev" }, { $set: { role } });
      const q = await f.post(
        "/api/questions",
        {
          classification: "free",
          statement: "سؤال نقش آزمایشی",
          type: "numeric",
          reference: "2",
        },
        f.teacher,
      );
      assert.equal(q.visibility, "public");
      assert.equal(
        (
          await f.request(
            "/api/questions",
            {
              classification: "free",
              statement: "سؤال غیرمجاز",
              type: "numeric",
              reference: "2",
            },
            f.student,
          )
        ).statusCode,
        403,
      );
      if (role === "secretary")
        assert.equal(
          (await f.request("/api/admin/users", undefined, f.teacher))
            .statusCode,
          403,
        );
    } finally {
      await f.close();
    }
  });
}


test("public independent practice is private to the student, not the question author", async () => {
  const f = await fixture();
  try {
    const q = await f.post("/api/questions", {
      classification: "free",
      visibility: "public",
      statement: "تمرین آزاد دانش‌آموز",
      type: "numeric",
      reference: "3",
    }, f.teacher);
    const started = await f.post(
      `/api/student/library/${q._id}/start`,
      { courseId: q._id },
      f.student,
    );
    const assignment = await f.c("assignments").findOne({ _id: started.assignmentId });
    assert.equal(assignment?.practiceMode, "self");
    assert.equal((await f.request(`/api/assignments/${started.assignmentId}`, undefined, f.student)).statusCode, 200);

    const ownListing = await f.request("/api/assignments", undefined, f.student);
    assert.ok(ownListing.json().some((a: { _id: string }) => a._id === started.assignmentId));

    const teacherListing = await f.request("/api/assignments", undefined, f.teacher);
    assert.ok(!teacherListing.json().some((a: { _id: string }) => a._id === started.assignmentId));
    assert.equal(
      (await f.request(`/api/assignments/${started.assignmentId}`, undefined, f.teacher)).statusCode,
      404,
    );
    assert.equal(
      (await f.request(`/api/assignments/${started.assignmentId}/report`, undefined, f.teacher)).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});

test("public question recommendations count unique signed-in users without leaking answers", async () => {
  const f = await fixture();
  try {
    const url = "/api/questions/" + f.question._id + "/recommend";
    const denied = await f.request(url, {});
    assert.equal(denied.statusCode, 401);
    const first = await f.post(url, {}, f.student);
    const repeat = await f.post(url, {}, f.student);
    assert.equal(first.recommendationCount, 1);
    assert.equal(repeat.recommendationCount, 1);
    const teacherVote = await f.post(url, {}, f.teacher);
    assert.equal(teacherVote.recommendationCount, 2);
    const catalog = (await f.request("/api/questions/public")).json();
    const question = catalog.find((row: { _id: string }) => row._id === f.question._id);
    assert.equal(question.recommendationCount, 2);
    assert.equal(question.reference, undefined);
    assert.equal(question.userId, undefined);
    assert.ok(question.publishedAt);
    assert.equal((await f.c("questionRecommendations").countDocuments()), 2);
  } finally { await f.close(); }
});
