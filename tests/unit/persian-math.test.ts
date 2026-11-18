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
  assert.match(mathMarkup("x^{2}"), /<mn>۲<\/mn>/);
  assert.doesNotMatch(mathMarkup("x^{2}"), /<mn>2<\/mn>/);
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

test("question display uses explicit ezafe yeh without changing other hamza letters", async () => {
  const { questionDisplayText } = await import("../../src/lib/math-render");
  assert.equal(
    questionDisplayText("معادلهٔ درجهٔ دوم و ریشۀ مضاعف"),
    "معادله‌ی درجه‌ی دوم و ریشه‌ی مضاعف",
  );
  assert.equal(
    questionDisplayText("تأثیر، سؤال، مسئله و ه"),
    "تأثیر، سؤال، مسئله و ه",
  );
});

test("final heh ezafe stays readable next to a mathematical identifier", async () => {
  const { questionDisplayText } = await import("../../src/lib/math-render");
  assert.equal(
    questionDisplayText("عرض نقطهٔ A و ناحیۀ اول"),
    "عرض نقطه‌ی A و ناحیه‌ی اول",
  );
});

test("matrix expressions have KaTeX HTML geometry and MathML accessibility", () => {
  const matrix = String.raw`\begin{bmatrix}1 & -1 & 1 & -1 \\ -1 & 20 & x & -1\end{bmatrix}\begin{bmatrix}2 & 3 \\ -2 & 4 \\ -3 & y \\ 3 & 4\end{bmatrix}`;
  const markup = mathMarkup(matrix, false);
  assert.match(markup, /class="katex-html" aria-hidden="true"/);
  assert.match(markup, /<math\b/);
  assert.match(markup, /class="(?:mord|mopen|mclose)[^"]*"/);
  assert.match(markup, /class="katex-base"/);
});

test("ordinary fractions also render KaTeX HTML rather than relying on cramped native MathML", () => {
  const markup = mathMarkup(String.raw`\frac{x}{y}`, false);
  assert.match(markup, /class="katex-html" aria-hidden="true"/);
  assert.match(markup, /<mfrac>/);
});

test("question and option digits are Persian at display time, while URL and math source remain unchanged", async () => {
  const { questionDisplayText } = await import("../../src/lib/math-render");
  assert.equal(questionDisplayText("گزینه 1 و عدد 23.5 و ٤٢"), "گزینه ۱ و عدد ۲۳.۵ و ۴۲");
  assert.equal(questionDisplayText("3 cm و $x^{2}$ و https://example.com/2026"),
    "۳ cm و $x^{2}$ و https://example.com/2026");
});

test("ASCII numerals in KaTeX display as Persian without changing source annotations or SVG geometry", () => {
  const source = String.raw`\sqrt{12}+\frac{3}{4}`;
  const markup = mathMarkup(source, false);
  assert.ok(markup.includes("<mn>۱۲</mn>"));
  assert.ok(markup.includes("<mn>۳</mn>"));
  assert.ok(markup.includes("<mn>۴</mn>"));
  assert.match(markup, /class="hy-math-number">[۰-۹]/);
  assert.ok(markup.includes(source), "the original LaTeX annotation remains untouched");
  for (const path of markup.matchAll(/\bd="([^"]+)"/g)) {
    assert.doesNotMatch(path[1], /[۰-۹]/);
  }
}
