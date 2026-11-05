import assert from "node:assert/strict";
import test from "node:test";
import {
  courseFromSearch,
  pageFromPath,
  pathForPage,
  routeSegments,
} from "../../src/lib/app-routes";

const studentRoutes = [
  ["student-practice", "/student-practice"],
  ["student-missions", "/student-missions"],
  ["student-mistakes", "/mistakes"],
  ["student-progress", "/progress"],
  ["student-search", "/search"],
] as const;

test("phase-one student sections have stable, reversible deep links", () => {
  for (const [page, path] of studentRoutes) {
    assert.equal(pathForPage(page), path);
    assert.equal(pageFromPath(path), page);
    assert.ok((routeSegments as readonly string[]).includes(path.slice(1)));
  }
});

test("a student course page keeps its course in a direct link", () => {
  const id = "12345678-1234-4234-8234-123456789abc";
  assert.equal(pathForPage("student-course", id), `/course?course=${id}`);
  assert.equal(pageFromPath("/course"), "student-course");
  assert.equal(courseFromSearch(`?course=${id}`), id);
  assert.equal(courseFromSearch("?course=not-an-id"), null);
});

test("legacy student learning and mission URLs remain available", () => {
  assert.equal(pageFromPath("/learning"), "learning");
  assert.equal(pageFromPath("/homeworks"), "missions");
});
