import { examCatalog, detailedExamCatalog, mockExamProviders, type ExamCatalogEntry } from "./exam-catalog";
import type { PublicBankQuestion } from "./public-bank";

/** Only released questions contribute to public exam availability. */
export type CatalogPublicQuestion = PublicBankQuestion & { catalogIds?: string[] };
export type CatalogCoverageRecord = { categoryId: string; expectedQuestionCount: number };
export type CatalogAvailability = "complete" | "partial" | "empty";
export type CatalogStatus = { count: number; status: CatalogAvailability };

const catalogIds = new Set([...examCatalog, ...detailedExamCatalog].map((item) => item.id));
const gradeNames: Record<number, string> = {
  7: "هفتم", 8: "هشتم", 9: "نهم", 10: "دهم", 11: "یازدهم", 12: "دوازدهم",
};
function normalizedNumber(value: string | number | undefined) {
  const text = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  return Number(text.match(/1[34]\d{2}/)?.[0] ?? text);
}
function questionGrade(q: CatalogPublicQuestion) {
  const value = String(q.source?.grade ?? q.taxonomy?.grade ?? "");
  const number = normalizedNumber(value);
  if (Number.isInteger(number) && number >= 7 && number <= 12) return number;
  const match = Object.entries(gradeNames).find(([, name]) => value.includes(name));
  return match ? Number(match[0]) : undefined;
}
function questionTrack(q: CatalogPublicQuestion) {
  const text = q.source?.track ?? "";
  if (q.source?.group === "mathematics" || /ریاضی/.test(text)) return "mathematics";
  if (q.source?.group === "experimental" || /تجربی/.test(text)) return "experimental";
  return undefined;
}
function normalizeSource(value: string): string {
  return value.replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/\s+/g, " ").toLowerCase();
}
/** Organizer aliases: never attribute a question to an organizer on a vague match. */
export function mockProviderId(organizer: string): string | undefined {
  const name = normalizeSource(organizer);
  if (!name) return undefined;
  if (/قلم.?چی|کانون/.test(name) || /ghalamchi|kanoon/.test(name)) return "ghalamchi";
  if (/گزینه.?دو|گزینه.?2|gozine/.test(name)) return "gozine2";
  if (/خیلی.?سبز|kheylisabz/.test(name)) return "kheylisabz";
  if (/مدارس.?برتر/.test(name)) return "madaresbartar";
  if (/تاملند|tamland/.test(name)) return "tamland";
  if (/ماراتون|marathon/.test(name)) return "marathon";
  if (/زیستاز|zistaz/.test(name)) return "zistaz";
  if (/آرمان|arman/.test(name)) return "arman";
  if (/اپکس|apex/.test(name)) return "apex";
  if (/سنجش|sanjesh/.test(name)) return "sanjesh";
  if (/گاج|gaj/.test(name)) return "gaj";
  if (/ماز|maz/.test(name)) return "maz";
  return mockExamProviders.find((provider) => name === normalizeSource(provider.name))?.id;
}
function declaredYear(q: CatalogPublicQuestion): number | undefined {
  const year = normalizedNumber(q.source?.academicYear ?? q.year);
  return Number.isInteger(year) && year >= 1402 && year <= 1405 ? year : undefined;
}
function mockYearlyId(q: CatalogPublicQuestion) {
  const source = q.source;
  if (source?.family !== "mock") return undefined;
  const provider = mockProviderId(source.organizer || source.sourceTitle || "");
  const year = declaredYear(q);
  const grade = questionGrade(q);
  const track = questionTrack(q);
  if (!provider || !year || !grade || grade < 10 || !track) return undefined;
  const id = `mock-${provider}-${year}-${grade}-${track}`;
  return catalogIds.has(id) ? id : undefined;
}
function knownIds(ids: string[]) {
  return [...new Set(ids.filter((id) => catalogIds.has(id)))];
}
/**
 * Catalog tags supplied during exam import are authoritative.
 * For older questions without tags, infer only categories supported by
 * explicit public source metadata. Never infer that an exam is complete.
 */
