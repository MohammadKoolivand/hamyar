/** Stable category identifiers for the HodHod exam import registry.
 * This is a taxonomy of possible sources, NOT a repository of published exams.
 * It contains no third-party questions, answer keys or copied PDFs.
 */
export interface ExamCatalogEntry {
  id: string;
  section: "konkur" | "school" | "admission" | "mock" | "olympiad" | "practice";
  label: string;
  year?: number;
  grade?: string;
  track?: "mathematics" | "experimental";
  stage?: string;
  provider?: string;
  parentId?: string;
  catalogKind?: "year" | "event";
}
const gradeNames: Record<number, string> = {
  7: "هفتم", 8: "هشتم", 9: "نهم",
  10: "دهم", 11: "یازدهم", 12: "دوازدهم",
};
const groupNames = { mathematics: "ریاضی", experimental: "تجربی" } as const;
const grades = [7, 8, 9, 10, 11, 12] as const;
const higherGrades = [10, 11, 12] as const;
const tracks = ["mathematics", "experimental"] as const;
const sessionNames = { mid_first: "میان‌نوبت اول", end_first: "نوبت اول", mid_second: "میان‌نوبت دوم", end_second: "نوبت دوم", continuous: "مستمر", chapter: "آزمون فصلی", remedial: "جبرانی" } as const;
export const examCatalogSections = [
  { id: "konkur", label: "کنکور سراسری" },
  { id: "school", label: "آزمون و امتحان مدرسه‌ای" },
  { id: "admission", label: "آزمون ورودی مدارس" },
  { id: "mock", label: "آزمون آزمایشی" },
  { id: "olympiad", label: "المپیاد" },
  { id: "practice", label: "تمرین، کاربرگ و آزمون معلم" },
] as const;
export const examCatalog: readonly ExamCatalogEntry[] = [
  ...([1404, 1405] as const).flatMap((year) =>
    tracks.flatMap((track) =>
      (year === 1404 ? ["general", "first", "second", "domestic", "international"] as const : ["general", "domestic", "international"] as const).map((session) => ({
        id: `konkur-${year}-${track}-${session}`,
        section: "konkur" as const,
        label: `کنکور ${year} ${groupNames[track]} · ${({ general: "بدون تفکیک نوبت", first: "نوبت اول", second: "نوبت دوم", domestic: "داخل کشور", international: "خارج کشور" })[session]}`,
        year, track, stage: session,
      })),
    ),
  ),
  ...grades.flatMap((grade) =>
    (Object.entries(sessionNames) as [keyof typeof sessionNames, string][]).map(([stage, label]) => ({
      id: `school-${grade}-${stage}`,
      section: "school" as const,
      label: `پایه ${gradeNames[grade]} · ${label}`,
      grade: String(grade), stage,
    })),
  ),
  ...higherGrades.flatMap((grade) =>
    tracks.flatMap((track) => [
      { id: `school-${grade}-${track}`, section: "school" as const, label: `پایه ${gradeNames[grade]} · ${groupNames[track]}`, grade: String(grade), track },
      { id: `final-${grade}-${track}`, section: "school" as const, label: `امتحان نهایی پایه ${gradeNames[grade]} · ${groupNames[track]}`, grade: String(grade), track, stage: "final" },
    ]),
  ),
  ...(["district", "province", "national"] as const).map((scope) => ({
    id: `coordinated-9-${scope}`, section: "school" as const,
    label: `هماهنگ پایه نهم · ${({ district: "منطقه‌ای", province: "استانی", national: "کشوری" })[scope]}`,
    grade: "9", stage: scope,
  })),
  { id: "admission-sampad-7", section: "admission", label: "ورودی سمپاد هفتم", grade: "7" },
  { id: "admission-sampad-10", section: "admission", label: "ورودی سمپاد دهم", grade: "10" },
  { id: "admission-nemune-10", section: "admission", label: "ورودی نمونه دولتی دهم", grade: "10" },
  ...tracks.flatMap((track) =>
    ["comprehensive", "topic", "monthly"].map((stage) => ({
      id: `mock-${track}-${stage}`, section: "mock" as const,
      label: `آزمون آزمایشی ${groupNames[track]} · ${({ comprehensive: "جامع", topic: "مبحثی", monthly: "دوره‌ای" })[stage as "comprehensive" | "topic" | "monthly"]}`,
      track, stage,
    })),
  ),
  ...(["math", "physics", "chemistry", "biology", "computer"] as const).map((subject) => ({
    id: `olympiad-${subject}`, section: "olympiad" as const,
    label: `المپیاد ${({ math: "ریاضی", physics: "فیزیک", chemistry: "شیمی", biology: "زیست‌شناسی", computer: "کامپیوتر" })[subject]}`,
  })),
  ...grades.flatMap((grade) => ["textbook", "teacher", "worksheet", "quiz"].map((kind) => ({
    id: `practice-${grade}-${kind}`, section: "practice" as const,
    label: `پایه ${gradeNames[grade]} · ${({ textbook: "تمرین کتاب درسی", teacher: "سؤال تألیفی معلم", worksheet: "کاربرگ", quiz: "آزمونک" })[kind as "textbook" | "teacher" | "worksheet" | "quiz"]}`,
    grade: String(grade), stage: kind,
  }))),
];
/** Iranian exam series registry: catalog rows are upload slots, not claims of
 * actual exam occurrence. Named organizers are based on published schedules
 * and archives; event dates are only created from verified uploaded metadata. */
