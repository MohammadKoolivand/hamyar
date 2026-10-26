import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "../helpers/fixture";
import {
  curriculumCatalog,
  catalogId,
} from "../../src/server/curriculum-catalog";

test("resource removal archives owned subtree, preserves question history and supports official reimport", async () => {
  const f = await fixture();
  try {
    const teacher = (
      await f.request("/api/auth/me", undefined, f.teacher)
    ).json();
    const root = await f.post(
      "/api/curriculum",
      { title: "Removable", kind: "course" },
      f.teacher,
    );
    const child = await f.post(
      "/api/curriculum",
      { title: "Chapter", kind: "chapter", parentId: root._id },
      f.teacher,
    );
    assert.equal(
      (await f.request(`/api/curriculum/${root._id}/remove`, {}, f.student))
        .statusCode,
      403,
    );
    const foreign = randomUUID();
    await f
      .c("curriculum")
      .insertOne({
        _id: foreign,
        ownerId: randomUUID(),
        title: "Private",
        kind: "topic",
      });
    assert.equal(
      (await f.request(`/api/curriculum/${foreign}/remove`, {}, f.teacher))
        .statusCode,
      404,
    );
    const result = await f.post(
      `/api/curriculum/${root._id}/remove`,
      {},
      f.teacher,
    );
    assert.equal(result.removed, 2);
    const nodes = (
      await f.request("/api/curriculum", undefined, f.teacher)
    ).json();
    assert.ok(
      !nodes.some((n: { _id: string }) =>
        [root._id, child._id].includes(n._id),
      ),
    );
    assert.ok(
      await f
        .c("curriculum")
        .findOne({ _id: child._id, archivedAt: { $exists: true } }),
    );
    assert.equal(
      (
        await f.request(
          "/api/curriculum",
          { title: "Invalid child", kind: "topic", parentId: child._id },
          f.teacher,
        )
      ).statusCode,
      404,
    );
    const versions = await f.c("questionVersions").countDocuments();
    const originalNodes = await f
      .c("curriculum")
      .find({
        ownerId: teacher._id,
        kind: "topic",
        archivedAt: { $exists: false },
      })
      .toArray();
    await f.post(
      `/api/curriculum/${originalNodes[0]._id}/remove`,
      {},
      f.teacher,
    );
    assert.equal(await f.c("questionVersions").countDocuments(), versions);
    const book = curriculumCatalog.books[0];
    await f.post(
      "/api/curriculum/catalog/import",
      { bookIds: [book.id] },
      f.teacher,
    );
    const bookId = catalogId(teacher._id, "book:" + book.id);
    await f.post(`/api/curriculum/${bookId}/remove`, {}, f.teacher);
    assert.ok((await f.c("curriculum").findOne({ _id: bookId }))?.archivedAt);
    await f.post(
      "/api/curriculum/catalog/import",
      { bookIds: [book.id] },
      f.teacher,
    );
    assert.equal(
      (await f.c("curriculum").findOne({ _id: bookId }))?.archivedAt,
      undefined,
    );
  } finally {
    await f.close();
  }
});
