import type { QuestionVisual } from "./question-visuals";
export interface MembershipEvent {
  status: string;
  actorId: string;
  at: string;
}
export interface CourseMembershipRequest {
  _id: string;
  courseId: string;
  teacherId: string;
  studentId: string;
  status: "pending" | "approved" | "declined";
  courseTitle: string;
  subject: string;
  studentName?: string;
  studentEmail?: string;
  history: MembershipEvent[];
}
export interface EnrollmentHistory {
  _id: string;
  courseId: string;
  teacherId: string;
  studentId: string;
  status: "active" | "revoked";
  courseTitle: string;
  subject: string;
  history: MembershipEvent[];
}
export interface ClassGroup {
  _id: string;
  teacherId: string;
  courseId: string;
  title: string;
  studentIds: string[];
  createdAt: string;
}
export interface GroupTask {
  _id: string;
  groupId: string;
  courseId: string;
  title: string;
  state: "draft" | "published";
  studentIds: string[];
}
export interface Course {
  _id: string;
  teacherId: string;
  title: string;
  subject: string;
  status: "active";
  createdAt: string;
}
export interface Enrollment {
  _id: string;
  teacherId: string;
  studentId: string;
  courseId: string;
  status: "active";
  createdAt: string;
  courseTitle: string;
  subject: string;
  teacherName?: string;
}
export interface DashboardMission {
  _id: string;
  title: string;
  state: string;
  courseId: string | null;
  createdAt: string;
}
export interface DashboardMetrics {
  assignments: number;
  completed: number;
  awaitingReview: number;
  inProgress: number;
  cancelled: number;
  assignedQuestions: number;
  answeredQuestions: number;
  evaluatedQuestions: number;
  correctIndependent: number;
  correctAssisted: number;
  pendingReview: number;
}
export interface DashboardCourse extends DashboardMetrics {
  courseId: string;
  title: string;
  subject: string;
  teacherName: string;
  missions: DashboardMission[];
}
export interface StudentDashboardData {
  summary: DashboardMetrics & { activeCourses: number };
  courses: DashboardCourse[];
  legacy: DashboardMetrics & { missions: DashboardMission[] };
}
export interface User {
  _id: string;
  name: string;
  email: string;
  role: "teacher" | "student" | "parent";
}
export interface Node {
  _id: string;
  title: string;
  kind: string;
  parentId?: string;
  catalogBookId?: string;
  tracks?: string[];
}
export interface Question {
  source?: import("./question-source").QuestionSource;
  classification?: "topic" | "free";
  difficulty?: "easy" | "medium" | "hard";
  year?: number;
  origin?: string;
  visuals?: QuestionVisual[];
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
  missionId: string;
  groupTaskId?: string;
  groupId?: string;
  courseId?: string;
  enrollmentId?: string;
  _id: string;
  title: string;
  state: string;
  studentId: string;
  questions?: Question[];
  progress: Record<string, { attempts: number; hints: number }>;
  policy: {
    maxHints: number;
    maxAttempts: number;
    independent: boolean;
    maxHintLevel?: number;
    allowFullSolution?: boolean;
  };
  attempts?: Attempt[];
  evaluations?: Evaluation[];
  hints?: {
    _id: string;
    questionVersionId: string;
    text: string;
    provider: string;
    model?: string;
  }[];
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
  hintFeedback?: { _id: string; hintId: string; reason: string }[];
}
