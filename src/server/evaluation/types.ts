export type Result =
  | "correct"
  | "incorrect"
  | "partially_correct"
  | "pending_review"
  | "uncertain";
export interface EvaluationResult {
  result: Result;
  method:
    | "deterministic"
    | "symbolic"
    | "rule_based"
    | "human_required"
    | "evaluation_failed";
  requiresTeacherReview: boolean;
  explanation: string;
  evidence: string[];
  evaluatorVersion: string;
}
