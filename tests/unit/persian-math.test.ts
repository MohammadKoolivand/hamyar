import { test } from "node:test";
import assert from "node:assert/strict";
import { mathMarkup } from "../../src/lib/math-render";
test("Persian-number LaTeX preserves fraction, root, exponent and renders Persian math numerals", () => {
  const markup = mathMarkup("\\frac{۱۲}{۳}+x^{۲}+\\sqrt[۳]{۸}");
  assert.match(markup, /<mfrac>/);
  assert.match(markup, /<msup>/);
  assert.match(markup, /<mroot>/);
  assert.match(markup, /<mn>۱۲<\/mn>/);
  assert.match(markup, /<mn>۳<\/mn>/);
  assert.doesNotMatch(markup, /<mn>[0-9]+<\/mn>/);
  assert.match(mathMarkup("x^{2}"), /<mn>2<\/mn>/);
  assert.throws(() => mathMarkup("\\href{https://example.com}{۱۲}"));
});
