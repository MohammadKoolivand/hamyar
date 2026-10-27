import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "../helpers/fixture";
test("GROUP-014: exact 50 active enrolled members allowed; 51 and revoked enrollment denied", async () => {
  const f = await fixture();
  try {
    const course = await f.post(
      "/api/courses",
      { title: "Boundary class", subject: "Math" },
      f.teacher,
    );
    const ids = Array.from({ length: 51 }, () => randomUUID());
    await f
      .c("enrollments")
      .insertMany(
        ids.map((studentId) => ({
          _id: randomUUID(),
          teacherId: f.assignment.teacherId,
          courseId: course._id,
          studentId,
          status: "active",
        })),
      );
    const group = await f.post(
      "/api/class-groups",
      {
        courseId: course._id,
        title: "Fifty active",
        studentIds: ids.slice(0, 50),
      },
      f.teacher,
    );
    assert.equal(group.studentIds.length, 50);
    assert.equal(
      (
        await f.request(
          `/api/class-groups/${group._id}/members`,
          { studentIds: ids },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    await f
      .c("enrollments")
      .updateOne({ studentId: ids[0] }, { $set: { status: "revoked" } });
    assert.equal(
      (
        await f.request(
          `/api/class-groups/${group._id}/members`,
          { studentIds: ids.slice(0, 50) },
          f.teacher,
        )
      ).statusCode,
      409,
    );
  } finally {
    await f.close();
  }
});
test("SEC-009/OPS-008: student endpoints never return private reference/password/hash; every error has request ID", async () => {
  const f = await fixture();
  try {
    await f
      .c("questionVersions")
      .updateOne(
        { _id: f.question._id },
        { $set: { reference: "PRIVATE_REFERENCE_SENTINEL" } },
      );
    for (const path of [
      "/api/auth/me",
      "/api/assignments",
      f.path,
      f.path + "/report",
    ]) {
      const r = await f.request(path, undefined, f.student);
      assert.equal(r.statusCode, 200);
      assert.ok(!r.body.includes("PRIVATE_REFERENCE_SENTINEL"));
      assert.ok(!r.body.includes("passwordHash"));
      assert.ok(!r.body.includes("StrongPass123!"));
      assert.ok(r.headers["x-request-id"]);
    }
    const r = await f.request("/api/questions", undefined, f.student);
    assert.equal(r.statusCode, 403);
    assert.ok(r.headers["x-request-id"]);
  } finally {
    await f.close();
  }
});
