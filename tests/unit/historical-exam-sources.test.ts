import { test } from "node:test";
import assert from "node:assert/strict";
import { historicalExamAssets } from "../../src/lib/historical-exam-sources";

test("historical exam assets have unique stable ids, safe URLs and truthful status flags", () => {
  assert.equal(new Set(historicalExamAssets.map((entry) => entry.id)).size, historicalExamAssets.length);
  assert.equal(historicalExamAssets.length, 32);
  for (const asset of historicalExamAssets) {
    assert.match(asset.examId, /^(konkur|final)-/);
    assert.ok(asset.sourceUrl.startsWith("https://"));
    assert.ok(!asset.questionUrl || asset.questionUrl.startsWith("https://"));
    assert.ok(!asset.answerUrl || asset.answerUrl.startsWith("https://"));
    if (asset.verification === "official_key_url_reported_not_accessible") {
      assert.equal(asset.questionUrl, "");
      assert.ok(asset.answerUrl.includes("sanjesh.org"));
    }
  }
});

test("only 26 source rows contain both question and key PDF URLs", () => {
  assert.equal(historicalExamAssets.filter((asset) => asset.questionUrl && asset.answerUrl).length, 26);
  assert.equal(historicalExamAssets.filter((asset) => !asset.questionUrl && asset.answerUrl).length, 6);
});
