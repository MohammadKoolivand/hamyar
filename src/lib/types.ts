export interface User {
  _id: string;
  name: string;
  email: string;
  role: "teacher" | "student";
}
export interface Node {
  _id: string;
  title: string;
  kind: string;
  parentId?: string;
}
export interface Question {
  _id: string;
  statement: string;
  type: string;
  options: string[];
  topicId?: string;
}
export interface Evaluation {
  _id: string;
  attemptId: string;
  result: string;
  method: string;
  reviews?: {
    reviewerId: string;
    previousResult: string;
    result: string;
    note: string;
    createdAt: string;
  }[];
}
export interface Attempt {
  _id: string;
  questionVersionId: string;
  answer: string;
  sequence: number;
  hintsUsed: number;
  evaluation?: Evaluation;
}
export interface Assignment {
  _id: string;
  title: string;
  state: string;
  studentId: string;
  questions?: Question[];
  progress: Record<string, { attempts: number; hints: number }>;
  policy: { maxHints: number; maxAttempts: number; independent: boolean };
  attempts?: Attempt[];
  evaluations?: Evaluation[];
  hints?: { _id: string; questionVersionId: string; text: string }[];
}
export interface Report {
  total: number;
  answered: number;
  independent: number;
  assisted: number;
  pending: number;
  hints: number;
  eligibleFirstAttempts: number;
  independentSuccessRate: number | null;
  evidence: Attempt[];
  recommendation: string;
  provider: string;
}
