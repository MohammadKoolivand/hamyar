import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  questionVisualsSchema,
  visualTemplate,
} from "../../src/lib/question-visuals";
import { questionSchema } from "../../src/server/domain";
import { mathMarkup } from "../../src/lib/math-render";
import { QuestionPresentation } from "../../src/components/question-presentation";
const base = {
  topicId: "00000000-0000-4000-8000-000000000001",
  statement: "سؤال معتبر",
  type: "numeric",
  reference: "2",
};
test("visual data validates ranges, bounds, complexity and required content", () => {
  for (const k of ["chart", "geometry", "formula"] as const)
    assert.ok(
      questionSchema.safeParse({
        ...base,
        visualKind: k,
        visuals: [visualTemplate(k)],
      }).success,
    );
  assert.ok(
    !questionSchema.safeParse({ ...base, visualKind: "chart" }).success,
  );
  const chart = visualTemplate("chart");
  assert.equal(chart.kind, "chart");
  if (chart.kind !== "chart") return;
  assert.ok(
    !questionVisualsSchema.safeParse([{ ...chart, xRange: [5, 0] }]).success,
  );
  assert.ok(
    !questionVisualsSchema.safeParse([
      {
        ...chart,
        series: [
          {
            name: "x",
            points: [
              [0, 0],
              [99, 10],
            ],
          },
        ],
      },
    ]).success,
  );
  assert.ok(
    !questionVisualsSchema.safeParse([
      {
        ...chart,
        series: [
          { name: "x", points: Array.from({ length: 81 }, () => [0, 0]) },
        ],
      },
    ]).success,
  );
  assert.ok(
    !questionVisualsSchema.safeParse([{ ...chart, html: "<script/>" }]).success,
  );
  assert.ok(
    !questionVisualsSchema.safeParse([
      {
        kind: "geometry",
        caption: "دایره",
        points: [],
        segments: [],
        circles: [{ x: 2, y: 2, r: 50, label: "" }],
      },
    ]).success,
  );
  assert.ok(!questionVisualsSchema.safeParse(Array(4).fill(chart)).success);
  assert.ok(
    !questionSchema.safeParse({
      ...base,
      visuals: [{ kind: "formula", caption: "فرمول", latex: "\\frac{" }],
    }).success,
  );
});
test("safe mathematical rendering produces actual SVG and MathML, escapes text and rejects external resources", () => {
  const chart = visualTemplate("chart");
  chart.caption = "<img src=x onerror=alert(1)>";
  const markup = renderToStaticMarkup(
    createElement(QuestionPresentation, {
      statement: "مقدار $\\frac{1}{2}$ را بنویسید",
      visuals: [chart, visualTemplate("geometry"), visualTemplate("formula")],
    }),
  );
  assert.ok(markup.includes("<svg"));
  assert.ok(markup.includes("<polyline"));
  assert.ok(markup.includes("<mfrac>"));
  assert.ok(!markup.includes("<img"));
  for (const latex of [
    "\\href{https://example.com}{x}",
    "\\includegraphics{https://example.com/x}",
    "\\htmlStyle{color:red}{x}",
    "\\def\\x{\\x}\\x",
  ])
    assert.throws(() => mathMarkup(latex));
  assert.ok(mathMarkup("x^2 + \\sqrt{4}").includes("<math"));
});
