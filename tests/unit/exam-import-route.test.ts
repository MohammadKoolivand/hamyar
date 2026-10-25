import assert from "node:assert/strict";
import { test } from "node:test";
import { pageFromPath, pathForPage, routeSegments } from "../../src/lib/app-routes";

test("exam import has an independent, refreshable route", () => {
  assert.equal(pathForPage("exam-import"), "/exam-import");
  assert.equal(pageFromPath("/exam-import"), "exam-import");
  assert.ok(routeSegments.includes("exam-import"));
});
