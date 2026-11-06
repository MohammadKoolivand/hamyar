import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "../helpers/fixture";

async function preparePublishedLibraryQuestion() {
  const f = await fixture();
  const course = await f.post(
    "/api/courses",
    { subject: "ریاضی", title: "ریاضی دهم" },
    f.teacher,
  );
  const invitation = await f.post(
    "/api/invitations",
    { email: "s@test.dev", courseId: course._id },
    f.teacher,
  );
  await f.post(
    "/api/invitations/claim",
    { token: invitation.token },
    f.student,
  );
  await f.post(
    `/api/questions/${f.question._id}/library`,
    { courseId: course._id, published: true },
    f.teacher,
  );
  return { f, course };
}

test("library exposes only actively published questions for an active course membership", async () => {
  const { f, course } = await preparePublishedLibraryQuestion();
  try {
    const library = await f.request(
      "/api/student/library",
      undefined,
      f.student,
    );
    assert.equal(library.statusCode, 200, library.body);
    const items = library.json().items as Array<{
      questionId: string;
      courseIds: string[];
    }>;
    assert.equal(items.length, 1);
    assert.equal(items[0].questionId, f.question._id);
    assert.deepEqual(items[0].courseIds, [course._id]);

    const startPath = `/api/student/library/${f.question._id}/start`;
    const startKey = "library-start-replay";
    const firstStart = await f.request(
      startPath,
      { courseId: course._id },
      f.student,
      startKey,
    );
    assert.equal(firstStart.statusCode, 200, firstStart.body);
    const started = firstStart.json();
    const assignment = await f.c("assignments").findOne({
      _id: started.assignmentId,
    });
    assert.equal(assignment?.studentId, f.assignment.studentId);
    assert.equal(assignment?.teacherId, f.assignment.teacherId);
    assert.equal(assignment?.courseId, course._id);
    assert.equal(assignment?.libraryQuestionId, f.question._id);
  } finally {
    await f.close();
  }
});

test("unpublishing immediately blocks library listing, restart, and existing practice access", async () => {
  const { f, course } = await preparePublishedLibraryQuestion();
  try {
    const startPath = `/api/student/library/${f.question._id}/start`;
    const startKey = "library-unpublish-replay";
    const startResponse = await f.request(
      startPath,
      { courseId: course._id },
      f.student,
      startKey,
    );
    assert.equal(startResponse.statusCode, 200, startResponse.body);
    const started = startResponse.json();
    const path = `/api/assignments/${started.assignmentId}`;
    assert.equal((await f.request(path, undefined, f.student)).statusCode, 200);

    await f.post(
      `/api/questions/${f.question._id}/library`,
      { courseId: course._id, published: false },
      f.teacher,
    );

    const library = await f.request(
      "/api/student/library",
      undefined,
      f.student,
    );
    assert.deepEqual(library.json().items, []);
    assert.equal(
      (await f.request(startPath, { courseId: course._id }, f.student))
        .statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          startPath,
          { courseId: course._id },
          f.student,
          startKey,
        )
      ).statusCode,
      404,
      "an idempotent replay must not bypass a later unpublish",
    );
    assert.equal((await f.request(path, undefined, f.student)).statusCode, 404);
    assert.equal(
      (
        await f.request(
          path + "/attempts",
          { questionId: f.question._id, answer: "2" },
          f.student,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          path + "/hints",
          { questionId: f.question._id },
          f.student,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (await f.request(path + "/complete", {}, f.student)).statusCode,
      404,
    );
    assert.equal(
      await f
        .c("attempts")
        .countDocuments({ assignmentId: started.assignmentId }),
      0,
    );
    assert.equal(
      await f
        .c("hintEvents")
        .countDocuments({ assignmentId: started.assignmentId }),
      0,
    );

    // The owner can still inspect the assignment for support and audit.
    assert.equal((await f.request(path, undefined, f.teacher)).statusCode, 200);
  } finally {
    await f.close();
  }
});

test("another teacher cannot publish, unpublish, or inherit access to a question", async () => {
  const { f, course } = await preparePublishedLibraryQuestion();
  try {
    await f.post("/api/auth/register", {
      name: "Other Teacher",
      email: "other-teacher@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "other-teacher@test.dev",
      password: "StrongPass123!",
    });
    assert.equal(login.statusCode, 200, login.body);
    const otherTeacher = "session=" + login.cookies[0].value;
    const otherCourse = await f.post(
      "/api/courses",
      { subject: "ریاضی", title: "درس معلم دیگر" },
      otherTeacher,
    );

    assert.equal(
      (
        await f.request(
          `/api/questions/${f.question._id}/library`,
          { courseId: otherCourse._id, published: true },
          otherTeacher,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/api/questions/${f.question._id}/library`,
          { courseId: course._id, published: false },
          otherTeacher,
        )
      ).statusCode,
      404,
    );
    assert.deepEqual(
      (
        await f.request(
          "/api/questions/library-publications",
          undefined,
          otherTeacher,
        )
      ).json(),
      [],
    );
    assert.equal(
      await f.c("libraryPublications").countDocuments({
        teacherId: f.assignment.teacherId,
        courseId: course._id,
        questionVersionId: f.question._id,
        published: true,
      }),
      1,
    );
  } finally {
    await f.close();
  }
});

test("revoking course membership removes library and practice authorization", async () => {
  const { f, course } = await preparePublishedLibraryQuestion();
  try {
    const started = await f.post(
      `/api/student/library/${f.question._id}/start`,
      { courseId: course._id },
      f.student,
    );
    const enrollment = await f.c("enrollments").findOne({
      studentId: f.assignment.studentId,
      courseId: course._id,
      status: "active",
    });
    assert.ok(enrollment);
    await f.post(`/api/enrollments/${enrollment._id}/leave`, {}, f.student);

    assert.deepEqual(
      (await f.request("/api/student/library", undefined, f.student)).json()
        .items,
      [],
    );
    assert.equal(
      (
        await f.request(
          `/api/student/library/${f.question._id}/start`,
          { courseId: course._id },
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
  } finally {
    await f.close();
  }
});
