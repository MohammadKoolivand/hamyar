import type { QuestionInput } from "../domain";
import type { EvaluationResult } from "./types";
import { numeric, normalize, result } from "./numeric";
import { symbolicCompare } from "./symbolic";
export type Evaluator = (q: QuestionInput, answer: string) => EvaluationResult;
const equality: Evaluator = (q, a) =>
  result(
    normalize(a) === normalize(q.reference) ? "correct" : "incorrect",
    q.type === "short" ? "rule_based" : "deterministic",
    "exact_normalized_match",
  );
export const evaluators: Record<QuestionInput["type"], Evaluator> = {
  numeric,
  choice: equality,
  short: (q, a) =>
    q.rubric?.length
      ? result("pending_review", "human_required", "rubric_requires_teacher")
      : equality(q, a),
  essay: () =>
    result("pending_review", "human_required", "rubric_requires_teacher"),
  symbolic: (q, a) => {
    if (!q.mathContext)
      return result(
        "pending_review",
        "human_required",
        "missing_math_assumptions",
      );
    const comparison = symbolicCompare(
      normalize(a),
      normalize(q.reference),
      q.mathContext,
    );
    return result(
      comparison.equal === undefined
        ? "pending_review"
        : comparison.equal
          ? "correct"
          : "incorrect",
      "symbolic",
      comparison.reason,
    );
  },
};
export function evaluate(
  q: QuestionInput,
  answer: string,
  registry = evaluators,
): EvaluationResult {
  return registry[q.type](q, answer);
}
