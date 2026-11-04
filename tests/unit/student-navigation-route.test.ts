import assert from "node:assert/strict";
import test from "node:test";
import {
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

test("legacy student learning and mission URLs remain available", () => {
  assert.equal(pageFromPath("/learning"), "learning");
  assert.equal(pageFromPath("/homeworks"), "missions");
});
