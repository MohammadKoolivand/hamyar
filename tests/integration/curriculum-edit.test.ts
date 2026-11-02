import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

test("manual curriculum edit preserves question references, audits changes and rejects non-owners", async () => {
  const f = await fixture();
  try {
    const nodeId = f.question.topicId;
    const before = await f.c("curriculum").findOne({ _id: nodeId });
    const updated = await f.post(
      `/api/curriculum/${nodeId}/update`,
      { title: "  مبحث ویرایش‌شده  " },
      f.teacher,
    );
    assert.equal(updated.title, "مبحث ویرایش‌شده");
    assert.equal(updated.parentId, before!.parentId);
    assert.equal(
      (await f.c("questionVersions").findOne({ _id: f.question._id }))!.topicId,
      nodeId,
    );
    assert.equal(
      await f
        .c("auditLogs")
        .countDocuments({ action: "update_curriculum", resourceId: nodeId }),
      1,
    );
    assert.equal(
      (
        await f.request(
          `/api/curriculum/${nodeId}/update`,
          { title: "" },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await f.request(
          `/api/curriculum/${nodeId}/update`,
          { title: "نام دیگر" },
          f.student,
        )
      ).statusCode,
      403,
    );
    await f.post("/api/auth/register", {
      name: "Other",
      email: "curriculum-other@test.dev",
      password: "StrongPass123!",
      role: "teacher",
    });
    const login = await f.request("/api/auth/login", {
      email: "curriculum-other@test.dev",
      password: "StrongPass123!",
    });
    assert.equal(login.statusCode, 200);
    const other = "session=" + login.cookies[0].value;
    assert.equal(
      (
        await f.request(
          `/api/curriculum/${nodeId}/update`,
          { title: "تغییر غیرمجاز" },
          other,
        )
      ).statusCode,
      404,
    );
    await f.post(`/api/curriculum/${nodeId}/remove`, {}, f.teacher);
    assert.equal(
      (
        await f.request(
          `/api/curriculum/${nodeId}/update`,
          { title: "عنوان حذف‌شده" },
          f.teacher,
        )
      ).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
