import { examCatalog, detailedExamCatalog, mockExamProviders, type ExamCatalogEntry } from "./exam-catalog";
import type { PublicBankQuestion } from "./public-bank";

/** Only released questions contribute to public exam availability. */
export type CatalogPublicQuestion = PublicBankQuestion & {
  catalogIds?: string[];
  publishedAt?: string | null;
  recommendationCount?: number;
};
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
  if (/دوپینگ.?ماز|maz.?doping/.test(name)) return "mazdoping";
  if (/پرمیوم.?ماز|maz.?premium/.test(name)) return "mazpremium";
  if (/زود.?بیست.?ماز|maz.?zoodbist/.test(name)) return "mazzoodbist";
  if (/شبه.?نهایی.?ماز|maz.?shabhe/.test(name)) return "mazshabhenahayi";
  if (/زیست.?پیشرفته/.test(name)) return "zistpishrafte";
  if (/آلفا|alpha/.test(name)) return "alpha";
  if (/آزما|azma/.test(name)) return "azma";
  if (/ماز|maz/.test(name)) return "maz";
  return mockExamProviders.find((provider) => name === normalizeSource(provider.name))?.id;
}
function declaredYear(q: CatalogPublicQuestion): number | undefined {
  const year = normalizedNumber(q.source?.academicYear ?? q.year);
  return Number.isInteger(year) && year >= 1398 && year <= 1405 ? year : undefined;
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
/** Treat detailed labels as parts of their parent exam so aggregate status
 * and the two university-admissions views count the same published questions. */
function expandKonkurTags(ids: readonly string[]): string[] {
  const result = new Set(ids);
  for (const id of ids) {
    const farhangian = /^konkur-farhangian-(14\d{2})-(mathematics|experimental)-(.+)$/.exec(id);
    if (farhangian) result.add(`konkur-farhangian-${farhangian[1]}-${farhangian[2]}-general`);
    const national = /^konkur-(1[34]\d{2})-(mathematics|experimental)-(.+)$/.exec(id);
    if (national) {
      const year = Number(national[1]), track = national[2], scope = national[3];
      const base = `konkur-${year}-${track}`;
      result.add(`${base}-general`);
      if (year >= 1392) result.add(`konkur-azad-${year}-${track}-shared`);
      for (const stage of ["first", "second", "old", "new"]) {
        if (scope === stage || scope.startsWith(`${stage}-`))
          result.add(`${base}-${stage}`);
      }
      if (scope === "domestic" || scope.endsWith("-domestic"))
        result.add(`${base}-domestic`);
      if (scope === "international" || scope.endsWith("-international"))
        result.add(`${base}-international`);
    }
    const azad = /^konkur-azad-(1[34]\d{2})-(mathematics|experimental)-(.+)$/.exec(id);
    if (azad) {
      if (azad[3] === "shared") result.add(`konkur-${azad[1]}-${azad[2]}-general`);
      else result.add(`konkur-azad-${azad[1]}-${azad[2]}-general`);
    }
  }
  return [...result].filter((id) => catalogIds.has(id));
}
function azadIndependent(source: NonNullable<CatalogPublicQuestion["source"]>, year: number) {
  if (year > 1391) return false;
  const text = [source.organizer, source.sourceTitle].join(" ");
  return /دانشگاه\s*آزاد|کنکور\s*آزاد|azad/i.test(text);
}
function historicalKonkurIds(question: CatalogPublicQuestion): string[] {
  const source = question.source;
  if (source?.family !== "konkur") return [];
  const year = normalizedNumber(question.year ?? source.academicYear);
  const track = questionTrack(question);
  if (year < 1390 || year > 1405 || !track) return [];
  const reference = [source.organizer, source.sourceTitle].join(" ");
  if (year >= 1403 && /فرهنگیان|دانشجو\s*معلم|تربیت\s*معلم|شهید\s*رجایی/i.test(reference)) {
    const base = `konkur-farhangian-${year}-${track}`;
    const values = [`${base}-general`];
    if (/دفترچه\s*اختصاصی|دفترچه\s*فرهنگیان|تربیت\s*معلم/i.test(
      [source.sourceTitle, source.bookletCode].join(" ")))
      values.push(`${base}-booklet`);
    return expandKonkurTags(values);
  }
  if (azadIndependent(source, year)) {
    const base = `konkur-azad-${year}-${track}`;
    const output = [`${base}-general`];
    if (/صبح|morning/i.test(source.session ?? "")) output.push(`${base}-morning`);
    if (/عصر|afternoon/i.test(source.session ?? "")) output.push(`${base}-afternoon`);
    return expandKonkurTags(output);
  }
  const base = `konkur-${year}-${track}`;
  const output = [`${base}-general`];
  if (source.location === "domestic" || source.location === "international")
    output.push(`${base}-${source.location}`);
  const session = source.session ?? "";
  const phase = year >= 1402 && year <= 1404
    ? /نوبت\s*اول|first|دی\s*۱۴۰۱|اردیبهشت/i.test(session) ? "first"
      : /نوبت\s*دوم|second|تیر/i.test(session) ? "second" : ""
    : "";
  if (phase) {
    output.push(`${base}-${phase}`);
    if (source.location) output.push(`${base}-${phase}-${source.location}`);
  }
  if (year === 1398 || year === 1399) {
    const system = [source.stage, source.session, source.sourceTitle].join(" ");
    const edition = /نظام\s*قدیم|old\s*system/i.test(system) ? "old"
      : /نظام\s*جدید|new\s*system/i.test(system) ? "new" : "";
    if (edition) {
      output.push(`${base}-${edition}`);
      if (source.location) output.push(`${base}-${edition}-${source.location}`);
    }
  }
  const booklet = [source.sourceTitle, source.bookletCode].join(" ");
  if (year <= 1401 && /دفترچه\s*عمومی|general\s*booklet/i.test(booklet))
    output.push(`${base}-booklet-general`);
  if (/دفترچه\s*اختصاصی|specific\s*booklet/i.test(booklet))
    output.push(`${base}-booklet-specific`);
  return expandKonkurTags(output);
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
  const nationalTags = source?.family === "konkur" ? historicalKonkurIds(q) : [];
  const yearlyMock = mockYearlyId(q);
  if (yearlyMock && !tags.includes(yearlyMock)) tags.push(yearlyMock);
  if (q.catalogIds?.length) return expandKonkurTags(tags);
  if (!source) return tags;
  const grade = questionGrade(q);
  const track = questionTrack(q);
  const ids: string[] = [];
  if (source.family === "konkur") {
    ids.push(...nationalTags);
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
