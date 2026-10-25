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
  policy: { feedbackMode?: string },
  state: string,
) {
  return (
    policy.feedbackMode !== "end" || ["submitted", "completed"].includes(state)
  );
}
