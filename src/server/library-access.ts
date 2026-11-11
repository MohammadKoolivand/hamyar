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
  ctx: Pick<Context, "c" | "fail">,
  studentId: string,
  courseId: string,
  questionVersionId: string,
  session?: ClientSession,
): Promise<LibraryAccess | null> {
  if (courseId === questionVersionId) {
    const question = await ctx.c("questionVersions").findOne(
      {
        _id: questionVersionId,
        visibility: "public",
        verifiedAt: { $exists: true },
      },
      { session },
    );
    if (!question) return null;
    const current = await ctx.c("questions").findOne(
      {
        _id: question.questionId,
        ownerId: question.ownerId,
        currentVersionId: questionVersionId,
      },
      { session },
    );
    if (!current) return null;
    // Serialize submissions with a visibility revision on the same current pointer.
    if (session) {
      const locked = await ctx.c("questions").updateOne(
        {
          _id: current._id,
          currentVersionId: questionVersionId,
        },
        { $inc: { accessRevision: 1 } },
        { session },
      );
      if (!locked.matchedCount) return null;
    }
    const scope = {
      _id: courseId,
      teacherId: question.ownerId,
      publicLibrary: true,
    };
    return { question, course: scope, enrollment: scope, publication: scope };
  }
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
  ctx: Pick<Context, "c" | "fail">,
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
