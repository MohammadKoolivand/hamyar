/** Display-only localization; never use this for persisted answers or IDs. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const index = code >= 0x0660 ? code - 0x0660 : code - 0x0030;
    return "۰۱۲۳۴۵۶۷۸۹"[index] ?? digit;
  });
}

export const fa = (n: number) => n.toLocaleString("fa-IR");
export const stateLabel: Record<string, string> = {
  published: "آماده تمرین",
  in_progress: "در حال انجام",
  submitted: "در انتظار بررسی",
  completed: "تکمیل‌شده",
  draft: "پیش‌نویس",
  cancelled: "لغوشده",
  correct: "صحیح",
  incorrect: "نیازمند اصلاح",
  pending_review: "نیازمند بررسی معلم",
  uncertain: "ارزیابی نامطمئن",
  partially_correct: "تاحدی صحیح",
};
