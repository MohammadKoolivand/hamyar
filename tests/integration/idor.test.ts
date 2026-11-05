import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fixture } from "../helpers/fixture";

const policy = { maxAttempts: 3, maxHints: 2, independent: false };

test("IDOR: URL, query and body identifiers stay isolated between two teachers and two students", async () => {
  const f = await fixture();
  try {
    await f.post("/api/auth/register", {
      name: "Teacher B",
      email: "teacher-b@idor.test",
      password: "StrongPass123!",
    });
    const teacherBLogin = await f.request("/api/auth/login", {
      email: "teacher-b@idor.test",
      password: "StrongPass123!",
    });
    assert.equal(teacherBLogin.statusCode, 200, teacherBLogin.body);
    const teacherB = `session=${teacherBLogin.cookies[0].value}`;
    const invitation = await f.post(
      "/api/invitations",
      { email: "student-b@idor.test" },
      teacherB,
    );
    await f.post("/api/invitations/accept", {
      name: "Student B",
      email: "student-b@idor.test",
      password: "StrongPass123!",
      token: invitation.token,
    });
    const studentBLogin = await f.request("/api/auth/login", {
      email: "student-b@idor.test",
      password: "StrongPass123!",
    });
    assert.equal(studentBLogin.statusCode, 200, studentBLogin.body);
    const studentB = `session=${studentBLogin.cookies[0].value}`;

    const teacherBRow = (await f.c("users").findOne({
      email: "teacher-b@idor.test",
    }))!;
    const studentBRow = (await f.c("users").findOne({
      email: "student-b@idor.test",
    }))!;
    const studentARow = (await f.c("users").findOne({
      email: "s@test.dev",
    }))!;

    const topicB = await f.post(
      "/api/curriculum",
      { title: "Private B topic", kind: "topic" },
      teacherB,
    );
    const questionB = await f.post(
      "/api/questions",
      {
        topicId: topicB._id,
        statement: "سؤال خصوصی معلم دوم",
        type: "numeric",
        reference: "7",
        hints: [],
      },
      teacherB,
    );
    const missionB = await f.post(
      "/api/missions",
      {
        title: "Mission B",
        studentId: studentBRow._id,
        questionVersionIds: [questionB._id],
        policy,
      },
      teacherB,
    );
    await f.post(`/api/missions/${missionB._id}/publish`, {}, teacherB);
    const assignmentB = (await f.c("assignments").findOne({
      missionId: missionB._id,
    }))!;

    const attemptB = await f.post(
      `/api/assignments/${assignmentB._id}/attempts`,
      { questionId: questionB._id, answer: "7" },
      studentB,
    );
    const examB = await f.post(
      "/api/exam-imports",
      {
        title: "Private exam B",
        subject: "ریاضی",
        source: { family: "practice" },
      },
      teacherB,
    );
    const courseB = await f.post(
      "/api/courses",
      { title: "Course B", subject: "ریاضی" },
      teacherB,
    );
    const assetB = randomUUID();
    await f.c("questionAssets").insertOne({
      _id: assetB,
      ownerId: teacherBRow._id,
      data: Buffer.from("private-image-b"),
    });
    const groupB = {
      _id: randomUUID(),
      teacherId: teacherBRow._id,
      courseId: courseB._id,
      title: "Class B",
      studentIds: [studentBRow._id],
      createdAt: new Date().toISOString(),
    };
    await f.c("classGroups").insertOne(groupB);

    // URL identifiers: neither teacher A nor student A can address B's data.
    for (const url of [
      `/api/questions/${questionB._id}`,
      `/api/exam-imports/${examB._id}`,
      `/api/exam-imports/${examB._id}/files/question`,
      `/api/question-assets/${assetB}`,
    ])
      assert.equal((await f.request(url, undefined, f.teacher)).statusCode, 404);
    for (const url of [
      `/api/assignments/${assignmentB._id}`,
      `/api/assignments/${assignmentB._id}/report`,
    ])
      assert.equal((await f.request(url, undefined, f.student)).statusCode, 404);
    assert.equal(
      (
        await f.request(
          `/api/missions/${missionB._id}/cancel`,
          {},
          f.teacher,
        )
      ).statusCode,
      404,
    );

    // Query identifiers are scoped too: B's course cannot be combined with A's student.
    assert.equal(
      (
        await f.request(
          `/api/students/${studentARow._id}/remediation-candidates?courseId=${courseB._id}`,
          undefined,
          f.teacher,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/api/class-groups/${groupB._id}/members`,
          { studentIds: [studentARow._id] },
          f.teacher,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/api/evaluations/${attemptB.evaluation._id}/review`,
          { result: "incorrect", note: "unauthorized review" },
          f.teacher,
        )
      ).statusCode,
      404,
    );

    // Body identifiers are checked against the authenticated owner/relation.
    assert.equal(
      (
        await f.request(
          "/api/missions",
          {
            title: "Cross student",
            studentId: studentBRow._id,
            questionVersionIds: [f.question._id],
            policy,
          },
          f.teacher,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          "/api/missions",
          {
            title: "Cross question",
            studentId: studentARow._id,
            questionVersionIds: [questionB._id],
            policy,
          },
          f.teacher,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          "/api/group-tasks",
          {
            groupId: groupB._id,
            title: "Cross class",
            questionVersionIds: [f.question._id],
            policy,
          },
          f.teacher,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/api/assignments/${assignmentB._id}/attempts`,
          { questionId: questionB._id, answer: "7" },
          f.student,
        )
      ).statusCode,
      404,
    );

    // Positive controls prove the resources exist and remain usable by owners.
    assert.equal(
      (await f.request(`/api/questions/${questionB._id}`, undefined, teacherB))
        .statusCode,
      200,
    );
    assert.equal(
      (
        await f.request(
          `/api/assignments/${assignmentB._id}`,
          undefined,
          studentB,
        )
      ).statusCode,
      200,
    );
  } finally {
    await f.close();
  }
});
