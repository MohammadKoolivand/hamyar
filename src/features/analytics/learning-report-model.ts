/** Presentation-only calculations over the authorization-filtered progress response. */
export interface RecentLearningMission {
  assignmentId: string;
  title: string;
  state: string;
  total: number;
  answered: number;
  independent: number;
  assisted: number;
  incorrect: number;
  pending?: number;
}

export function missionSuccessRate(mission: RecentLearningMission): number | null {
  // Unanswered and unverified work must never be treated as confirmed success.
  const evaluated = Math.max(0, mission.independent + mission.assisted + mission.incorrect);
  return evaluated ? (mission.independent + mission.assisted) / evaluated : null;
}

export type MissionResultFilter = "all" | "needs-review" | "finished";
export function filterRecentMissions(
  missions: RecentLearningMission[],
  filter: MissionResultFilter,
  query: string,
): RecentLearningMission[] {
  const term = query.trim().toLocaleLowerCase("fa-IR");
  return missions.filter((mission) => {
    if (term && !mission.title.toLocaleLowerCase("fa-IR").includes(term)) return false;
    if (filter === "finished") return ["completed", "submitted"].includes(mission.state);
    if (filter === "needs-review") return mission.incorrect > 0 || (mission.pending ?? 0) > 0;
    return true;
  });
}

export function learningNextStep(skills: { status: string; incorrect: number; title: string }[]): string {
  const toReview = skills.filter((skill) => ["needs_practice", "needs_review"].includes(skill.status));
  if (toReview.length) {
    const target = [...toReview].sort((a, b) => b.incorrect - a.incorrect)[0];
    return `ابتدا «${target.title}» را مرور کن و سپس یک سؤال تازه را بدون راهنما حل کن.`;
  }
  if (skills.some((skill) => skill.status === "insufficient_evidence"))
    return "برای کامل‌شدن شواهد یادگیری، یک تمرین تازه را بدون راهنما انجام بده.";
  if (skills.length) return "برای سنجش پایداری یادگیری، سراغ تمرین مرور فاصله‌دار برو.";
  return "با انجام اولین تمرین، گزارش یادگیری بر اساس پاسخ‌های واقعی ساخته می‌شود.";
}
