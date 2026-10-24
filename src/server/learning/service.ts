import type { ClientSession } from "mongodb";
import type { Context } from "../context";
import type { Row } from "../db";
import { mastery, mistake, summarize, type Evidence } from "./model";
export function evidence(
  a: Row,
  q: Row,
  attempt: Row,
  evaluation: Row,
): Evidence {
  return {
    _id: attempt._id,
    assignmentId: a._id,
    studentId: a.studentId,
    teacherId: a.teacherId,
    questionVersionId: q._id,
    questionId: q.questionId ?? q._id,
    skillIds: q.skillIds ?? [],
    evaluationId: evaluation._id,
    result: evaluation.result,
    method: evaluation.method,
    sequence: attempt.sequence,
    hintsUsed: attempt.hintsUsed,
    createdAt: attempt.createdAt,
    verified:
      ["correct", "incorrect", "partially_correct"].includes(
        evaluation.result,
      ) &&
      ["deterministic", "symbolic", "rule_based", "teacher_verified"].includes(
        evaluation.method,
      ),
  };
}
export async function canonical(
  ctx: Context,
  filter: object,
  session: ClientSession,
) {
  const assignments = await ctx
      .c("assignments")
      .find(filter, { session })
      .toArray(),
    ids = assignments.map((a) => a._id),
    attempts = await ctx
      .c("attempts")
      .find({ assignmentId: { $in: ids } }, { session })
      .toArray(),
    evaluations = await ctx
      .c("evaluations")
      .find({ assignmentId: { $in: ids } }, { session })
      .toArray(),
    versions = await ctx
      .c("questionVersions")
      .find(
        { _id: { $in: assignments.flatMap((a) => a.questionVersionIds) } },
        { session },
      )
      .toArray();
  const events: Evidence[] = [];
  for (const attempt of attempts) {
    const a = assignments.find((a) => a._id === attempt.assignmentId),
      q = versions.find((q) => q._id === attempt.questionVersionId),
      e = evaluations.find((e) => e.attemptId === attempt._id);
    if (a && q && e) events.push(evidence(a, q, attempt, e));
  }
  return { assignments, attempts, evaluations, versions, events };
}
export async function recordLearning(
  ctx: Context,
  a: Row,
  q: Row,
  attempt: Row,
  evaluation: Row,
  session: ClientSession,
) {
  const current = evidence(a, q, attempt, evaluation);
  await ctx
    .c("learningEvidence")
    .updateOne(
      { _id: attempt._id },
      { $set: { ...current, updatedAt: ctx.now() } },
      { upsert: true, session },
    );
  await ctx.boundary("after_learning_evidence");
  const { events } = await canonical(
    ctx,
    { studentId: a.studentId, teacherId: a.teacherId },
    session,
  );
  // The mastery row is also a cross-assignment serialization point for a student/skill.
  for (const skillId of current.skillIds) {
    const relevant = events.filter((e) => e.skillIds.includes(skillId));
    const key = ctx.hash(JSON.stringify([a.teacherId, a.studentId, skillId]));
    await ctx.c("masteryRecords").updateOne(
      { _id: key },
      {
        $set: {
          teacherId: a.teacherId,
          studentId: a.studentId,
          skillId,
          ...mastery(relevant),
          updatedAt: ctx.now(),
        },
      },
      { upsert: true, session },
    );
  }
  const sources = events.filter(
    (e) =>
      (e._id === current._id ||
        e.skillIds.some((s) => current.skillIds.includes(s))) &&
      e.verified &&
      ["incorrect", "partially_correct"].includes(e.result),
  );
  // Also update a previously recorded error invalidated by a teacher correction.
  if (
    (evaluation.reviews ?? []).some((review) =>
      ["incorrect", "partially_correct"].includes(review.previousResult),
    ) ||
    (await ctx.c("mistakeRecords").findOne({ _id: current._id }, { session }))
  )
    if (!sources.some((e) => e._id === current._id)) sources.push(current);
  for (const source of sources)
    await ctx.c("mistakeRecords").updateOne(
      { _id: source._id },
      {
        $set: {
          studentId: source.studentId,
          teacherId: source.teacherId,
          assignmentId: source.assignmentId,
          sourceAttemptId: source._id,
          questionVersionId: source.questionVersionId,
          questionId: source.questionId,
          skillIds: source.skillIds,
          ...mistake(source, events),
          updatedAt: ctx.now(),
        },
      },
      { upsert: true, session },
    );
}
export async function progress(ctx: Context, studentId: string, viewer: Row) {
  return ctx.transaction(async (session) => {
    const parentLinks =
      viewer.role === "parent"
        ? await ctx
            .c("parentLinks")
            .find({ parentId: viewer._id, studentId }, { session })
            .toArray()
        : [];
    const teacherScope =
      viewer.role === "teacher"
        ? { teacherId: viewer._id }
        : viewer.role === "parent"
          ? { teacherId: { $in: parentLinks.map((l) => l.teacherId) } }
          : {};
    const filter = {
        studentId,
        ...teacherScope,
      },
      snapshot = await canonical(ctx, filter, session),
      { events, assignments, versions } = snapshot;
    const skillIds = [...new Set(events.flatMap((e) => e.skillIds))],
      nodes = await ctx
        .c("curriculum")
        .find({ _id: { $in: skillIds } }, { session })
        .toArray();
    const overrides = await ctx
      .c("masteryOverrides")
      .find(
        {
          studentId,
          ...teacherScope,
        },
        { session },
      )
      .toArray();
    const skills = skillIds.map((skillId) => {
      const relevant = events.filter((e) => e.skillIds.includes(skillId)),
        derived = mastery(relevant),
        override = overrides.find((o) => o.skillId === skillId);
      return {
        skillId,
        title: nodes.find((n) => n._id === skillId)?.title ?? "مهارت مرتبط",
        ...derived,
        ...(override
          ? {
              status: override.status,
              derivedStatus: derived.status,
              ...(viewer.role === "teacher"
                ? { overrideReason: override.reason }
                : {}),
              overrideHistory:
                viewer.role === "teacher" ? override.history : undefined,
            }
          : {}),
      };
    });
    const notebook = await ctx
      .c("mistakeRecords")
      .find(filter, { session })
      .toArray();
    const mistakes = notebook.map((row) => {
      const source = events.find((e) => e._id === row.sourceAttemptId);
      return {
        ...row,
        ...(source ? mistake(source, events) : {}),
        statement:
          versions.find((q) => q._id === row.questionVersionId)?.statement ??
          "",
        sourceAnswer:
          snapshot.attempts.find((t) => t._id === row.sourceAttemptId)
            ?.answer ?? null,
        suggestedPracticeVersionIds: versions
          .filter(
            (q) =>
              q._id !== row.questionVersionId &&
              q.skillIds?.some((s: string) => row.skillIds.includes(s)),
          )
          .slice(0, 3)
          .map((q) => q._id),
      };
    });
    const hints = await ctx
        .c("hintEvents")
        .find(
          { assignmentId: { $in: assignments.map((a) => a._id) } },
          { session },
        )
        .toArray(),
      assignedQuestions = assignments.reduce(
        (n, a) => n + a.questionVersionIds.length,
        0,
      ),
      hintedQuestions = new Set(
        hints.map((h) => h.assignmentId + ":" + h.questionVersionId),
      ).size;
    const recommendations = skills.map((skill) => ({
      skillId: skill.skillId,
      observation: {
        attempts: skill.supportingAttempts,
        independent: skill.independentFirstAttempts,
        errors: skill.incorrect,
      },
      interpretation:
        skill.status === "insufficient_evidence"
          ? "insufficient_evidence"
          : skill.incorrect >= 2
            ? "repeated_observed_errors"
            : "observed_practice",
      action:
        skill.status === "insufficient_evidence"
          ? "independent_check"
          : skill.incorrect >= 2
            ? "review_skill"
            : "followup_practice",
      evidenceIds: skill.evidenceIds,
    }));
    return {
      studentId,
      ...summarize(events),
      assignedQuestions,
      hintCount: hints.length,
      hintedQuestions,
      hintUsageRate: assignedQuestions
        ? hintedQuestions / assignedQuestions
        : null,
      skills,
      mistakes,
      recommendations,
      ...(viewer.role === "teacher"
        ? {
            role: "teacher",
            evidence: events.map((e) => ({
              ...e,
              answer:
                snapshot.attempts.find((t) => t._id === e._id)?.answer ?? null,
              statement:
                versions.find((q) => q._id === e.questionVersionId)
                  ?.statement ?? null,
            })),
            trends: assignments.map((a) => ({
              assignmentId: a._id,
              title: a.title,
              state: a.state,
              ...summarize(events.filter((e) => e.assignmentId === a._id)),
            })),
          }
        : {
            role: viewer.role === "parent" ? "parent" : "student",
            strengths: skills
              .filter((s) => s.independentCorrect > 0)
              .map((s) => ({
                skillId: s.skillId,
                evidenceIds: events
                  .filter(
                    (e) =>
                      e.skillIds.includes(s.skillId) &&
                      e.result === "correct" &&
                      e.hintsUsed === 0,
                  )
                  .map((e) => e._id),
              })),
          }),
    };
  });
}
