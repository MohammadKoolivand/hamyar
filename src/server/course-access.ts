import type { ClientSession } from "mongodb";
import type { Context } from "./context";
import type { Row } from "./db";
import { assertLibraryAssignmentAccess } from "./library-access";

/** Always resolve current enrollment and course state from the database.
 * The record is retained for audit, but revoked access cannot read its content.
 */
export async function assertActiveAssignmentCourse(
  ctx: Pick<Context, "c" | "fail">,
  assignment: Row,
  studentId: string,
  session?: ClientSession,
): Promise<void> {
  if (!assignment.courseId) return; // Legacy individual work is unscoped.
  if (assignment.libraryQuestionId === assignment.courseId) {
    await assertLibraryAssignmentAccess(ctx, assignment, studentId, session);
    if (assignment.state === "cancelled" || assignment.accessRevokedAt)
      ctx.fail(404, "مأموریت در دسترس نیست");
    return;
  }
  if (
    typeof assignment.courseId !== "string" ||
    typeof assignment.teacherId !== "string"
  )
    ctx.fail(404, "مأموریت در دسترس نیست");
  const filter = {
    studentId,
    courseId: assignment.courseId,
    teacherId: assignment.teacherId,
    status: "active",
    ...(assignment.enrollmentId ? { _id: assignment.enrollmentId } : {}),
  };
  const [enrollment, course] = await Promise.all([
    ctx.c("enrollments").findOne(filter, { session }),
    ctx.c("courses").findOne(
      {
        _id: assignment.courseId,
        teacherId: assignment.teacherId,
        status: "active",
      },
      { session },
    ),
  ]);
  if (
    !enrollment ||
    !course ||
    assignment.state === "cancelled" ||
    assignment.accessRevokedAt
  )
    ctx.fail(404, "مأموریت در دسترس نیست");
}
