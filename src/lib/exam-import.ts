import { questionVisualsSchema } from "./question-visuals";
import { z } from "zod";
import { questionSourceSchema } from "./question-source";
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const examImportSchema = z.object({
  title: z.string().trim().min(3).max(150),
  subject: z.string().trim().min(1).max(150),
  grade: z.string().trim().max(100).optional(),
  track: z.string().trim().max(100).optional(),
  year: z.number().int().min(1300).max(1500).optional(),
  source: questionSourceSchema,
  ocrLanguage: z.enum(["fas", "eng", "fas+eng"]).default("fas"),
});
export const examDraftSchema = z.object({
  statement: z.string().trim().min(3).max(5000),
  reference: z.string().max(2000),
  type: z.enum(["essay", "numeric", "choice", "short"]),
  options: z.array(z.string().max(2000)).max(8).default([]),
  hints: z.array(z.string().max(1000)).max(3).default([]),
  classification: z.enum(["topic", "free"]).optional(),
  topicId: z.string().uuid().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  visuals: questionVisualsSchema.optional(),
});
export type ExamMetadata = z.infer<typeof examImportSchema>;
export interface ExamFile {
  id?: string;
  name: string;
  size: number;
  sha256: string;
}
export interface ExamImport extends ExamMetadata {
  _id: string;
  state: "collecting" | "processing" | "failed" | "review";
  revision: number;
  createdAt: string;
  files?: { question?: ExamFile; answer?: ExamFile };
  questionText?: string;
  answerText?: string;
  extractionNotice?: string;
  sourceExpiresAt?: string;
  sourceDeletedAt?: string;
  job?: {
    _id: string;
    state: string;
    stage: string;
    attempts: number;
    processedPage?: number;
    errorMessage?: string;
  };
  statistics?: {
    pages: number;
    answerPages: number;
    questions: number;
    fourOptions: number;
    keys: number;
    matched: number;
    needsReview: number;
    unmatchedKeys: unknown[];
    keyWarnings: string[];
  };
}
export interface ExamImportItem {
  _id: string;
  examId: string;
  state: "pending" | "approved" | "rejected";
  question: {
    statement: string;
    reference: string;
    type: string;
    options: string[];
    hints: string[];
    topicId?: string;
    classification?: "free" | "topic";
    difficulty?: "easy" | "medium" | "hard";
    visuals?: import("./question-visuals").QuestionVisual[];
  };
  extraction?: {
    regions: {
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
    method: string;
    confidence: number | null;
    warnings: string[];
    answerMatch: {
      status: string;
      option: number | null;
      matches: { page: number; number: number; option: number }[];
      warnings: string[];
    };
  };
  deferred?: boolean;
  updatedAt?: string;
  originalNumber?: number | null;
  questionVersionId?: string;
}
// Conservative suggestions only: page layout, numbering and scientific meaning need review.
export function splitExamText(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?=^\s*[0-9۰-۹٠-٩]{1,3}\s*[.)\-–ـ:،]\s*\S)/m)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts
    .filter((s) => s.length >= 3)
    .slice(0, 100)
    .map((s) => s.slice(0, 5000));
}
