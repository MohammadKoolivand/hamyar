import { questionSourceSchema } from "../lib/question-source";
import { questionVisualsSchema, visualKind } from "../lib/question-visuals";
import { mathMarkup } from "../lib/math-render";
import { z } from "zod";
import { numericValue } from "./evaluation/numeric";

export type { Result, EvaluationResult } from "./evaluation/types";
export const questionSchema = z
  .object({
    topicId: z.string().uuid().optional(),
    classification: z.enum(["topic", "free"]).optional(),
    source: questionSourceSchema.optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    year: z.number().int().min(1300).max(1500).optional(),
    skillIds: z.array(z.string().uuid()).max(10).default([]),
    statement: z.string().trim().min(3).max(5000),
    visuals: questionVisualsSchema.optional(),
    visualKind: visualKind.optional(),
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
    if (q.classification !== "free" && !q.topicId)
      c.addIssue({ code: "custom", message: "مبحث را انتخاب کنید" });
    if (q.classification === "free" && (q.topicId || q.skillIds.length))
      c.addIssue({
        code: "custom",
        message: "سؤال آزاد نباید مبحث یا مهارت داشته باشد",
      });
    if (
      q.visualKind &&
      q.visualKind !== "none" &&
      !q.visuals?.some((v) => v.kind === q.visualKind)
    )
      c.addIssue({
        code: "custom",
        message:
          "محتوای تصویری درخواست‌شده وجود ندارد؛ نمودار، شکل یا فرمول را اضافه کنید",
      });
    for (const v of q.visuals ?? [])
      if (v.kind === "formula") {
        try {
          mathMarkup(v.latex);
        } catch {
          c.addIssue({ code: "custom", message: "فرمول LaTeX معتبر نیست" });
        }
      }

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
