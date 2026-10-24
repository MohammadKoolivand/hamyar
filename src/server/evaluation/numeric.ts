import type { EvaluationResult } from "./types";
export function normalize(s: string) {
  return s
    .trim()
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/٫/g, ".")
    .replace(/[−–]/g, "-");
}
export function numericValue(input: string): number | undefined {
  const value = normalize(input);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))
    return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
export function numeric(
  q: { reference: string; tolerance: number; relativeTolerance?: number },
  answer: string,
): EvaluationResult {
  const actual = numericValue(answer),
    expected = numericValue(q.reference);
  if (expected === undefined)
    return result("pending_review", "human_required", "invalid_reference");
  if (actual === undefined)
    return result("incorrect", "deterministic", "invalid_numeric_input");
  if (
    Math.abs(actual) > Number.MAX_SAFE_INTEGER ||
    Math.abs(expected) > Number.MAX_SAFE_INTEGER
  )
    return result(
      "pending_review",
      "human_required",
      "numeric_precision_limit",
    );
  const threshold = Math.max(
    q.tolerance,
    (q.relativeTolerance ?? 0) * Math.abs(expected),
  );
  return result(
    Math.abs(actual - expected) <= threshold ? "correct" : "incorrect",
    "deterministic",
    "absolute_relative_tolerance",
  );
}
export function result(
  status: EvaluationResult["result"],
  method: EvaluationResult["method"],
  explanation: string,
): EvaluationResult {
  return {
    result: status,
    method,
    requiresTeacherReview: ["pending_review", "uncertain"].includes(status),
    explanation,
    evidence: [explanation],
    evaluatorVersion: "hamyar-eval-2",
  };
}
