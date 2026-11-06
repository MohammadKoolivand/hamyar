import type { Assignment } from "./types";
export function practiceAnswer(
  a: Assignment,
  questionId: string,
  storage: Pick<Storage, "getItem">,
): string {
  const previous = a.attempts
    ?.filter((t) => t.questionVersionId === questionId)
    .sort((x, y) => y.sequence - x.sequence)[0];
  if (a.progress[questionId]?.attempts >= a.policy.maxAttempts && previous)
    return previous.answer;
  return (
    storage.getItem(`draft:${a.studentId}:${a._id}:${questionId}`) ??
    previous?.answer ??
    ""
  );
}
export function feedbackVisible(
  policy: { feedbackMode?: string; resultReleaseAt?: string },
  state: string,
  at = new Date(),
) {
  if (!releaseTimeReached(policy, at)) return false;
  return (
    policy.feedbackMode !== "end" || ["submitted", "completed"].includes(state)
  );
}

export function finalResultVisible(
  policy: { resultReleaseAt?: string },
  state: string,
  at = new Date(),
) {
  return (
    ["submitted", "completed"].includes(state) &&
    releaseTimeReached(policy, at)
  );
}

function releaseTimeReached(
  policy: { resultReleaseAt?: string },
  at: Date,
) {
  if (!policy.resultReleaseAt) return true;
  const release = new Date(policy.resultReleaseAt).getTime();
  return Number.isFinite(release) && release <= at.getTime();
}
