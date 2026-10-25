import { z } from "zod";
export const questionSourceSchema = z
  .object({
    family: z.enum([
      "konkur",
      "school",
      "admission",
      "mock",
      "olympiad",
      "practice",
    ]),
    administration: z
      .enum(["internal", "final", "district", "province", "national"])
      .optional(),
    schoolStage: z
      .enum([
        "continuous",
        "chapter",
        "mid_first",
        "end_first",
        "mid_second",
        "end_second",
        "remedial",
        "other",
      ])
      .optional(),
    group: z
      .enum(["mathematics", "experimental", "humanities", "art", "languages"])
      .optional(),
    location: z.enum(["domestic", "international"]).optional(),
    session: z.string().trim().min(1).max(100).optional(),
    admission: z.enum(["sampad7", "sampad10", "nemune10", "other"]).optional(),
    practice: z.enum(["textbook", "teacher", "ai", "other"]).optional(),
    organizer: z.string().trim().min(1).max(150).optional(),
    subject: z.string().trim().min(1).max(150).optional(),
    academicYear: z.string().trim().min(1).max(30).optional(),
    stage: z.string().trim().min(1).max(100).optional(),
    bookletCode: z.string().trim().min(1).max(80).optional(),
    questionNumber: z.number().int().min(1).max(10000).optional(),
    sourceTitle: z.string().trim().min(1).max(200).optional(),
    examDate: z
      .string()
      .regex(
        /^1[34]\d{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/,
        "تاریخ آزمون را به صورت 1405/08/01 وارد کنید",
      )
      .optional(),
    publishedDate: z.iso.date().optional(),
    sourcePage: z.number().int().min(1).max(10000).optional(),
    sourcePageUrl: z
      .url()
      .max(1500)
      .refine(
        (v) => /^https?:\/\//i.test(v),
        "نشانی صفحه منبع باید http یا https باشد",
      )
      .optional(),
    sourceUrl: z
      .url()
      .max(1500)
      .refine(
        (v) => /^https?:\/\//i.test(v),
        "نشانی منبع باید http یا https باشد",
      )
      .optional(),
  })
  .superRefine((s, c) => {
    const issue = (message: string) => c.addIssue({ code: "custom", message });
    if (s.family === "school" && !s.administration)
      issue("نوع برگزاری امتحان را مشخص کنید");
    if (s.family !== "school" && (s.administration || s.schoolStage))
      issue("نوع برگزاری و نوبت مدرسه فقط برای امتحانات مدرسه‌ای است");
    if (s.schoolStage && s.administration !== "internal")
      issue("ارزشیابی مدرسه‌ای را فقط برای امتحان داخلی انتخاب کنید");
    if (s.family !== "konkur" && (s.group || s.location))
      issue("گروه و محل کنکور با دسته انتخابی سازگار نیست");
    if (s.family !== "admission" && s.admission)
      issue("مسیر ورودی با دسته انتخابی سازگار نیست");
    if (s.family !== "practice" && s.practice)
      issue("نوع تألیف با دسته انتخابی سازگار نیست");
  });
export type QuestionSource = z.infer<typeof questionSourceSchema>;
export const sourceCategories = [
  { id: "konkur", label: "کنکور" },
  { id: "final", label: "امتحان نهایی" },
  { id: "school", label: "امتحان مدرسه‌ای" },
  { id: "coordinated", label: "امتحان هماهنگ" },
  { id: "admission", label: "ورودی مدارس" },
  { id: "mock", label: "آزمون آزمایشی" },
  { id: "olympiad", label: "المپیاد" },
  { id: "practice", label: "تمرین و تألیف" },
] as const;
export function sourceCategory(s?: QuestionSource): string {
  if (!s) return "unknown";
  if (s.family !== "school") return s.family;
  if (s.administration === "final") return "final";
  return s.administration === "internal" ? "school" : "coordinated";
}
export function initialSource(id: string): QuestionSource | undefined {
  if (id === "final") return { family: "school", administration: "final" };
  if (id === "school") return { family: "school", administration: "internal" };
  if (id === "coordinated")
    return { family: "school", administration: "district" };
  if (["konkur", "admission", "mock", "olympiad", "practice"].includes(id))
    return { family: id as QuestionSource["family"] };
}
export const sourceFields: {
  key: keyof QuestionSource;
  label: string;
  categories: string[];
  options?: [string, string][];
  placeholder?: string;
}[] = [
  {
    key: "group",
    label: "گروه کنکور",
    categories: ["konkur"],
    options: [
      ["mathematics", "ریاضی و فنی"],
      ["experimental", "علوم تجربی"],
      ["humanities", "علوم انسانی"],
      ["art", "هنر"],
      ["languages", "زبان‌های خارجی"],
    ],
  },
  {
    key: "location",
    label: "محل برگزاری کنکور",
    categories: ["konkur"],
    options: [
      ["domestic", "داخل کشور"],
      ["international", "خارج کشور"],
    ],
  },
  {
    key: "schoolStage",
    label: "نوبت ارزشیابی مدرسه",
    categories: ["school"],
    options: [
      ["continuous", "کلاسی / مستمر"],
      ["chapter", "فصلی"],
      ["mid_first", "میان‌نوبت اول"],
      ["end_first", "پایان‌نوبت اول"],
      ["mid_second", "میان‌نوبت دوم"],
      ["end_second", "پایان‌نوبت دوم"],
      ["remedial", "جبرانی"],
      ["other", "سایر / عملکردی / کاربرگ"],
    ],
  },
  {
    key: "administration",
    label: "سطح آزمون هماهنگ",
    categories: ["coordinated"],
    options: [
      ["district", "منطقه‌ای"],
      ["province", "استانی"],
      ["national", "کشوری"],
    ],
  },
  {
    key: "admission",
    label: "مسیر ورودی مدرسه",
    categories: ["admission"],
    options: [
      ["sampad7", "سمپاد هفتم"],
      ["sampad10", "سمپاد دهم / تکمیل ظرفیت"],
      ["nemune10", "نمونه دولتی دهم"],
      ["other", "سایر"],
    ],
  },
  {
    key: "practice",
    label: "نوع تمرین و تألیف",
    categories: ["practice"],
    options: [
      ["textbook", "کتاب درسی"],
      ["teacher", "تألیف معلم"],
      ["ai", "تولید AI با تأیید معلم"],
      ["other", "سایر"],
    ],
  },
  {
    key: "session",
    label: "نوبت آزمون",
    categories: ["final", "konkur"],
    placeholder: "مثلاً خرداد، شهریور، دی یا نوبت اول",
  },
  {
    key: "organizer",
    label: "برگزارکننده",
    categories: [
      "mock",
      "school",
      "final",
      "coordinated",
      "admission",
      "olympiad",
      "konkur",
    ],
    placeholder: "مثلاً مدرسه، کانون یا آموزش‌وپرورش",
  },
  {
    key: "subject",
    label: "رشته المپیاد",
    categories: ["olympiad"],
    placeholder: "مثلاً ریاضی یا فیزیک",
  },
  {
    key: "stage",
    label: "مرحله / تاریخ آزمون",
    categories: ["mock", "olympiad", "admission"],
    placeholder: "مثلاً مرحله دوم یا ۱۴۰۵/۰۸/۰۱",
  },
  {
    key: "academicYear",
    label: "سال تحصیلی",
    categories: ["mock", "school", "coordinated", "final"],
    placeholder: "۱۴۰۵–۱۴۰۶",
  },
];
export function sourceSummary(s?: QuestionSource) {
  const category = sourceCategory(s);
  if (!s) return "دسته‌بندی نشده";
  const title =
    sourceCategories.find((c) => c.id === category)?.label ?? "دسته‌بندی نشده";
  const details = sourceFields
    .filter((f) => f.categories.includes(category))
    .flatMap((f) => {
      const value = s[f.key];
      if (!value) return [];
      return [f.options?.find((o) => o[0] === value)?.[1] ?? String(value)];
    });
  return [title, ...details].join(" · ");
}
