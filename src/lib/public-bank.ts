import type { Question } from "./types";
import { sourceCategory, sourceFields } from "./question-source";

export const taxonomyKeys = [
  "level",
  "grade",
  "book",
  "chapter",
  "topic",
] as const;
export type BankTaxonomy = Record<(typeof taxonomyKeys)[number], string>;
export type PublicBankQuestion = Pick<
  Question,
  | "_id"
  | "statement"
  | "type"
  | "options"
  | "visuals"
  | "visualLayout"
  | "source"
  | "year"
  | "difficultyScore"
  | "difficulty"
> & { taxonomy: BankTaxonomy };
export type BankFilters = BankTaxonomy & {
  category: string;
  difficulty: string;
  content: string;
  extra: Record<string, string>;
};
export const emptyBankFilters = (): BankFilters => ({
  level: "",
  grade: "",
  book: "",
  chapter: "",
  topic: "",
  category: "",
  difficulty: "",
  content: "questions",
  extra: {},
});
export function parseBankFilters(search: string): BankFilters {
  const p = new URLSearchParams(search),
    f = emptyBankFilters();
  for (const key of [...taxonomyKeys, "category", "difficulty"] as const)
    f[key] = (p.get(key) ?? "").slice(0, 200);
  f.content = p.get("content") === "exams" ? "exams" : "questions";
  for (const field of sourceFields.filter((field) =>
    field.categories.includes(f.category),
  )) {
    const value = p.get(`source_${field.key}`);
    if (value) f.extra[field.key] = value.slice(0, 200);
  }
  if (p.get("year")) f.extra.year = p.get("year")!.slice(0, 30);
  return f;
}
export function bankFilterSearch(f: BankFilters) {
  const p = new URLSearchParams();
  for (const key of [...taxonomyKeys, "category", "difficulty"] as const)
    if (f[key]) p.set(key, f[key]);
  if (f.content === "exams") p.set("content", "exams");
  for (const [key, value] of Object.entries(f.extra))
    if (value) p.set(key === "year" ? "year" : `source_${key}`, value);
  return p.toString();
}
export function bankDifficulty(q: PublicBankQuestion) {
  if (typeof q.difficultyScore === "number")
    return q.difficultyScore <= 33
      ? "easy"
      : q.difficultyScore <= 66
        ? "medium"
        : "hard";
  return q.difficulty ?? "unset";
}
export function bankSourceValue(q: PublicBankQuestion, key: string): string {
  return String(
    key === "year"
      ? (q.source?.academicYear ?? q.year ?? "")
      : (q.source?.[key as keyof NonNullable<Question["source"]>] ?? ""),
  );
}
export function matchesBankQuestion(q: PublicBankQuestion, f: BankFilters) {
  if (taxonomyKeys.some((key) => f[key] && q.taxonomy?.[key] !== f[key]))
    return false;
  if (f.category && sourceCategory(q.source) !== f.category) return false;
  if (f.difficulty && bankDifficulty(q) !== f.difficulty) return false;
  return Object.entries(f.extra).every(
    ([key, value]) => !value || bankSourceValue(q, key) === value,
  );
}
export function bankExamKey(q: PublicBankQuestion) {
  const s = q.source;
  if (!s || ["practice", "unknown"].includes(sourceCategory(s))) return "";
  return JSON.stringify([
    sourceCategory(s),
    s.sourceTitle,
    s.academicYear ?? q.year,
    s.group,
    s.location,
    s.session,
    s.bookletCode,
    s.examDate,
    s.schoolStage,
    s.organizer,
    s.subject,
  ]);
}
