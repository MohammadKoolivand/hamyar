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
    assert.deepEqual(
      (await f.request("/api/questions/public", undefined, f.student)).json(),
      [],
    );
  } finally {
    await f.close();
  }
});

test("public library allows unenrolled students without exposing keys and private revision revokes practice", async () => {
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
      401,
    );
    assert.equal(
      (
        await f.request(
          `/api/student/library/${q._id}/start`,
          { courseId: q._id },
          f.student,
        )
      ).statusCode,
      404,
    );
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
      404,
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
      assert.equal(q.visibility, "private");
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