export const mockExamProviders = [
  { id: "ghalamchi", name: "قلم‌چی (کانون)" },
  { id: "maz", name: "ماز" },
  { id: "gozine2", name: "گزینه دو" },
  { id: "gaj", name: "گاج" },
  { id: "sanjesh", name: "سنجش (آزمایشی)" },
  { id: "kheylisabz", name: "خیلی سبز" },
  { id: "arman", name: "آرمان" },
  { id: "marathon", name: "ماراتون" },
  { id: "madaresbartar", name: "مدارس برتر" },
  { id: "tamland", name: "تاملند" },
  { id: "zistaz", name: "زیستاز" },
  { id: "apex", name: "اپکس" },
] as const;
export const examYears = [1405, 1404, 1403, 1402] as const;
const yearLabel = (year: number) => year.toLocaleString("fa-IR", { useGrouping: false });
/** All new rows, including school/admissions, carry an explicit Jalali year. */
export const detailedExamCatalog: readonly ExamCatalogEntry[] = [
  ...examCatalog.filter((item) => item.year !== undefined),
  ...examCatalog.filter((item) => item.year === undefined && item.section !== "mock")
    .flatMap((item) => examYears.map((year) => ({
      ...item, id: `${item.id}-${year}`, year, parentId: item.id,
      catalogKind: "year" as const,
      label: `${item.label} · سال ${yearLabel(year)}`,
    }))),
  ...mockExamProviders.flatMap((provider) =>
    examYears.flatMap((year) =>
      [10, 11, 12].flatMap((grade) =>
        tracks.map((track) => ({
          id: `mock-${provider.id}-${year}-${grade}-${track}`,
          section: "mock" as const,
          label: `${provider.name} · ${yearLabel(year)}–${yearLabel(year + 1)} · ${gradeNames[grade]} · ${groupNames[track]}`,
          year, grade: String(grade), track, provider: provider.id,
          catalogKind: "year" as const,
        })),
      ),
    ),
  ),
];
const registry = new Map([...examCatalog, ...detailedExamCatalog].map((item) => [item.id, item]));
export function examCatalogEntry(id: string) { return registry.get(id); }
/** Individual completed import events can also be certified by an administrator. */
export function validExamCoverageId(id: string): boolean {
  if (registry.has(id)) return true;
  const match = /^event-(mock-[a-z0-9]+-14\d{2}-(?:10|11|12)-(?:mathematics|experimental))-[a-f0-9]{8}$/.exec(id);
  return Boolean(match && registry.get(match[1]));
}
export function examCatalogValidIds(ids: readonly string[]): boolean {
  if (ids.length > 8 || new Set(ids).size !== ids.length) return false;
  const entries = ids.map((id) => registry.get(id));
  if (entries.some((entry) => !entry)) return false;
  const scoped = entries.filter((entry): entry is ExamCatalogEntry => Boolean(entry));
  if (!scoped.length) return true;
  const sameValue = (field: "section" | "grade" | "year" | "track") =>
    new Set(scoped.map((entry) => entry[field]).filter((value) => value !== undefined)).size <= 1;
  return (["section", "grade", "year", "track"] as const).every(sameValue);
}
