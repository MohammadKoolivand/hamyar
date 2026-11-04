import type { ClientSession } from "mongodb";
import type { Context } from "../context";
import type { Row } from "../db";

export async function recordQuestionDifficultyResponse(
  ctx: Context,
  question: Row,
  attempt: Row,
  result: string,
  session: ClientSession,
) {
  const examImported =
    question.origin === "exam_import_reviewed" ||
    question.originalOrigin === "exam_import_reviewed";
  if (
    !examImported ||
    attempt.sequence !== 1 ||
    (result !== "correct" && result !== "incorrect")
  )
    return;

  const questionVersionId = String(question._id),
    studentId = String(attempt.studentId),
    responseId = ctx.hash(`${questionVersionId}\0${studentId}`);
  const previous = await ctx
    .c("questionDifficultyResponses")
    .findOne({ _id: responseId }, { session });
  if (previous) {
    if (
      previous.attemptId === String(attempt._id) &&
      previous.result !== result
    )
      await ctx
        .c("questionDifficultyResponses")
        .updateOne(
          { _id: responseId, attemptId: String(attempt._id) },
          { $set: { result, updatedAt: ctx.now() } },
          { session },
        );
    return;
  }
  await ctx.c("questionDifficultyResponses").updateOne(
    { _id: responseId },
    {
      $setOnInsert: {
        _id: responseId,
        questionVersionId,
        studentId,
        attemptId: String(attempt._id),
        result,
        createdAt: ctx.now(),
      },
    },
    { upsert: true, session },
  );
}
