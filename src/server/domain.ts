import { z } from "zod";
import { numericValue } from "./evaluation/numeric";

export type { Result, EvaluationResult } from "./evaluation/types";
export const questionSchema = z
  .object({
    topicId: z.string().uuid(),
    skillIds: z.array(z.string().uuid()).max(10).default([]),
    statement: z.string().trim().min(3).max(5000),
    type: z.enum(["numeric", "choice", "short", "essay", "symbolic"]),
    reference: z.string().trim().min(1).max(2000),
    options: z.array(z.string().min(1)).max(8).default([]),
    tolerance: z.number().min(0).max(1e9).default(0),
    relativeTolerance: z.number().min(0).max(1).optional(),
    mathContext: z
      .object({
        variables: z
          .array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,7}$/))
          .min(1)
          .max(3),
        domain: z.literal("real"),
        mode: z.enum(["expression", "equation"]),
      })
      .optional(),
    rubric: z
      .array(
        z.object({
          criterion: z.string().min(2).max(500),
          weight: z.number().positive().max(100),
        }),
      )
      .max(12)
      .optional(),
    hints: z.array(z.string().min(1).max(1000)).max(3).default([]),
    hintBank: z
      .array(
        z.object({
          level: z.number().int().min(1).max(3),
          text: z.string().min(1).max(1000),
        }),
      )
      .max(12)
      .optional(),
  })
  .superRefine((q, c) => {
    if (q.type === "symbolic" && !q.mathContext)
      c.addIssue({
        code: "custom",
        message: "دامنه و متغیرهای ریاضی را مشخص کنید",
      });
    if (q.type === "numeric" && numericValue(q.reference) === undefined)
      c.addIssue({ code: "custom", message: "پاسخ مرجع عددی معتبر نیست" });
    if (
      q.type === "choice" &&
      (!q.options.includes(q.reference) || q.options.length < 2)
    )
      c.addIssue({ code: "custom", message: "پاسخ باید یکی از گزینه‌ها باشد" });
  });
export type QuestionInput = z.infer<typeof questionSchema>;
export { normalize, numericValue } from "./evaluation/numeric";
export { evaluate, evaluators, type Evaluator } from "./evaluation";
import type { HintProvider } from "./ai/types";
export type { HintProvider } from "./ai/types";
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
  maxHintLevel: z.number().int().min(0).max(4).default(3),
  allowFullSolution: z.boolean().default(false),
});
