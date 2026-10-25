import { z } from "zod";
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const difficultyLabels = { easy: "آسان", medium: "متوسط", hard: "سخت" };
export type Difficulty = z.infer<typeof difficultySchema>;
// A transparent initial estimate, never a calibrated measure or an AI claim.
export function estimateDifficulty(q: {
  statement: string;
  type?: string;
  skillIds?: string[];
  visuals?: unknown[];
}) {
  const text = q.statement;
  let score = 0;
  const reasons: string[] = [];
  if (
    /اثبات|استدلال|پارامتر|به.?ازای|چند مقدار|چند.*حالت|کمترین|بیشترین/.test(
      text,
    )
  ) {
    score += 2;
    reasons.push("استدلال، پارامتر یا بررسی چند حالت");
  }
  if (
    /مشتق|انتگرال|حد تابع|احتمال شرطی|ترکیب|لگاریتم|تابع وارون|ریشه مضاعف/.test(
      text,
    )
  ) {
    score += 2;
    reasons.push("مفهوم چندمرحله‌ای");
  }
  if (text.length > 300) {
    score++;
    reasons.push("صورت سؤال طولانی");
  }
  if ((q.skillIds?.length ?? 0) > 1) {
    score++;
    reasons.push("ترکیب چند مهارت");
  }
  if (q.type === "essay" || q.type === "symbolic") {
    score++;
    reasons.push("نیاز به پاسخ تشریحی یا نمادین");
  }
  const incomplete =
    /در تصویر.*(آماده|آمده)|متن و چهار گزینه|تصویر اصل/.test(text) ||
    text.length < 35;
  const difficulty: Difficulty = incomplete
    ? "medium"
    : score >= 3
      ? "hard"
      : score > 0 || text.length > 130
        ? "medium"
        : "easy";
  return {
    difficulty,
    difficultyAssessment: {
      method: "heuristic_v1",
      needsReview: true,
      reason: incomplete
        ? "متن برای ارزیابی کافی نیست؛ متوسط موقت تا بررسی معلم"
        : reasons.join("؛ ") || "صورت سؤال کوتاه و بدون نشانهٔ آشکار پیچیدگی",
    },
  };
}
export function difficultyMetadata(q: {
  difficulty?: Difficulty;
  statement: string;
  type?: string;
  skillIds?: string[];
  visuals?: unknown[];
}) {
  return q.difficulty
    ? {
        difficulty: q.difficulty,
        difficultyAssessment: {
          method: "teacher_selected",
          needsReview: false,
        },
      }
    : estimateDifficulty(q);
}
