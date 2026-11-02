import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionPicker } from "../../src/features/content/question-picker";
import type { Question } from "../../src/lib/types";

// Both class and individual mission forms use this same picker.
test("mission and class question picker renders LaTeX in the question list", () => {
  const question = {
    _id: "math-picker-fixture",
    statement: "مقدار $\\frac{۱۲}{۳}+\\sqrt{۴}$ چیست؟",
    type: "choice",
    options: ["$۶$", "$۸$"],
    reference: "$۶$",
    hints: [],
    classification: "free",
  } satisfies Question;
  const markup = renderToStaticMarkup(
    React.createElement(QuestionPicker, {
      questions: [question],
      selected: [],
      onChange: () => {},
    }),
  );
  assert.match(markup, /<math\b/);
  assert.match(markup, /<mfrac>/);
  assert.match(markup, /<svg\b/);
  const visibleList = markup
    .split('class="line-clamp-2"')[1]
    .split('class="text-xs text-teal-700"')[0];
  // MathML annotations intentionally retain source LaTeX for accessibility.
  const visibleText = visibleList.replace(
    /<annotation\b[^>]*>[\s\S]*?<\/annotation>/g,
    "",
  );
  assert.doesNotMatch(visibleText, /\\frac|\\sqrt/);
});
