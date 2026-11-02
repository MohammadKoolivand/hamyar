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

test("radicals use continuous SVG outlines and Persian visible digits without changing path coordinates", () => {
  for (const latex of [
    "\\sqrt{۲}",
    "\\sqrt[۳]{۸}",
    "\\frac{۱}{\\sqrt{۲+\\sqrt{۳}}}",
  ]) {
    const markup = mathMarkup(latex, false);
    assert.match(markup, /class="katex-html" aria-hidden="true"/);
    assert.match(markup, /<svg\b/);
    assert.match(markup, /<path\b/);
    assert.match(markup, /class="hy-math-number">[۰-۹]/);
    assert.match(markup, /<math\b/);
    for (const path of markup.matchAll(/\bd="([^"]+)"/g)) {
      assert.doesNotMatch(path[1], /[۰-۹]/);
    }
  }
});

test("question display uses plain final heh without changing other hamza letters", async () => {
  const { questionDisplayText } = await import("../../src/lib/math-render");
  assert.equal(
    questionDisplayText("معادلهٔ درجهٔ دوم و ریشۀ مضاعف"),
    "معادله درجه دوم و ریشه مضاعف",
  );
  assert.equal(
    questionDisplayText("تأثیر، سؤال، مسئله و ه"),
    "تأثیر، سؤال، مسئله و ه",
  );
});
