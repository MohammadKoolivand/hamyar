import { normalize, numericValue } from "../evaluation/numeric";
/** Bounded server gate, not a semantic proof. Unclassified raw AI prose stays private. */
export const HINT_SAFETY_VERSION = "hint-safety-v1";
const conceptual = new Set(
  [
    "مفهوم مرتبط را مرور کن.",
    "روش خود را دوباره بررسی کن.",
    "به شمارش ادامه بده.",
    "داده‌ها و خواسته مسئله را مشخص کن.",
    "واحد کمیت‌ها را بررسی کن.",
  ].map(canonical),
);
function canonical(s: string) {
  return normalize(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, "")
    .replace(/\p{M}/gu, "")
    .replace(/[\s\u200c]+/g, " ")
    .trim();
}
const numberWords: Record<string, number> = {
  صفر: 0,
  یک: 1,
  دو: 2,
  سه: 3,
  چهار: 4,
  پنج: 5,
  شش: 6,
  هفت: 7,
  هشت: 8,
  نه: 9,
  ده: 10,
  یازده: 11,
  دوازده: 12,
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
export type HintQuestion = {
  reference: string;
  type?: string;
  options?: string[];
};
export function assessHint(
  q: HintQuestion,
  text: string,
  rawAi = false,
): "clear" | "blocked" | "review" {
  const hint = canonical(text),
    reference = canonical(q.reference);
  if (!hint || hint.length > 2000) return "blocked";
  const words = hint.match(/[\p{L}\p{N}.+-]+/gu) ?? [];
  const value = numericValue(reference);
  if (
    value !== undefined &&
    words.some((w) => numericValue(w) === value || numberWords[w] === value) &&
    (rawAi ||
      words.length <= 2 ||
      /(?:پاسخ|جواب|حاصل|نتیجه|برابر|answer|result|equals|=)/u.test(hint))
  )
    return "blocked";
  // Reference text includes the correct choice's content, not only its index.
  if (
    reference &&
    (hint === reference ||
      (value === undefined &&
        reference.length >= 2 &&
        hint.includes(reference)))
  )
    return "blocked";
  if (
    q.type === "choice" &&
    /(?:گزینه|option|choice)\s*(?:صحیح\s*)?(?:اول|دوم|سوم|چهارم|[1-8]|[a-h])(?:\b|\s|[.،])/u.test(
      hint,
    )
  )
    return "blocked";
  // Never attempt to certify arbitrary equations, full solutions, off-topic prose or
  // semantic equivalents using regex. Raw AI outside this finite conceptual set
  // needs teacher rewriting/removal before it can enter a consumable hint bank.
  if (rawAi && !conceptual.has(hint)) return "review";
  return "clear";
}
export function hintTexts(q: {
  hints?: string[];
  hintBank?: { text: string }[];
}) {
  return [...(q.hints ?? []), ...(q.hintBank ?? []).map((h) => h.text)];
}
