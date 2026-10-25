import { z } from "zod";

export const examMetadataSchema = z.object({
  title: z.string().trim().min(3).max(150),
  kind: z.enum(["konkur", "final", "school", "coordinated", "mock"]),
  year: z.string().regex(/^1[34]\d{2}$/).optional(),
  session: z.string().trim().max(100).default(""),
  grade: z.enum(["7", "8", "9", "10", "11", "12"]),
  track: z.enum(["experimental", "mathematics", "humanities", "islamic", "common", "other"]),
  subject: z.string().trim().min(2).max(100),
  sourceUrl: z.union([z.literal(""), z.url().max(1500)]).default(""),
}).strict();
export type ExamMetadata = z.infer<typeof examMetadataSchema>;

export const extractedQuestionSchema = z.object({
  number: z.number().int().min(1).max(1000).nullable(),
  page: z.number().int().min(1).max(40),
  statement: z.string().trim().min(3).max(5000),
  confidence: z.enum(["medium", "low"]),
}).strict();
export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;

const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const arDigits = "٠١٢٣٤٥٦٧٨٩";
function toLatin(text: string) {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const index = faDigits.indexOf(d);
    return String(index >= 0 ? index : arDigits.indexOf(d));
  });
}
function head(line: string) {
  const match = toLatin(line).match(/^\s*(?:س[ؤو]ال\s*)?(\d{1,3})\s*[.\-–:)\u06d4]\s*(.*)$/iu);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 300) return null;
  return { number, body: match[2].trim() };
}
export function splitExamPages(pages: string[]): ExtractedQuestion[] {
  const result: ExtractedQuestion[] = [];
  let active: { number: number; page: number; lines: string[] } | null = null;
  const flush = () => {
    if (!active) return;
    const statement = active.lines.join("\n").trim().slice(0, 5000);
    if (statement.length >= 3) result.push({
      number: active.number, page: active.page, statement, confidence: "medium",
    });
    active = null;
  };
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i].trim().slice(0, 25000);
    for (const line of pageText.split(/\r?\n/).map((v) => v.trim()).filter(Boolean)) {
      const match = head(line);
      if (match && (!active || match.number > active.number || match.number === 1)) {
        flush();
        active = { number: match.number, page: i + 1, lines: match.body ? [match.body] : [] };
      } else if (active) {
        active.lines.push(line);
      }
    }
  }
  flush();
  if (result.length) return result.slice(0, 120);
  // A low-confidence page draft is preferable to inventing question boundaries.
  return pages.map((text, i) => ({
    number: null, page: i + 1,
    statement: text.trim().slice(0, 5000),
    confidence: "low" as const,
  })).filter((q) => q.statement.length >= 3).slice(0, 40);
}
