import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../src/server/app";
import { connect, collection } from "../../src/server/db";
Object.assign(process.env, { NODE_ENV: "test" });
test("real MongoDB: teacher → invitation → mission → practice → reports and isolation", async () => {
  const { client, db } = await connect(
    process.env.TEST_MONGO_URL ??
      "mongodb://127.0.0.1:27019/?replicaSet=hamyar-rs",
    "hamyar_test_" + randomUUID(),
  );
  const app = await buildApp(db);
  await app.ready();
  const request = async (
    method: "GET" | "POST",
    url: string,
    payload?: unknown,
    cookie = "",
  ) =>
    app.inject({
      method,
      url,
      headers: cookie ? { cookie } : {},
      ...(payload ? { payload: payload as object } : {}),
    });
  const post = async (url: string, payload: unknown, cookie = "") => {
    const r = await request("POST", url, payload, cookie);
    assert.ok(r.statusCode < 300, r.body);
    return r.json();
  };
  const login = async (email: string) => {
    const r = await request("POST", "/api/auth/login", {
      email,
      password: "StrongPass123!",
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.cookies[0].name + "=" + r.cookies[0].value;
  };
  try {
    await post("/api/auth/register", {
      name: "Teacher One",
      email: "teacher@test.dev",
      password: "StrongPass123!",
    });
    const tc = await login("teacher@test.dev");
    const invite = await post(
      "/api/invitations",
      { email: "student@test.dev" },
      tc,
    );
    await post("/api/invitations/accept", {
      name: "Student",
      email: "student@test.dev",
      password: "StrongPass123!",
      token: invite.token,
    });
    const sc = await login("student@test.dev");
    const students = (
      await request("GET", "/api/students", undefined, tc)
    ).json();
    assert.equal(students.length, 1);
    const subject = await post(
      "/api/curriculum",
      { title: "Custom subject", kind: "subject" },
      tc,
    );
    const topic = await post(
      "/api/curriculum",
      { title: "Custom topic", kind: "topic", parentId: subject._id },
      tc,
    );
    const q = await post(
      "/api/questions",
      {
        topicId: topic._id,
        statement: "یک به علاوه یک؟",
        type: "numeric",
        reference: "2",
        hints: ["از عدد یک، یک گام جلو برو."],
      },
      tc,
    );
    const essay = await post(
      "/api/questions",
      {
        topicId: topic._id,
        statement: "درباره موضوع توضیح بده",
        type: "essay",
        reference: "معیار بررسی انسانی",
      },
      tc,
    );
    const mission = await post(
      "/api/missions",
      {
        title: "تمرین اولیه",
        studentId: students[0]._id,
        questionVersionIds: [q._id, essay._id],
        policy: { maxHints: 1, maxAttempts: 2, independent: false },
      },
      tc,
    );
    await post("/api/missions/" + mission._id + "/publish", {}, tc);
    await post("/api/missions/" + mission._id + "/publish", {}, tc);
    let assignments = (
      await request("GET", "/api/assignments", undefined, sc)
    ).json();
    assert.equal(assignments.length, 1);
    const a = assignments[0],
      path = "/api/assignments/" + a._id;
    const detail = (await request("GET", path, undefined, sc)).json();
    assert.equal(detail.questions[0].reference, undefined);
    assert.equal(detail.questions[0].hints, undefined);
    await post(path + "/attempts", { questionId: q._id, answer: "1" }, sc);
    const concurrent = await Promise.all([
      request("POST", path + "/hints", { questionId: q._id }, sc),
      request("POST", path + "/hints", { questionId: q._id }, sc),
    ]);
    assert.equal(concurrent.filter((r) => r.statusCode === 200).length, 1);
    assert.equal(concurrent.filter((r) => r.statusCode === 409).length, 1);
    const correct = await post(
      path + "/attempts",
      { questionId: q._id, answer: "۲" },
      sc,
    );
    assert.equal(correct.evaluation.result, "correct");
    assert.equal(correct.attempt.hintsUsed, 1);
    assert.equal(
      (
        await request(
          "POST",
          path + "/attempts",
          { questionId: q._id, answer: "2" },
          sc,
        )
      ).statusCode,
      409,
    );
    const pending = await post(
      path + "/attempts",
      { questionId: essay._id, answer: "توضیح دانش‌آموز" },
      sc,
    );
    assert.equal(pending.evaluation.result, "pending_review");
    await post(path + "/complete", {}, sc);
    const report = (
      await request("GET", path + "/report", undefined, sc)
    ).json();
    assert.equal(report.assisted, 1);
    assert.equal(report.independent, 0);
    assert.equal(report.independentSuccessRate, 0);
    assert.equal(report.pending, 1);
    const tr = (await request("GET", path + "/report", undefined, tc)).json();
    assert.equal(tr.evidence.length, 3);
    await post(
      "/api/evaluations/" + pending.evaluation._id + "/review",
      { result: "correct", note: "پاسخ با معیار مرجع سازگار است" },
      tc,
    );
    const evaluation = await collection(db, "evaluations").findOne({
      _id: pending.evaluation._id,
    });
    assert.equal(evaluation!.reviews?.length, 1);
    assert.equal(evaluation!.reviews?.[0].previousResult, "pending_review");
    assert.equal(
      evaluation!.reviews?.[0].note,
      "پاسخ با معیار مرجع سازگار است",
    );
    assert.equal(
      (await collection(db, "assignments").findOne({ _id: a._id }))!.state,
      "completed",
    );
    await post("/api/auth/register", {
      name: "Other Teacher",
      email: "other@test.dev",
      password: "StrongPass123!",
    });
    const other = await login("other@test.dev");
    const sameStudentInvite = await post(
      "/api/invitations",
      { email: "student@test.dev" },
      other,
    );
    await post("/api/invitations/accept", {
      name: "Existing Student",
      email: "student@test.dev",
      password: "StrongPass123!",
      token: sameStudentInvite.token,
    });
    assert.equal(
      (await request("GET", "/api/students", undefined, other)).json().length,
      1,
    );
    const otherStudentInvite = await post(
      "/api/invitations",
      { email: "otherstudent@test.dev" },
      other,
    );
    await post("/api/invitations/accept", {
      name: "Other Student",
      email: "otherstudent@test.dev",
      password: "StrongPass123!",
      token: otherStudentInvite.token,
    });
    const otherStudent = await login("otherstudent@test.dev");
    assert.equal(
      (await request("GET", path, undefined, otherStudent)).statusCode,
      404,
    );
    assert.equal(
      (await request("GET", path + "/report", undefined, otherStudent))
        .statusCode,
      404,
    );
    const privateReport = (
      await request("GET", path + "/report", undefined, sc)
    ).json();
    assert.ok(
      privateReport.evidence.every(
        (e: { evaluation: { reviews?: unknown } }) =>
          e.evaluation.reviews === undefined,
      ),
    );
    const privateDetail = (await request("GET", path, undefined, sc)).json();
    assert.ok(
      privateDetail.evaluations.every(
        (e: { reviews?: unknown }) => e.reviews === undefined,
      ),
    );
    assert.equal(
      (
        await request(
          "POST",
          "/api/missions",
          {
            title: "Forbidden foreign question",
            studentId: students[0]._id,
            questionVersionIds: [q._id],
            policy: { maxHints: 1, maxAttempts: 1, independent: false },
          },
          other,
        )
      ).statusCode,
      404,
    );

    assert.equal(
      (await request("GET", path, undefined, other)).statusCode,
      404,
    );
    assert.equal(
      (await request("GET", path + "/report", undefined, other)).statusCode,
      404,
    );
    assert.equal(
      (await request("GET", "/api/questions", undefined, sc)).statusCode,
      403,
    );
    assert.equal(
      (await request("POST", path + "/hints", { questionId: q._id }, sc))
        .statusCode,
      409,
    );
    const m2 = await post(
      "/api/missions",
      {
        title: "سنجش مستقل",
        studentId: students[0]._id,
        questionVersionIds: [q._id],
        policy: { maxHints: 2, maxAttempts: 1, independent: true },
      },
      tc,
    );
    await post("/api/missions/" + m2._id + "/publish", {}, tc);
    assignments = (
      await request("GET", "/api/assignments", undefined, sc)
    ).json();
    const a2 = assignments.find(
      (v: { missionId: string }) => v.missionId === m2._id,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/api/assignments/" + a2._id + "/hints",
          { questionId: q._id },
          sc,
        )
      ).statusCode,
      409,
    );
    await post(
      "/api/assignments/" + a2._id + "/attempts",
      { questionId: q._id, answer: "2" },
      sc,
    );
    const independentReport = (
      await request(
        "GET",
        "/api/assignments/" + a2._id + "/report",
        undefined,
        sc,
      )
    ).json();
    assert.equal(independentReport.independentSuccessRate, 1);
    const failureApp = await buildApp(db, {
      name: "failing",
      async hint() {
        throw new Error("outage");
      },
    });
    await failureApp.ready();
    const m3 = await post(
      "/api/missions",
      {
        title: "بررسی قطعی سرویس",
        studentId: students[0]._id,
        questionVersionIds: [q._id],
        policy: { maxHints: 1, maxAttempts: 2, independent: false },
      },
      tc,
    );
    await post("/api/missions/" + m3._id + "/publish", {}, tc);
    const a3 = (await collection(db, "assignments").findOne({
      missionId: m3._id,
    }))!;
    await post(
      "/api/assignments/" + a3._id + "/attempts",
      { questionId: q._id, answer: "1" },
      sc,
    );
    const outage = await failureApp.inject({
      method: "POST",
      url: "/api/assignments/" + a3._id + "/hints",
      headers: { cookie: sc },
      payload: { questionId: q._id },
    });
    assert.equal(outage.statusCode, 503);
    assert.equal(
      await collection(db, "attempts").countDocuments({ assignmentId: a3._id }),
      1,
    );
    assert.equal(
      (await collection(db, "assignments").findOne({ _id: a3._id }))!.progress[
        q._id
      ].hints,
      0,
    );
    await failureApp.close();
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: {
            origin: "https://attacker.test",
            host: "localhost:80",
            cookie: sc,
          },
          payload: {},
        })
      ).statusCode,
      403,
    );
    await post("/api/auth/logout", {}, sc);
    assert.equal(
      (await request("GET", "/api/auth/me", undefined, sc)).statusCode,
      401,
    );
  } finally {
    await app.close();
    await db.dropDatabase();
    await client.close();
  }
});
