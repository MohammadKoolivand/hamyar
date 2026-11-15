/** A public-question exercise is owned by the student, not by the author of the question.
 * Legacy records used the question version ID as a synthetic course ID.
 */
export function isIndependentLibraryPractice(row: {
  practiceMode?: unknown;
  libraryQuestionId?: unknown;
  courseId?: unknown;
}): boolean {
  return row.practiceMode === "self" ||
    (typeof row.libraryQuestionId === "string" &&
      row.libraryQuestionId.length > 0 &&
      row.libraryQuestionId === row.courseId);
}
