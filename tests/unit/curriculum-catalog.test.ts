import { test } from "node:test";
import assert from "node:assert/strict";
import {
  curriculumCatalog,
  catalogNodes,
  catalogId,
} from "../../src/server/curriculum-catalog";
import { curriculumPath } from "../../src/lib/curriculum";
import { z } from "zod";
test("Iran secondary catalog covers grades/tracks, retains distinct physics editions and has no empty chapters", () => {
  const books = curriculumCatalog.books;
  assert.equal(books.length, 34);
  assert.equal(
    books.reduce((s, b) => s + b.chapters.length, 0),
    239,
  );
  for (const grade of [7, 8, 9])
    for (const subject of ["mathematics", "physics"])
      assert.ok(
        books.some(
          (b) =>
            b.grade === grade &&
            b.subject === subject &&
            b.tracks.includes("common"),
        ),
      );
  for (const grade of [10, 11, 12])
    for (const track of [
      "mathematics",
      "experimental",
      "humanities",
      "islamic",
    ]) {
      assert.ok(
        books.some(
          (b) =>
            b.grade === grade &&
            b.subject === "mathematics" &&
            b.tracks.includes(track),
        ),
      );
      assert.equal(
        books.filter(
          (b) =>
            b.grade === grade &&
            b.subject === "physics" &&
            b.tracks.includes(track),
        ).length,
        ["mathematics", "experimental"].includes(track) ? 1 : 0,
      );
    }
  assert.equal(
    books.find((b) => b.id === "physics-10-riazi")!.chapters.length,
    5,
  );
  assert.equal(
    books.find((b) => b.id === "physics-10-tajrobi")!.chapters.length,
    4,
  );
  assert.equal(
    books.find((b) => b.id === "physic-11-riazi")!.chapters.length,
    4,
  );
  assert.equal(
    books.find((b) => b.id === "physic-tajrobi-11")!.chapters.length,
    3,
  );
  assert.equal(books.find((b) => b.id === "physic-r12")!.chapters.length, 6);
  assert.equal(books.find((b) => b.id === "physic-t12")!.chapters.length, 4);
  for (const book of books) {
    assert.ok(book.chapters.length);
    assert.equal(book.source.officialEditionVerified, true);
    assert.ok(book.source.outlineUrl.startsWith("http://www.chap.sch.ir/"));
    for (const chapter of book.chapters) {
      assert.ok(chapter.title.trim());
      assert.ok(chapter.topics.length);
      assert.equal(
        new Set(chapter.topics.map((t) => t.title)).size,
        chapter.topics.length,
      );
    }
  }
});
test("catalog identities are stable, UUIDs valid, nodes connected and tenant scoped; path handles cycles", () => {
  const ids = curriculumCatalog.books.map((b) => b.id),
    a = catalogNodes("teacher-a", ids),
    b = catalogNodes("teacher-b", ids);
  assert.equal(new Set(a.map((n) => n._id)).size, a.length);
  const all = new Set(a.map((n) => n._id));
  for (const node of a) {
    z.uuid().parse(node._id);
    if (node.parentId) assert.ok(all.has(node.parentId as string));
  }
  assert.equal(catalogId("teacher-a", "iran"), a[0]._id);
  assert.ok(!b.some((n) => all.has(n._id)));
  assert.equal(
    curriculumPath(
      [
        { _id: "a", title: "A", kind: "topic", parentId: "b" },
        { _id: "b", title: "B", kind: "chapter", parentId: "a" },
      ],
      "a",
    ),
    "B / A",
  );
});

test("official supplements remain distinct and do not invent missing geology chapters", () => {
  const books = curriculumCatalog.books;
  for (const grade of [7, 8, 9]) {
    assert.equal(
      books.filter((b) => b.grade === grade && b.program === "gifted").length,
      2,
    );
  }
  const ninth = books.find((b) => b.id === "science-9-gifted")!;
  assert.equal(ninth.chapters.length, 13);
  assert.ok(!ninth.chapters.some((c) => c.title === "زمین‌ساخت ورقه‌ای"));
  assert.equal(
    books.find((b) => b.id === "riazi-7-gifted")!.chapters[0].order,
    0,
  );
  assert.equal(
    new Set(books.filter((b) => b.grade < 10).map((b) => b.source.outlineUrl))
      .size,
    12,
  );
});

test("upper secondary official book codes map to distinct grade/track books; corrected titles retain old topic identities", () => {
  const books = curriculumCatalog.books.filter((b) => b.grade >= 10);
  assert.equal(books.length, 19);
  assert.equal(new Set(books.map((b) => b.source.bookCode)).size, 19);
  for (const b of books) {
    assert.equal(b.source.academicYear, "1405-1406");
    assert.match(b.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(b.source.outlinePdfPages.length);
    assert.ok(b.source.bookCode.startsWith(`C1${b.grade}`));
    assert.ok(
      b.chapters.every((c) => c.topics.every((t) => t.basis === "lesson")),
    );
  }
  assert.equal(
    books.find((b) => b.id === "physic-r12")!.source.bookCode,
    "C112209",
  );
  assert.equal(
    books.find((b) => b.id === "physic-t12")!.source.bookCode,
    "C112244",
  );
  const nodes = catalogNodes("teacher", ["riazi-tajrobi-12"]);
  const topic = nodes.find((n) => n.title === "قانون احتمال کل")!;
  assert.ok(topic);
  assert.equal(
    topic._id,
    catalogId("teacher", "book:riazi-tajrobi-12/chapter:7/topic:احتمال"),
  );
  assert.equal(topic.sourceBasis, "lesson");
});
