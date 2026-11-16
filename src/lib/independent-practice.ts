/** A public-question exercise is owned by the student, not by the author of the question.
 * Legacy records used the question version ID as a synthetic course ID.
 * Accept any document shape: MongoDB row types may omit these optional fields.
 */
export function isIndependentLibraryPractice(row: object): boolean {
  const candidate = row as {
    practiceMode?: unknown;
    libraryQuestionId?: unknown;
    courseId?: unknown;
  };
  return candidate.practiceMode === "self" ||
    (typeof candidate.libraryQuestionId === "string" &&
      candidate.libraryQuestionId.length > 0 &&
      candidate.libraryQuestionId === candidate.courseId);
}
