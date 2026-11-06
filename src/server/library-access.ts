import type { ClientSession } from "mongodb";
import type { Context } from "./context";
import type { Row } from "./db";

type LibraryAccess = {
  course: Row;
  enrollment: Row;
  publication: Row;
  question: Row;
};

/**
 * Resolves access to a published library question from authoritative server
 * state. Every part of the relationship is matched together so a caller
 * cannot combine a valid student, course, teacher, or question identifier
 * from different relationships.
 */
export async function activeLibraryAccess(
  ctx: Context,
  studentId: string,
  courseId: string,
  questionVersionId: string,
  session?: ClientSession,
): Promise<LibraryAccess | null> {
  const enrollment = await ctx
    .c("enrollments")
    .findOne({ studentId, courseId, status: "active" }, { session });
  if (!enrollment || typeof enrollment.teacherId !== "string") return null;

  const teacherId = enrollment.teacherId;
  const [course, publication, question] = await Promise.all([
    ctx
      .c("courses")
      .findOne({ _id: courseId, teacherId, status: "active" }, { session }),
    ctx.c("libraryPublications").findOne(
      {
        teacherId,
        courseId,
        questionVersionId,
        published: true,
      },
      { session },
    ),
    ctx.c("questionVersions").findOne(
      {
        _id: questionVersionId,
        ownerId: teacherId,
        verifiedAt: { $exists: true },
      },
      { session },
    ),
  ]);
  if (!course || !publication || !question) return null;

  const current = await ctx.c("questions").findOne(
    {
      _id: question.questionId,
      ownerId: teacherId,
      currentVersionId: questionVersionId,
    },
    { session },
  );
  return current ? { course, enrollment, publication, question } : null;
}

export async function assertLibraryAssignmentAccess(
  ctx: Context,
  assignment: Row,
  studentId: string,
  session?: ClientSession,
) {
  if (!assignment.libraryQuestionId) return null;
  if (
    typeof assignment.courseId !== "string" ||
    typeof assignment.libraryQuestionId !== "string"
  )
    ctx.fail(404, "این تمرین دیگر در کتابخانهٔ درس شما منتشر نیست");

  const access = await activeLibraryAccess(
    ctx,
    studentId,
    assignment.courseId,
    assignment.libraryQuestionId,
    session,
  );
  if (!access || access.publication.teacherId !== assignment.teacherId)
    ctx.fail(404, "این تمرین دیگر در کتابخانهٔ درس شما منتشر نیست");
  return access;
}
