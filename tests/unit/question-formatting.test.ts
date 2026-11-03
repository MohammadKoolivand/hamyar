import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MathText } from "../../src/components/question-presentation";
import { toggleQuestionUnderline } from "../../src/lib/question-formatting";

test("selected Persian words can be underlined and toggled without changing surrounding text", () => {
  const text = "کدام عبارت نادرست است؟";
  const start = text.indexOf("نادرست");
  const result = toggleQuestionUnderline(text, start, start + 6)!;
  assert.equal(result.text, "کدام عبارت <u>نادرست</u> است؟");
  assert.equal(result.text.slice(result.start, result.end), "نادرست");
  assert.equal(
    toggleQuestionUnderline(result.text, result.start, result.end)!.text,
    text,
  );
  assert.equal(toggleQuestionUnderline(text, start, start), null);
});

test("underlined text renders alongside LaTeX while arbitrary HTML remains inert", () => {
  const html = renderToStaticMarkup(
    createElement(MathText, {
      text: 'کدام <u>نادرست</u> است؟ <u>$\\frac{۱}{۲}$</u> <script>alert(1)</script> <u onclick="bad()">خطر</u>',
    }),
  );
  assert.equal((html.match(/<u /g) ?? []).length, 2);
  assert.match(html, /<mfrac>/);
  assert.match(html, /نادرست/);
  assert.doesNotMatch(html, /<script>|<u onclick=/);
  assert.match(html, /&lt;script&gt;/);
});
