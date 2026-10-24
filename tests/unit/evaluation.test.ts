import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluate,
  questionSchema,
  type QuestionInput,
} from "../../src/server/domain";
const base: QuestionInput = {
  topicId: "9386225f-12d4-4d4d-bc19-dbe7b27d1196",
  skillIds: [],
  statement: "A configurable question",
  type: "numeric",
  reference: "100",
  tolerance: 0,
  hints: [],
  options: [],
};
const math = {
  ...base,
  type: "symbolic" as const,
  mathContext: {
    variables: ["x"],
    domain: "real" as const,
    mode: "expression" as const,
  },
};
test("numeric: signed Persian/Arabic, decimals, scientific notation and relative/absolute tolerance", () => {
  for (const value of ["−۱۰۰", "-١٠٠", "-1e2", "-100.000"])
    assert.equal(
      evaluate({ ...base, reference: "-100" }, value).result,
      "correct",
    );
  assert.equal(
    evaluate({ ...base, relativeTolerance: 0.01 }, "100.5").result,
    "correct",
  );
  assert.equal(
    evaluate({ ...base, tolerance: 0.6 }, "100.5").result,
    "correct",
  );
  assert.equal(
    evaluate({ ...base, tolerance: 0.1, relativeTolerance: 0.001 }, "100.5")
      .result,
    "incorrect",
  );
  for (const value of [
    "0x64",
    "Infinity",
    "NaN",
    "[100]",
    "1,00",
    "100abc",
    "1e999",
  ]) {
    const r = evaluate(base, value);
    assert.equal(r.result, "incorrect");
    assert.equal(r.explanation, "invalid_numeric_input");
  }
  assert.equal(
    evaluate({ ...base, reference: "9007199254740993" }, "9007199254740992")
      .result,
    "pending_review",
  );
});
test("symbolic: exact fractions, polynomial equivalence, explicit real assumptions", () => {
  for (const [reference, answer] of [
    ["1/2", "2/4"],
    ["x+x", "2x"],
    ["(x+1)^2", "x^2+2x+1"],
    ["0.1+0.2", "0.3"],
    ["-x+3", "3-x"],
  ]) {
    const r = evaluate({ ...math, reference }, answer);
    assert.equal(r.result, "correct", JSON.stringify({ reference, answer, r }));
    assert.equal(r.method, "symbolic");
  }
  assert.equal(
    evaluate({ ...math, reference: "x+1" }, "x+2").result,
    "incorrect",
  );
  const equation = {
    ...math,
    mathContext: { ...math.mathContext, mode: "equation" as const },
    reference: "2x+5=15",
  };
  assert.equal(evaluate(equation, "x=5").result, "correct");
  assert.equal(evaluate(equation, "x=10").result, "incorrect");
});
test("unsupported domains/syntax/precision route to review, never an unjustified incorrect grade", () => {
  for (const answer of [
    "x/x",
    "sqrt(x)",
    "x^100000",
    "sin(x)",
    "1/(x-1)",
    "x=5",
    "x^0",
    "0^0",
    'import("fs")',
    "a.b",
    "[1,2]",
    "x;process.exit()",
    "0.10000000000000001",
    "(".repeat(17) + "x" + ")".repeat(17),
  ]) {
    const r = evaluate({ ...math, reference: "1" }, answer);
    assert.equal(r.result, "pending_review", answer);
    assert.equal(r.requiresTeacherReview, true);
  }
  const equation = {
    ...math,
    reference: "x^2=1",
    mathContext: { ...math.mathContext, mode: "equation" as const },
  };
  assert.equal(evaluate(equation, "x=1").result, "pending_review");
});
test("rubric-based short/essay responses remain human reviewed and preserve reference/rubric", () => {
  const q = {
    ...base,
    type: "short" as const,
    reference: "A nuanced response",
    rubric: [{ criterion: "Explanation", weight: 1 }],
  };
  assert.equal(evaluate(q, "A nuanced response").result, "pending_review");
  assert.equal(
    evaluate({ ...q, type: "essay" }, "anything").requiresTeacherReview,
    true,
  );
  assert.equal(q.rubric[0].criterion, "Explanation");
  assert.equal(
    questionSchema.safeParse({ ...math, mathContext: undefined }).success,
    false,
  );
});
test("deterministic algebra property corpus: expansion and scaled linear equations", () => {
  for (let a = -8; a <= 8; a++)
    for (let b = -5; b <= 5; b++) {
      const reference = `(${a}*x+${b})*2`,
        answer = `${2 * a}*x+${2 * b}`;
      assert.equal(
        evaluate({ ...math, reference }, answer).result,
        "correct",
        reference,
      );
      const eq = {
        ...math,
        mathContext: { ...math.mathContext, mode: "equation" as const },
        reference: `x+${b}=${a}`,
      };
      assert.equal(evaluate(eq, `2x+${2 * b}=${2 * a}`).result, "correct");
    }
});
