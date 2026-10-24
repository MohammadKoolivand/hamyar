export interface Evidence {
  _id: string;
  assignmentId: string;
  studentId: string;
  teacherId: string;
  questionVersionId: string;
  questionId: string;
  skillIds: string[];
  evaluationId: string;
  result: string;
  method: string;
  sequence: number;
  hintsUsed: number;
  createdAt: string;
  verified: boolean;
}
export const masteryStatuses = [
  "not_started",
  "insufficient_evidence",
  "needs_practice",
  "developing",
  "proficient",
  "needs_review",
] as const;
export type MasteryStatus = (typeof masteryStatuses)[number];
export function policy() {
  const min = Number(process.env.MASTERY_MIN_SAMPLES ?? 3),
    threshold = Number(process.env.MASTERY_SUCCESS_THRESHOLD ?? 0.8);
  if (
    !Number.isInteger(min) ||
    min < 3 ||
    min > 20 ||
    !Number.isFinite(threshold) ||
    threshold < 0.5 ||
    threshold > 1
  )
    throw new Error("Invalid mastery policy");
  return {
    version: "transparent-mastery-v1",
    minSamples: min,
    successThreshold: threshold,
  };
}
export function summarize(events: Evidence[]) {
  const valid = events.filter((e) => e.verified),
    first = valid.filter((e) => e.sequence === 1);
  const latest = new Map<string, Evidence>();
  for (const e of events) {
    const key = e.assignmentId + ":" + e.questionVersionId,
      old = latest.get(key);
    if (!old || old.sequence < e.sequence) latest.set(key, e);
  }
  const final = [...latest.values()];
  return {
    attempts: events.length,
    answered: final.length,
    independent: final.filter(
      (e) => e.result === "correct" && e.hintsUsed === 0,
    ).length,
    assisted: final.filter((e) => e.result === "correct" && e.hintsUsed > 0)
      .length,
    incorrect: final.filter((e) => e.result === "incorrect").length,
    pending: final.filter((e) => !e.verified).length,
    eligibleFirstAttempts: first.length,
    firstAttemptCorrect: first.filter((e) => e.result === "correct").length,
    independentSuccessRate: first.length
      ? first.filter((e) => e.result === "correct" && e.hintsUsed === 0)
          .length / first.length
      : null,
  };
}
export function mastery(events: Evidence[]) {
  const p = policy(),
    valid = events.filter((e) => e.verified),
    independent = valid.filter((e) => e.sequence === 1 && e.hintsUsed === 0),
    correct = independent.filter((e) => e.result === "correct"),
    distinct = new Set(independent.map((e) => e.questionId)).size,
    ratio = independent.length ? correct.length / independent.length : null;
  let status: MasteryStatus = "not_started";
  if (events.length) {
    status = "insufficient_evidence";
    if (independent.filter((e) => e.result === "incorrect").length >= 2)
      status = "needs_practice";
    if (distinct >= p.minSamples)
      status =
        ratio !== null &&
        ratio >= p.successThreshold &&
        new Set(correct.map((e) => e.questionId)).size >= p.minSamples
          ? "proficient"
          : ratio !== null && ratio < 0.5
            ? "needs_practice"
            : "developing";
  }
  return {
    status,
    policy: p,
    supportingAttempts: valid.length,
    independentFirstAttempts: independent.length,
    distinctQuestions: distinct,
    independentCorrect: correct.length,
    assistedCorrect: valid.filter(
      (e) => e.result === "correct" && e.hintsUsed > 0,
    ).length,
    incorrect: valid.filter((e) => e.result === "incorrect").length,
    pending: events.filter((e) => !e.verified).length,
    independentRate: ratio,
    evidenceIds: events.map((e) => e._id),
    lastPractice:
      events
        .map((e) => e.createdAt)
        .sort()
        .at(-1) ?? null,
    evidenceQuality: events.some((e) => e.method === "teacher_verified")
      ? "includes_teacher_review"
      : "supported_automatic_evaluation",
  };
}
export function mistake(source: Evidence, history: Evidence[]) {
  const followup = history.filter(
    (e) =>
      e.verified &&
      e.teacherId === source.teacherId &&
      e.result === "correct" &&
      e.sequence === 1 &&
      e.hintsUsed === 0 &&
      e.questionId !== source.questionId &&
      e.createdAt > source.createdAt &&
      e.skillIds.some((s) => source.skillIds.includes(s)),
  );
  const distinct = new Set(followup.map((e) => e.questionId)).size;
  const invalidated =
    source.result !== "incorrect" && source.result !== "partially_correct";
  return {
    status: invalidated
      ? "corrected_by_review"
      : distinct >= 2
        ? "resolved"
        : distinct
          ? "improvement_observed"
          : "needs_practice",
    verificationStatus:
      source.method === "teacher_verified"
        ? "teacher_verified"
        : source.verified
          ? "supported_evaluator"
          : "unverified",
    mistakeCategory: null,
    improvementEvidenceIds: followup.map((e) => e._id),
    distinctIndependentFollowups: distinct,
  };
}