export function publicQuestionCatalogIds(q: CatalogPublicQuestion): string[] {
  const tags = knownIds(q.catalogIds ?? []);
  const source = q.source;
  const yearlyMock = mockYearlyId(q);
  if (yearlyMock && !tags.includes(yearlyMock)) tags.push(yearlyMock);
  if (q.catalogIds?.length) return tags;
  if (!source) return [];
  const grade = questionGrade(q);
  const track = questionTrack(q);
  const ids: string[] = [];
  if (source.family === "konkur") {
    const year = normalizedNumber(q.year ?? source.academicYear);
    if ((year === 1404 || year === 1405) && source.group && track) {
      ids.push(`konkur-${year}-${track}-general`);
      if (year === 1404) {
        if (/اول|first|اردیبهشت/i.test(source.session ?? "")) ids.push(`konkur-${year}-${track}-first`);
        if (/دوم|second|تیر/i.test(source.session ?? "")) ids.push(`konkur-${year}-${track}-second`);
      }
      if (source.location) ids.push(`konkur-${year}-${track}-${source.location}`);
    }
  } else if (source.family === "school" && grade) {
    if (source.administration === "internal" && source.schoolStage)
      ids.push(`school-${grade}-${source.schoolStage}`);
    if (grade >= 10 && track) {
      if (source.administration === "final") ids.push(`final-${grade}-${track}`);
      else if (source.administration === "internal") ids.push(`school-${grade}-${track}`);
    }
    if (grade === 9 && ["district", "province", "national"].includes(source.administration ?? ""))
      ids.push(`coordinated-9-${source.administration}`);
  } else if (source.family === "admission") {
    if (source.admission === "sampad7") ids.push("admission-sampad-7");
    if (source.admission === "sampad10") ids.push("admission-sampad-10");
    if (source.admission === "nemune10") ids.push("admission-nemune-10");
  } else if (source.family === "practice" && grade) {
    if (source.practice === "textbook" || source.practice === "teacher")
      ids.push(`practice-${grade}-${source.practice}`);
  } else if (source.family === "mock" && track) {
    const stage = source.stage ?? "";
    if (/جامع|comprehensive/i.test(stage)) ids.push(`mock-${track}-comprehensive`);
    if (/مبحث|topic/i.test(stage)) ids.push(`mock-${track}-topic`);
    if (/دوره|ماهانه|monthly/i.test(stage)) ids.push(`mock-${track}-monthly`);
  } else if (source.family === "olympiad") {
    const subject = source.subject ?? "";
    for (const [pattern, id] of [
      [/ریاضی|math/i, "math"], [/فیزیک|physics/i, "physics"],
      [/شیمی|chemistry/i, "chemistry"], [/زیست|biology/i, "biology"],
      [/کامپیوتر|computer/i, "computer"],
    ] as const) if (pattern.test(subject)) ids.push(`olympiad-${id}`);
  }
  const legacyIds = knownIds(ids);
  const year = declaredYear(q);
  if (year) {
    for (const id of legacyIds) {
      if (id.startsWith("konkur-")) continue;
      const yearly = `${id}-${year}`;
      if (catalogIds.has(yearly)) legacyIds.push(yearly);
    }
  }
  return [...new Set([...tags, ...legacyIds])];
}
/** Publicly visible individual exam sessions are never invented:
 * an event appears only after at least one verified public question names
 * its date, stage or a specific source title. */
export type PublicExamEvent = {
  id: string;
  parentId: string;
  label: string;
  questionIds: string[];
};
function fingerprint(value: string): string {
  let code = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    code ^= value.charCodeAt(index);
    code = Math.imul(code, 16777619);
  }
  return (code >>> 0).toString(16).padStart(8, "0");
}
export function publicExamEvents(questions: readonly CatalogPublicQuestion[]): PublicExamEvent[] {
  const records = new Map<string, PublicExamEvent>();
  for (const question of questions) {
    const source = question.source;
    if (!source || !(source.examDate || source.stage || source.sourceTitle)) continue;
    const parents = publicQuestionCatalogIds(question).filter((id) =>
      detailedExamCatalog.some((entry) => entry.id === id && entry.section === "mock"));
    for (const parentId of parents) {
      const detail = [source.examDate ?? "", source.stage ?? "", source.sourceTitle ?? ""].join("|");
      const id = `event-${parentId}-${fingerprint(detail)}`;
      const label = [source.examDate, source.stage, source.sourceTitle].filter(Boolean).join(" · ");
      const existing = records.get(id);
      if (existing) { if (!existing.questionIds.includes(question._id)) existing.questionIds.push(question._id); }
      else records.set(id, { id, parentId, label, questionIds: [question._id] });
    }
  }
  return [...records.values()].sort((a, b) => a.label.localeCompare(b.label, "fa"));
}
/**
 * A checkmark requires an administrator-certified expected count AND enough
 * unique currently public questions. Any lesser count is only partial.
 */
export function catalogStatuses(
  questions: readonly CatalogPublicQuestion[],
  certifications: readonly CatalogCoverageRecord[] = [],
): Map<ExamCatalogEntry["id"], CatalogStatus> {
  const byCategory = new Map<string, Set<string>>();
  for (const q of questions) {
    for (const id of publicQuestionCatalogIds(q)) {
      const bucket = byCategory.get(id) ?? new Set<string>();
      bucket.add(q._id);
      byCategory.set(id, bucket);
    }
  }
  const certified = new Map(certifications.map((row) => [row.categoryId, row.expectedQuestionCount]));
  return new Map<string, CatalogStatus>([...examCatalog, ...detailedExamCatalog].map((entry): [string, CatalogStatus] => {
    const count = byCategory.get(entry.id)?.size ?? 0;
    const target = certified.get(entry.id);
    const status: CatalogAvailability = count === 0
      ? "empty"
      : Number.isSafeInteger(target) && target! > 0 && count >= target!
        ? "complete" : "partial";
    return [entry.id, { count, status }];
  }));
}
