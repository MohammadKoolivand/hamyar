import test from "node:test";
import assert from "node:assert/strict";
import { assessHint } from "../../src/server/ai/hint-safety";
test("healthy teacher operand/count mentions are not rejected as final answers; raw AI and explicit results stay guarded", () => {
  const q = { reference: "2", type: "numeric" };
  assert.equal(assessHint(q, "دو عدد را جمع کن."), "clear");
  assert.equal(assessHint(q, "از عدد ۲ شروع کن و یک گام جلو برو."), "clear");
  for (const hint of ["پاسخ ۲ است.", "جواب دو است.", "x=2", "2"])
    assert.equal(assessHint(q, hint), "blocked");
  assert.notEqual(assessHint(q, "دو عدد را جمع کن.", true), "clear");
  assert.equal(assessHint(q, "مفهوم مرتبط را مرور کن.", true), "clear");
});
