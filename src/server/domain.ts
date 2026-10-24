import { z } from "zod";
export const questionSchema = z
  .object({
    topicId: z.string().uuid(),
    skillIds: z.array(z.string().uuid()).max(10).default([]),
    statement: z.string().trim().min(3).max(5000),
    type: z.enum(["numeric", "choice", "short", "essay"]),
    reference: z.string().trim().min(1).max(2000),
    options: z.array(z.string().min(1)).max(8).default([]),
    tolerance: z.number().min(0).max(1).default(0),
    hints: z.array(z.string().min(1).max(1000)).max(3).default([]),
  })
  .superRefine((q, c) => {
    if (
      q.type === "numeric" &&
      !Number.isFinite(Number(normalize(q.reference)))
    )
      c.addIssue({ code: "custom", message: "پاسخ مرجع عددی معتبر نیست" });
    if (
      q.type === "choice" &&
      (!q.options.includes(q.reference) || q.options.length < 2)
    )
      c.addIssue({ code: "custom", message: "پاسخ باید یکی از گزینه‌ها باشد" });
  });
export type QuestionInput = z.infer<typeof questionSchema>;
export function normalize(s: string) {
  return s
    .trim()
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
    .replace(/٫/g, ".");
}
export type Result = "correct" | "incorrect" | "pending_review";
export interface EvaluationResult {
  result: Result;
  method: string;
}
export type Evaluator = (
  question: QuestionInput,
  answer: string,
) => EvaluationResult;
const equality: Evaluator = (q, answer) => ({
  result:
    normalize(answer) === normalize(q.reference) ? "correct" : "incorrect",
  method: q.type === "short" ? "rule_based" : "deterministic",
});
export const evaluators: Record<QuestionInput["type"], Evaluator> = {
  numeric: (q, answer) => {
    const value = normalize(answer);
    return {
      result:
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Math.abs(Number(value) - Number(normalize(q.reference))) <= q.tolerance
          ? "correct"
          : "incorrect",
      method: "deterministic",
    };
  },
  choice: equality,
  short: equality,
  essay: () => ({ result: "pending_review", method: "human_required" }),
};
export function evaluate(
  q: QuestionInput,
  answer: string,
  registry = evaluators,
): EvaluationResult {
  return registry[q.type](q, answer);
}
export interface HintProvider {
  name: string;
  hint(input: { approvedHint: string; level: number }): Promise<string>;
}
export class MockProvider implements HintProvider {
  name = "mock-approved-hints";
  async hint(input: { approvedHint: string }) {
    return input.approvedHint;
  }
}
export const policySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  maxHints: z.number().int().min(0).max(3),
  independent: z.boolean(),
});
