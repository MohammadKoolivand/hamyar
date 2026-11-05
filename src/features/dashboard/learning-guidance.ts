/** Evidence-based next action; never interprets missing evidence as failure. */
export interface GuidanceSkill {
  skillId?: string;
  title: string;
  status: string;
  incorrect: number;
  supportingAttempts?: number;
  independentFirstAttempts?: number;
}
export interface Guidance {
  kind: "review" | "develop" | "check" | "continue";
  title: string;
  description: string;
  destination: "student-mistakes" | "student-practice" | "student-progress";
  skill?: GuidanceSkill;
}

export function nextLearningGuidance(skills: GuidanceSkill[], hasOpenPractice: boolean): Guidance {
  const ranked = [...skills].sort((a, b) => {
    const weight = (s: GuidanceSkill) =>
      s.status === "needs_practice" || s.status === "needs_review" ? 3 :
      s.status === "developing" ? 2 :
      s.status === "insufficient_evidence" || s.status === "not_started" ? 1 : 0;
    return weight(b) - weight(a) ||
      (weight(b) === 3 ? b.incorrect - a.incorrect : 0) ||
      a.title.localeCompare(b.title, "fa");
  });
  const priority = ranked[0];
  if (priority && ["needs_practice", "needs_review"].includes(priority.status)) {
    return {
      kind: "review", skill: priority,
      title: `یک قدم برای مرور «${priority.title}»`,
      description: `${priority.incorrect.toLocaleString("fa-IR")} پاسخ نادرست ثبت شده؛ اشتباهات قابل‌نمایش را مرور کن و سپس یک سؤال تازه را بدون راهنما حل کن. این یک پیشنهاد بر پایهٔ شواهد است، نه قضاوت قطعی دربارهٔ تسلط.`,
      destination: "student-mistakes",
    };
  }
  if (priority?.status === "developing") return {
    kind: "develop", skill: priority,
    title: `تمرین بعدی در «${priority.title}»`,
    description: "برای بررسی پایداری یادگیری، یک سؤال تازه از همین مبحث را مستقل حل کن.",
    destination: "student-practice",
  };
  if (priority && ["not_started", "insufficient_evidence"].includes(priority.status)) return {
    kind: "check", skill: priority,
    title: `شناخت بهتر «${priority.title}»`,
    description: "هنوز شواهد مستقل کافی برای ارزیابی این مهارت وجود ندارد. یک تمرین کوتاه بدون راهنما انجام بده.",
    destination: "student-practice",
  };
  return {
    kind: "continue",
    title: hasOpenPractice ? "تمرین آماده‌ات را ادامه بده" : "یک مهارت تازه را کشف کن",
    description: priority ? "شواهد فعلی در مهارت‌های ثبت‌شده امیدوارکننده‌اند؛ برای بررسی ماندگاری یادگیری تمرین را ادامه بده." : "هنوز شواهد مهارت‌دار کافی ثبت نشده است. با یک تمرین در درس دلخواه شروع کن.",
    destination: "student-practice",
  };
}
