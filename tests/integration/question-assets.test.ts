import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Binary } from "mongodb";
import { fixture } from "../helpers/fixture";
test("original question images stay private, assigned students may see images but not answer documents", async () => {
  const f = await fixture();
  try {
    const assetId = randomUUID(),
      other = randomUUID(),
      png = Buffer.from("89504e470d0a1a0a", "hex");
    const teacher = (await f
      .c("questionVersions")
      .findOne({ _id: f.question._id }))!.ownerId;
    await f.c("questionAssets").insertOne({
      _id: assetId,
      ownerId: teacher,
      data: new Binary(png),
      mime: "image/png",
    });
    await f.c("questionAssets").insertOne({
      _id: other,
      ownerId: randomUUID(),
      data: new Binary(png),
      mime: "image/png",
    });
    const visual = {
      kind: "image",
      caption: "تصویر اصل سؤال آزمون",
      assetId,
      width: 1500,
      height: 500,
    };
    assert.equal(
      (await f.request(`/api/question-assets/${assetId}`, undefined, f.student))
        .statusCode,
      404,
    );
    assert.equal(
      (await f.request(`/api/question-assets/${assetId}`)).statusCode,
      401,
    );
    assert.deepEqual(
      (await f.request(`/api/question-assets/${assetId}`, undefined, f.teacher))
        .rawPayload,
      png,
    );
    assert.equal(
      (
        await f.request(
          "/api/questions",
          {
            classification: "free",
            statement: "سؤال تصویری خصوصی",
            type: "choice",
            options: ["گزینه ۱", "گزینه ۲"],
            reference: "گزینه ۲",
            visuals: [{ ...visual, assetId: other }],
          },
          f.teacher,
        )
      ).statusCode,
      404,
    );
    const q = await f.post(
      "/api/questions",
      {
        classification: "free",
        statement: "سؤال تصویری خصوصی",
        type: "choice",
        options: ["گزینه ۱", "گزینه ۲"],
        reference: "گزینه ۲",
        visuals: [visual],
      },
      f.teacher,
    );
    const students = (
      await f.request("/api/students", undefined, f.teacher)
    ).json();
    const m = await f.post(
      "/api/missions",
      {
        title: "تمرین تصویر آزمون",
        studentId: students[0]._id,
        questionVersionIds: [q._id, f.question._id],
        policy: { maxHints: 0, maxAttempts: 2, independent: true },
      },
      f.teacher,
    );
    await f.post(`/api/missions/${m._id}/publish`, {}, f.teacher);
    const assignments = (
      await f.request("/api/missions", undefined, f.student)
    ).json();
    const a = assignments.find(
      (row: { missionId: string }) => row.missionId === m._id,
    );
    const detail = (
      await f.request(`/api/assignments/${a._id}`, undefined, f.student)
    ).json();
    assert.deepEqual(
      detail.questions.map((row: { _id: string }) => row._id),
      [q._id, f.question._id],
    );
    const allowed = await f.request(
      `/api/question-assets/${assetId}`,
      undefined,
      f.student,
    );
    assert.equal(allowed.statusCode, 200);
    assert.deepEqual(allowed.rawPayload, png);
    assert.match(String(allowed.headers["cache-control"]), /no-store/);
    const invite = await f.post(
      "/api/invitations",
      { phone: "09120000090", role: "parent", studentId: a.studentId },
      f.teacher,
    );
    await f.post("/api/invitations/accept", {
      phone: "09120000090",
      name: "ولی آزمایشی",
      password: "StrongPass123!",
      token: invite.token,
    });
    const login = await f.request("/api/auth/login", {
      email: "09120000090",
      password: "StrongPass123!",
    });
    const parentCookie = "session=" + login.cookies[0].value;
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${assetId}`,
          undefined,
          parentCookie,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${other}`,
          undefined,
          parentCookie,
        )
      ).statusCode,
      404,
    );
    const parent = login.json();
    await f.post(
      `/api/students/${a.studentId}/parents/${parent._id}/revoke`,
      {},
      f.teacher,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${assetId}`,
          undefined,
          parentCookie,
        )
      ).statusCode,
      404,
    );
    await f.post(`/api/missions/${m._id}/cancel`, {}, f.teacher);
    assert.equal(
      (await f.request(`/api/question-assets/${assetId}`, undefined, f.student))
        .statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
