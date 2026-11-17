/**
 * Evidence-based progress for one uploaded exam PDF.
 *
 * Never treat the count of OCR drafts as the known size of a real exam.
 * The denominator comes from a complete, numbered answer key when available;
 * otherwise the highest consistently observed question number is only an
 * estimate. Without enough source evidence the denominator stays unknown.
 */
export type ExpectedCountConfidence = "key_complete" | "numbering_estimate" | "unknown";
export interface ExpectedQuestionCount {
  expectedQuestionCount: number | null;
  expectedCountConfidence: ExpectedCountConfidence;
}
export interface NumberedSourceQuestion {
  number: number | null;
}
export interface NumberedAnswerKey {
  number: number;
  option: number;
}
export interface ApprovalRow {
  _id: string;
  state: "pending" | "approved" | "rejected";
  originalNumber?: number | null;
  detectedNumber?: number | null;
  questionVersionId?: string | null;
}
export interface ExamProgress {
  approved: number;
  extracted: number;
  expectedQuestionCount: number | null;
  expectedCountConfidence: ExpectedCountConfidence;
  percent: number | null;
  status: "empty" | "partial" | "complete";
}
const MAX_EXAM_QUESTIONS = 500;
function validNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" &&
    value >= 1 && value <= MAX_EXAM_QUESTIONS;
}
function distinctNumbers(values: readonly (number | null | undefined)[]): number[] {
  return [...new Set(values.filter(validNumber))].sort((a, b) => a - b);
}
function isContiguousFromOne(values: readonly number[]) {
  return values.length >= 2 && values[0] === 1 &&
    values.every((value, index) => value === index + 1);
}

/**
 * A complete answer key with all question numbers 1..N and no duplicated
 * question numbers is the strongest machine-readable evidence.
 * When the source PDF contains a higher number, an OCR-incomplete key must
 * never be used to declare the exam finished.
 */
export function inferExpectedQuestionCount(input: {
  questions: readonly NumberedSourceQuestion[];
  answerEntries?: readonly NumberedAnswerKey[];
  failedAnswerPages?: number;
}): ExpectedQuestionCount {
  const sourceNumbers = distinctNumbers(input.questions.map((question) => question.number));
  const keyEntries = input.answerEntries ?? [];
  const keyNumbers = distinctNumbers(keyEntries.map((entry) => entry.number));
  const maxQuestion = sourceNumbers.at(-1) ?? 0;
  const maxKey = keyNumbers.at(-1) ?? 0;
  if (!input.failedAnswerPages && keyNumbers.length === keyEntries.length &&
    isContiguousFromOne(keyNumbers) && maxKey >= maxQuestion &&
    keyEntries.every((entry) => validNumber(entry.number) && entry.option >= 1 && entry.option <= 4)) {
    return { expectedQuestionCount: maxKey, expectedCountConfidence: "key_complete" };
  }
  // A partially recognized booklet may still reveal its final question number.
  // Require both early numbering and substantial coverage before estimating.
  const upperBound = Math.max(maxQuestion, maxKey);
  const combined = distinctNumbers([...sourceNumbers, ...keyNumbers]);
  if (upperBound >= 5 && combined.includes(1) &&
    combined.length >= Math.ceil(upperBound * 0.65) &&
    combined.includes(upperBound)) {
    return { expectedQuestionCount: upperBound, expectedCountConfidence: "numbering_estimate" };
  }
  return { expectedQuestionCount: null, expectedCountConfidence: "unknown" };
}
/** Numbered duplicates are one question; unnumbered approved drafts retain
 * their own identity. Rejected and pending drafts never count as imported. */
export function countUniqueApprovedQuestions(items: readonly ApprovalRow[]): number {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.state !== "approved" || !item.questionVersionId) continue;
    const number = item.originalNumber ?? item.detectedNumber;
    ids.add(validNumber(number) ? `n:${number}` : `i:${item._id}`);
  }
  return ids.size;
}
export function calculateExamProgress(input: ExpectedQuestionCount & {
  approved: number;
  extracted: number;
}): ExamProgress {
  const approved = Math.max(0, input.approved);
  const extracted = Math.max(0, input.extracted);
  const expected = input.expectedQuestionCount;
  const trusted = input.expectedCountConfidence === "key_complete" &&
    validNumber(expected) && expected >= approved;
  const percent = validNumber(expected) && expected > 0
    ? Math.min(100, Math.round((approved / expected) * 100)) : null;
  return {
    approved, extracted,
    expectedQuestionCount: validNumber(expected) ? expected : null,
    expectedCountConfidence: input.expectedCountConfidence,
    percent,
    status: approved === 0 ? "empty" : trusted && approved === expected ? "complete" : "partial",
  };
}
