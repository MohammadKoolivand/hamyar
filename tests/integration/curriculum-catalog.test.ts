import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import {
  catalogId,
  curriculumCatalog,
} from "../../src/server/curriculum-catalog";
test("catalog import is transactional, repeat/concurrent safe, preserves custom content and private per teacher", async () => {
  let failImport = false;
  const f = await fixture({
    hooks: {
      boundary: async (point) => {
        if (failImport && point === "after_catalog_import")
          throw new Error("injected import failure");
      },
    },
  });
  try {
    const teacher = (
      await f.request("/api/auth/me", undefined, f.teacher)
    ).json();
    assert.equal(
      (await f.request("/api/curriculum/catalog", undefined, f.student))
        .statusCode,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/curriculum/catalog/import",
          { bookIds: ["missing"] },
          f.teacher,
        )
      ).statusCode,
      400,
    );
    const body = { bookIds: curriculumCatalog.books.map((b) => b.id) };
    const beforeImport = await f.c("curriculum").countDocuments();
    failImport = true;
    assert.equal(
      (await f.request("/api/curriculum/catalog/import", body, f.teacher))
        .statusCode,
      500,
    );
    assert.equal(await f.c("curriculum").countDocuments(), beforeImport);
    failImport = false;
    const r = await f.post(
      "/api/curriculum/catalog/import",
      body,
      f.teacher,
      "catalog-import-1",
    );
    assert.ok(r.created > 500);
    const count = await f.c("curriculum").countDocuments();
    assert.equal(
      (
        await f.post(
          "/api/curriculum/catalog/import",
          body,
          f.teacher,
          "catalog-import-1",
        )
      ).created,
      r.created,
    );
    const repeats = await Promise.all(
      Array.from({ length: 3 }, () =>
        f.post("/api/curriculum/catalog/import", body, f.teacher),
      ),
    );
    assert.ok(repeats.every((r) => r.created === 0));
    assert.equal(await f.c("curriculum").countDocuments(), count);
    assert.ok(await f.c("curriculum").findOne({ _id: f.question.topicId }));
    const root = catalogId(teacher._id, "iran");
    await f
      .c("curriculum")
      .updateOne({ _id: root }, { $set: { title: "عنوان شخصی معلم" } });
    await f.post("/api/curriculum/catalog/import", body, f.teacher);
    assert.equal(
      (await f.c("curriculum").findOne({ _id: root }))!.title,
      "عنوان شخصی معلم",
    );
    // Simulate a v2 import: migrate only a known catalog title, keep all question references.
    const legacyId = catalogId(
      teacher._id,
      "book:riazi-tajrobi-12/chapter:7/topic:احتمال",
    );
    const bookId = catalogId(teacher._id, "book:riazi-tajrobi-12");
    await f
      .c("curriculum")
      .updateOne(
        { _id: legacyId },
        { $set: { title: "احتمال", sourceBasis: "chapter" } },
      );
    await f
      .c("curriculum")
      .updateOne(
        { _id: bookId },
        { $set: { source: { officialEditionVerified: false } } },
      );
    await f.post(
      "/api/questions",
      {
        topicId: legacyId,
        statement: "سؤال قدیمی احتمال",
        type: "numeric",
        reference: "1",
      },
      f.teacher,
    );
    failImport = true;
    assert.equal(
      (await f.request("/api/curriculum/catalog/import", body, f.teacher))
        .statusCode,
      500,
    );
    assert.equal(
      (await f.c("curriculum").findOne({ _id: legacyId }))!.title,
      "احتمال",
    );
    assert.equal(
      (await f.c("curriculum").findOne({ _id: bookId }))!.source
        .officialEditionVerified,
      false,
    );
    failImport = false;
    const upgraded = await f.post(
      "/api/curriculum/catalog/import",
      body,
      f.teacher,
    );
    assert.equal(upgraded.created, 0);
    assert.equal(upgraded.updated, 2);
    assert.equal(
      (await f.c("curriculum").findOne({ _id: legacyId }))!.title,
      "قانون احتمال کل",
    );
    assert.equal(
      (await f.c("curriculum").findOne({ _id: bookId }))!.source.bookCode,
      "C112211",
    );
    assert.ok(await f.c("questionVersions").findOne({ topicId: legacyId }));
    await f
      .c("curriculum")
      .updateOne({ _id: legacyId }, { $set: { title: "عنوان انتخابی معلم" } });
    await f.post("/api/curriculum/catalog/import", body, f.teacher);
    assert.equal(
      (await f.c("curriculum").findOne({ _id: legacyId }))!.title,
      "عنوان انتخابی معلم",
    );
    const topic = await f.c("curriculum").findOne({
      ownerId: teacher._id,
      kind: "topic",
      catalogBookId: "riaziat-g12",
    });
    assert.ok(topic);
    await f.post(
      "/api/questions",
      {
        topicId: topic!._id,
        statement: "سؤال معلم در یک مبحث کاتالوگ",
        type: "numeric",
        reference: "1",
      },
      f.teacher,
    );
    await f.post("/api/auth/register", {
      name: "Other Teacher",
      email: "catalog-other@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "catalog-other@test.dev",
      password: "StrongPass123!",
    });
    const other = "session=" + login.cookies[0].value;
    assert.deepEqual(
      (await f.request("/api/curriculum", undefined, other)).json(),
      [],
    );
    assert.equal(
      (
        await f.request(
          "/api/questions",
          {
            topicId: topic!._id,
            statement: "دسترسی غیرمجاز",
            type: "numeric",
            reference: "1",
          },
          other,
        )
      ).statusCode,
      404,
    );
  } finally {
    await f.close();
  }
});
