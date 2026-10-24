import { test } from "node:test";
import assert from "node:assert/strict";
import { curriculumTopicChoices } from "../../src/lib/curriculum";
import {
  catalogNodes,
  curriculumCatalog,
} from "../../src/server/curriculum-catalog";
import type { Node } from "../../src/lib/types";
test("topic paths select nearest grade/book/chapter and carry each book track without mixing repeated names", () => {
  const nodes = catalogNodes(
    "teacher",
    curriculumCatalog.books.map((b) => b.id),
  ) as unknown as Node[];
  const choices = curriculumTopicChoices(nodes);
  assert.equal(choices.length, 640);
  const physics = choices.filter((c) => c.book.title.startsWith("فیزیک (۳)"));
  assert.ok(physics.some((c) => c.tracks.includes("mathematics")));
  assert.ok(physics.some((c) => c.tracks.includes("experimental")));
  for (const c of physics) {
    assert.equal(c.grade.title, "پایه دوازدهم");
    assert.ok(c.chapter.title.startsWith("فصل"));
  }
  const repeated = choices.filter((c) => c.topic.title === "معادله");
  assert.ok(repeated.length > 1);
  assert.ok(new Set(repeated.map((c) => c.book.id)).size > 1);
});
test("custom topics without hierarchy remain selectable; malformed ancestor cycles terminate", () => {
  const rows = curriculumTopicChoices([
    { _id: "t", title: "موضوع شخصی", kind: "topic" },
    { _id: "s", title: "درس", kind: "subject", parentId: "s" },
    { _id: "x", title: "موضوع", kind: "topic", parentId: "s" },
  ]);
  assert.equal(rows[0].grade.id, "ungraded");
  assert.equal(rows[0].book.id, "unassigned");
  assert.equal(rows[0].chapter.id, "unchaptered");
  assert.deepEqual(rows[0].tracks, ["custom"]);
  assert.equal(rows[1].book.id, "s");
});

test("ancestor selection handles orphan roots and cycles; related skills do not leak from another topic", async () => {
  const { curriculumAncestors, curriculumSkills } =
    await import("../../src/lib/curriculum");
  const nodes = [
    { _id: "book", title: "کتاب", kind: "course" },
    { _id: "topic-a", title: "مبحث الف", kind: "topic", parentId: "book" },
    { _id: "topic-b", title: "مبحث ب", kind: "topic", parentId: "book" },
    { _id: "skill-a", title: "مهارت الف", kind: "skill", parentId: "topic-a" },
    { _id: "skill-b", title: "مهارت ب", kind: "skill", parentId: "topic-b" },
    { _id: "global", title: "مهارت عمومی", kind: "skill" },
    {
      _id: "orphan",
      title: "مبحث بدون والد",
      kind: "topic",
      parentId: "missing",
    },
  ];
  assert.deepEqual(
    curriculumAncestors(nodes, "skill-a").map((n) => n._id),
    ["book", "topic-a", "skill-a"],
  );
  assert.deepEqual(
    curriculumAncestors(nodes, "orphan").map((n) => n._id),
    ["orphan"],
  );
  assert.deepEqual(
    curriculumSkills(nodes, "topic-a").map((n) => n._id),
    ["skill-a", "global"],
  );
  assert.equal(
    curriculumAncestors(
      [
        { _id: "a", title: "a", kind: "topic", parentId: "b" },
        { _id: "b", title: "b", kind: "chapter", parentId: "a" },
      ],
      "a",
    ).length,
    2,
  );
});
