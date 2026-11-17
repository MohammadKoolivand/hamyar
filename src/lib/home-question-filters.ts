import type { CatalogPublicQuestion } from "./exam-catalog-coverage";
import { sourceCategory } from "./question-source";

export type HomeFilterKey = "level" | "grade" | "book" | "chapter" | "topic";
export type HomeFilters = Record<HomeFilterKey, string> & {
  search: string;
  track: string;
  category: string;
  difficulty: string;
  yearFrom: string;
  yearTo: string;
};
export type HomeSort = "newest" | "easiest" | "hardest" | "recommended";

export const initialHomeFilters = (): HomeFilters => ({
  search: "", track: "", level: "", grade: "", book: "", chapter: "", topic: "",
  category: "", difficulty: "", yearFrom: "", yearTo: "",
});

const yearDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

export function homeQuestionYear(q: CatalogPublicQuestion): number | null {
  for (const raw of [q.year, q.source?.academicYear, q.source?.examDate]) {
    const value = yearDigits(String(raw ?? "")).match(/(?:13|14)\d{2}/)?.[0];
    if (value) return Number(value);
  }
  return null;
}

/** Show the lesson alone; the selected track is already a separate filter. */
export function homeBookName(value: string): string {
  const name = value.trim();
  // Delimited titles: «فیزیک - علوم تجربی» or «حسابان (ریاضی فیزیک)».
  const delimited = name.replace(
    /\s*(?:[-–—/|]\s*|[[(（]\s*)(?:رشته\s*)?(?:ریاضی(?:\s*(?:و\s*)?فیزیک)?|علوم\s*تجربی|تجربی)\s*[)）\]]?\s*$/u,
    "",
  ).trim();
  if (delimited && delimited !== name) return delimited;
  // Older records sometimes have a bare suffix: «فیزیک علوم تجربی».
  const bare = name.replace(/\s+(?:رشته\s*)?(?:علوم\s*تجربی|ریاضی\s*(?:و\s*)?فیزیک|ریاضی)\s*$/u, "").trim();
  return bare || name;
}

export function homeQuestionTrack(q: CatalogPublicQuestion): string {
  const text = [q.source?.track, q.taxonomy?.book, q.source?.subject].filter(Boolean).join(" ");
  if (q.source?.group === "mathematics" || /ریاضی(?:\s*فیزیک)?/.test(text)) return "ریاضی";
  if (q.source?.group === "experimental" || /تجربی/.test(text)) return "تجربی";
  return "";
}

export function homeQuestionTaxonomy(q: CatalogPublicQuestion, key: HomeFilterKey): string {
  if (key === "grade") return q.taxonomy?.grade || q.source?.grade || "";
  if (key === "level") {
    const level = q.taxonomy?.level || "";
    const grade = homeQuestionTaxonomy(q, "grade");
    return level || (/(?:دهم|یازدهم|دوازدهم|۱۰|۱۱|۱۲|10|11|12)/.test(grade) ? "متوسطه دوم" : "");
  }
  if (key === "book") return homeBookName(q.taxonomy?.book || q.source?.subject || "");
  return q.taxonomy?.[key] || "";
}

export function homeDifficultyScore(q: CatalogPublicQuestion): number | null {
  if (typeof q.difficultyScore === "number" && Number.isFinite(q.difficultyScore))
    return q.difficultyScore;
  if (q.difficulty === "easy") return 17;
  if (q.difficulty === "medium") return 50;
  if (q.difficulty === "hard") return 83;
  return null;
}

function homeDifficulty(q: CatalogPublicQuestion): string {
  const score = homeDifficultyScore(q);
  if (score === null) return "";
  return score <= 33 ? "easy" : score <= 66 ? "medium" : "hard";
}

export function matchesHomeQuestion(q: CatalogPublicQuestion, f: HomeFilters): boolean {
  const searchable = [
    q.statement, ...(["level", "grade", "book", "chapter", "topic"] as const)
      .map((key) => homeQuestionTaxonomy(q, key)),
    q.source?.sourceTitle, q.source?.organizer,
  ].join(" ").toLocaleLowerCase("fa");
  if (f.search.trim() && !searchable.includes(f.search.trim().toLocaleLowerCase("fa"))) return false;
  if (f.track && homeQuestionTrack(q) !== f.track) return false;
  if ((["level", "grade", "book", "chapter", "topic"] as const).some(
    (key) => f[key] && homeQuestionTaxonomy(q, key) !== f[key],
  )) return false;
  if (f.category === "konkur-azad") {
    const sourceText = [q.source?.organizer, q.source?.sourceTitle].join(" ");
    const explicitlyAzad = /دانشگاه\s*آزاد|کنکور\s*آزاد|azad/i.test(sourceText) ||
      (q.catalogIds ?? []).some((id) => /^konkur-azad-/.test(id));
    if (q.source?.family !== "konkur" || !explicitlyAzad) return false;
  } else if (f.category === "konkur") {
    const sourceText = [q.source?.organizer, q.source?.sourceTitle].join(" ");
    if (sourceCategory(q.source) !== "konkur" ||
      /دانشگاه\s*آزاد|کنکور\s*آزاد|azad/i.test(sourceText)) return false;
  } else if (f.category && sourceCategory(q.source) !== f.category) return false;
  if (f.difficulty === "unset" && homeDifficulty(q) !== "") return false;
  if (f.difficulty && f.difficulty !== "unset" && homeDifficulty(q) !== f.difficulty) return false;
  const year = homeQuestionYear(q);
  if (f.yearFrom && (year === null || year < Number(f.yearFrom))) return false;
  if (f.yearTo && (year === null || year > Number(f.yearTo))) return false;
  return true;
}

const newest = (q: CatalogPublicQuestion) => {
  const value = q.publishedAt ? Date.parse(String(q.publishedAt)) : NaN;
  return Number.isFinite(value) ? value : 0;
};

export function sortHomeQuestions(items: CatalogPublicQuestion[], order: HomeSort): CatalogPublicQuestion[] {
  return [...items].sort((a, b) => {
    if (order === "recommended") {
      const difference = (b.recommendationCount ?? 0) - (a.recommendationCount ?? 0);
      if (difference) return difference;
    }
    if (order === "easiest" || order === "hardest") {
      const left = homeDifficultyScore(a), right = homeDifficultyScore(b);
      if (left === null && right !== null) return 1;
      if (right === null && left !== null) return -1;
      if (left !== null && right !== null && left !== right)
        return order === "easiest" ? left - right : right - left;
    }
    return newest(b) - newest(a) || (homeQuestionYear(b) ?? 0) - (homeQuestionYear(a) ?? 0) ||
      a._id.localeCompare(b._id);
  });
}
