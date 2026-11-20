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
export type HomeSort = "source_order" | "newest" | "easiest" | "hardest" | "recommended";

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
  // The exam's declared group is authoritative. A physics/math lesson can be
  // shared by both groups and must never override «علوم تجربی» metadata.
  if (q.source?.group === "mathematics") return "ریاضی";
  if (q.source?.group === "experimental") return "تجربی";
  const track = q.source?.track?.trim() ?? "";
  if (/تجربی/.test(track)) return "تجربی";
  if (/ریاضی(?:\\s*(?:و\\s*)?فیزیک)?/.test(track)) return "ریاضی";
  // Legacy sources without an explicit group may encode it in the book name.
  // A bare «ریاضی» lesson is NOT sufficient to infer the math exam track.
  const context = [q.taxonomy?.book, q.source?.subject].filter(Boolean).join(" ");
  if (/علوم\\s*تجربی|رشته\\s*تجربی/.test(context)) return "تجربی";
  if (/ریاضی\\s*(?:و\\s*)?فیزیک|رشته\\s*ریاضی/.test(context)) return "ریاضی";
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

/**
 * The source identity identifies an actual sitting, not a lesson. In particular,
 * Konkur physics/chemistry questions must share a group with that exam's
 * mathematics/biology questions. School final exams, however, are per subject.
 * Ambiguous, unattributed questions stay separate instead of being falsely
 * treated as belonging to the same exam.
 */
export function homeExamGroupKey(q: CatalogPublicQuestion): string {
  const source = q.source;
  if (!source) return "unattributed:" + q._id;
  const category = sourceCategory(source);
  const year = homeQuestionYear(q);
  const title = source.sourceTitle?.trim() ?? "";
  const examDate = source.examDate ?? "";
  const session = source.session ?? "";
  const subject = category === "konkur" ? "" : (source.subject ?? homeQuestionTaxonomy(q, "book"));
  const identifiable = Boolean(
    title || examDate ||
    (category === "konkur" && year && (source.group || source.track) && session) ||
    (category === "final" && year && subject),
  );
  if (!identifiable) return "unattributed:" + q._id;
  return JSON.stringify([
    category, title.replace(/\\s+/g, " "), year,
    // A named exam's optional organizer/track fields can be missing in an
    // individual newly added question. They must not split one sitting.
    // The Konkur organizer is descriptive, not an exam identity. A missing
    // «سازمان سنجش» label must not split a known year/group/session sitting.
    // Other exam categories may genuinely use the organizer to distinguish exams.
    category === "konkur" ? "" : title ? "" : (source.organizer ?? ""),
    source.group ?? "", title ? "" : (source.track ?? ""),
    source.location ?? "", session, examDate,
    source.administration ?? "", source.schoolStage ?? "",
    subject, category === "final" ? homeQuestionTaxonomy(q, "grade") : "",
  ]);
}

function originalQuestionNumber(q: CatalogPublicQuestion): number | null {
  const number = q.source?.questionNumber;
  return typeof number === "number" && Number.isSafeInteger(number) && number > 0
    ? number : null;
}

/**
 * Some textbook/reference questions have an original question number but no
 * exam title/date. Keep their exam identities unattributed, yet display
 * numbered questions from the same lesson/grade in numeric source order,
 * instead of placing the most recently published item (e.g. 31) before 1.
 */
function homeSourceSortGroupKey(q: CatalogPublicQuestion): string {
  const examKey = homeExamGroupKey(q);
  if (!examKey.startsWith("unattributed:") || originalQuestionNumber(q) === null)
    return examKey;
  const book = homeQuestionTaxonomy(q, "book").trim();
  if (!book) return examKey;
  return JSON.stringify([
    "numbered-reference", sourceCategory(q.source), homeQuestionTrack(q),
    homeQuestionTaxonomy(q, "level"), homeQuestionTaxonomy(q, "grade"),
    book, homeQuestionYear(q), q.source?.practice ?? "",
  ]);
}

function sortBySourceOrder(items: CatalogPublicQuestion[]): CatalogPublicQuestion[] {
  const groups = new Map<string, CatalogPublicQuestion[]>();
  for (const question of items) {
    const key = homeSourceSortGroupKey(question);
    const group = groups.get(key) ?? [];
    group.push(question);
    groups.set(key, group);
  }
  // Keep separate exams together, with the most recently published exam first.
  const orderedGroups = [...groups.entries()].sort(([keyA, rowsA], [keyB, rowsB]) => {
    const newestA = Math.max(...rowsA.map(newest));
    const newestB = Math.max(...rowsB.map(newest));
    return newestB - newestA || keyA.localeCompare(keyB, "fa");
  });
  return orderedGroups.flatMap(([, rows]) => rows.sort((a, b) => {
    const numberA = originalQuestionNumber(a);
    const numberB = originalQuestionNumber(b);
    if (numberA !== null && numberB !== null && numberA !== numberB) return numberA - numberB;
    if (numberA === null && numberB !== null) return 1;
    if (numberB === null && numberA !== null) return -1;
    return newest(b) - newest(a) || a._id.localeCompare(b._id);
  }));
}

export function sortHomeQuestions(items: CatalogPublicQuestion[], order: HomeSort): CatalogPublicQuestion[] {
  if (order === "source_order") return sortBySourceOrder(items);
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
