import { feedbackVisible } from "../../lib/practice-answer";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import type { Document } from "mongodb";

// A student's own evidence-only dashboard. This is not a mastery score:
// completion and correctness are distinct measurements and unknown remains unknown.
export function registerStudentDashboard(app: FastifyInstance, ctx: Context) {
  app.get("/api/student/dashboard", async (request) => {
    const student = await ctx.user(request, "student");
    return ctx.transaction(async (session) => {
      const [enrollments, assignments] = await Promise.all([
        ctx
          .c("enrollments")
          .find({ studentId: student._id, status: "active" }, { session })
          .toArray(),
        ctx
          .c("assignments")
          .find({ studentId: student._id }, { session })
          .project({
            _id: 1,
            teacherId: 1,
            studentId: 1,
            courseId: 1,
            title: 1,
            state: 1,
            createdAt: 1,
            questionVersionIds: 1,
            policy: 1,
            dueAt: 1,
          })
          .toArray(),
      ]);
      const activeCourses = await ctx
        .c("courses")
        .find(
          {
            _id: { $in: enrollments.map((e) => e.courseId) },
            status: "active",
          },
          { session },
        )
        .project({
          _id: 1,
          teacherId: 1,
          title: 1,
          subject: 1,
        })
        .toArray();
      const valid = activeCourses.filter((course) =>
        enrollments.some(
          (e) => e.courseId === course._id && e.teacherId === course.teacherId,
        ),
      );
      const teachers = await ctx
        .c("users")
        .find(
          {
            _id: { $in: [...new Set(valid.map((course) => course.teacherId))] },
            role: "teacher",
          },
          { session },
        )
        .project({ _id: 1, name: 1 })
        .toArray();
      const teacherNames = new Map(
        teachers.map((t) => [t._id, t.name as string]),
      );
      const assignmentIds = assignments.map((a) => a._id);
      const attempts = assignmentIds.length
        ? await ctx
            .c("attempts")
            .find({ assignmentId: { $in: assignmentIds } }, { session })
            .project({
              _id: 1,
              assignmentId: 1,
              questionVersionId: 1,
              sequence: 1,
              hintsUsed: 1,
            })
            .toArray()
        : [];
      const evaluations = attempts.length
        ? await ctx
            .c("evaluations")
            .find(
              {
                attemptId: { $in: attempts.map((a) => a._id) },
              },
              { session },
            )
            .project({ _id: 1, attemptId: 1, result: 1 })
            .toArray()
        : [];
      const latest = new Map<string, Document>();
      for (const attempt of attempts) {
        const key = attempt.assignmentId + ":" + attempt.questionVersionId;
        const prev = latest.get(key);
        if (!prev || attempt.sequence > prev.sequence) latest.set(key, attempt);
      }
      const evaluationsByAttempt = new Map(
        evaluations.map((e) => [e.attemptId, e]),
      );

      function summarize(rows: Document[]) {
        const ids = new Set(rows.map((a) => a._id));
        const relevant = [...latest.values()].filter((a) =>
          ids.has(a.assignmentId),
        );
        let correctIndependent = 0,
          correctAssisted = 0,
          pendingReview = 0,
          evaluatedQuestions = 0;
        for (const attempt of relevant) {
          const assignment = assignments.find(
            (a) => a._id === attempt.assignmentId,
          );
          if (
            assignment &&
            !feedbackVisible(assignment.policy ?? {}, assignment.state)
          )
            continue;
          const evaluation = evaluationsByAttempt.get(attempt._id);
          if (!evaluation) continue;
          if (evaluation.result === "pending_review") {
            pendingReview += 1;
            continue;
          }
          if (
            !["correct", "incorrect", "partially_correct"].includes(
              evaluation.result,
            )
          )
            continue;
          evaluatedQuestions += 1;
          if (evaluation.result === "correct") {
            if (attempt.hintsUsed === 0) correctIndependent += 1;
            else correctAssisted += 1;
          }
        }
        const missions = rows
          .map((a) => ({
            _id: a._id,
            title: a.title,
            state: a.state,
            courseId: a.courseId ?? null,
            createdAt: a.createdAt,
            dueAt: a.dueAt ?? null,
          }))
          .sort((a, b) =>
            String(b.createdAt).localeCompare(String(a.createdAt)),
          );
        return {
          assignments: rows.length,
          completed: rows.filter((a) => a.state === "completed").length,
          awaitingReview: rows.filter((a) => a.state === "submitted").length,
          inProgress: rows.filter((a) =>
            ["published", "in_progress"].includes(a.state),
          ).length,
          cancelled: rows.filter((a) => a.state === "cancelled").length,
          assignedQuestions: rows.reduce(
            (n, a) => n + (a.questionVersionIds?.length ?? 0),
            0,
          ),
          answeredQuestions: relevant.length,
          evaluatedQuestions,
          correctIndependent,
          correctAssisted,
          pendingReview,
          missions,
        };
      }
      const matched = new Set<string>();
      const courses = valid.map((course) => {
        const rows = assignments.filter(
          (a) => a.courseId === course._id && a.teacherId === course.teacherId,
        );
        for (const a of rows) matched.add(a._id);
        return {
          courseId: course._id,
          title: course.title,
          subject: course.subject,
          teacherName: teacherNames.get(course.teacherId) ?? "معلم",
          ...summarize(rows),
        };
      });
      // Legacy unscoped work is not assigned to an unrelated current course.
      const legacy = summarize(assignments.filter((a) => !matched.has(a._id)));
      const summary = summarize(assignments);
      const assignedQuestionIds = [
        ...new Set(
          assignments
            .filter((a) => a.state !== "cancelled")
            .flatMap((a) => a.questionVersionIds ?? []),
        ),
      ];
      const versions = assignedQuestionIds.length
        ? await ctx
            .c("questionVersions")
            .find(
              { _id: { $in: assignedQuestionIds } },
              {
                session,
                projection: {
                  _id: 1,
                  ownerId: 1,
                  topicId: 1,
                  type: 1,
                  source: 1,
                },
              },
            )
            .toArray()
        : [];
      const topicIds = new Set(
        versions.flatMap((version) =>
          typeof version.topicId === "string" ? [version.topicId] : [],
        ),
      );
      const owners = [...new Set(versions.map((version) => version.ownerId))];
      const ownerNodes = owners.length
        ? await ctx
            .c("curriculum")
            .find(
              {
                ownerId: { $in: owners },
                archivedAt: { $exists: false },
              },
              {
                session,
                projection: {
                  _id: 1,
                  title: 1,
                  kind: 1,
                  parentId: 1,
                  tracks: 1,
                },
              },
            )
            .toArray()
        : [];
      const byNodeId = new Map(ownerNodes.map((node) => [node._id, node]));
      const visibleNodeIds = new Set<string>();
      for (const topicId of topicIds) {
        let node = byNodeId.get(topicId);
        const seen = new Set<string>();
        while (node && !seen.has(node._id)) {
          seen.add(node._id);
          visibleNodeIds.add(node._id);
          node = node.parentId ? byNodeId.get(node.parentId) : undefined;
        }
      }
      const contentItems = versions.flatMap((version) => {
        if (
          typeof version.topicId !== "string" ||
          typeof version.type !== "string"
        )
          return [];
        const source = version.source as
          Record<string, string | number | undefined> | undefined;
        const examKey = source
          ? [
              source.family,
              source.sourceTitle,
              source.academicYear,
              source.examDate,
              source.session,
            ]
              .filter(Boolean)
              .join(":")
          : "";
        const resourceKey = source
          ? String(
              source.sourceUrl ??
                source.sourcePageUrl ??
                source.sourceTitle ??
                "",
            )
          : "";
        const courseIds = [
          ...new Set(
            assignments
              .filter(
                (assignment) =>
                  assignment.state !== "cancelled" &&
                  assignment.questionVersionIds?.includes(version._id) &&
                  valid.some(
                    (course) =>
                      course._id === assignment.courseId &&
                      course.teacherId === assignment.teacherId,
                  ),
              )
              .map((assignment) => assignment.courseId as string),
          ),
        ];
        return [
          {
            questionId: version._id,
            topicId: version.topicId,
            type: version.type,
            courseIds,
            ...(examKey ? { examKey } : {}),
            ...(resourceKey ? { resourceKey } : {}),
            ...(source?.sourceTitle
              ? { examTitle: String(source.sourceTitle) }
              : {}),
            ...(source?.sourceTitle
              ? { resourceTitle: String(source.sourceTitle) }
              : {}),
          },
        ];
      });
      const versionById = new Map(
        versions.map((version) => [version._id, version]),
      );
      const titleByNodeId = new Map(
        ownerNodes.map((node) => [node._id, String(node.title)]),
      );
      const coursesWithEvidence = courses.map((course) => {
        const assignmentIds = new Set(
          assignments
            .filter((assignment) => assignment.courseId === course.courseId)
            .map((assignment) => assignment._id),
        );
        const byTopic = new Map<
          string,
          {
            topicId: string;
            title: string;
            answered: number;
            evaluated: number;
            correctIndependent: number;
            correctAssisted: number;
            incorrect: number;
          }
        >();
        for (const attempt of latest.values()) {
          if (!assignmentIds.has(attempt.assignmentId)) continue;
          const version = versionById.get(attempt.questionVersionId);
          if (!version || typeof version.topicId !== "string") continue;
          const current = byTopic.get(version.topicId) ?? {
            topicId: version.topicId,
            title: titleByNodeId.get(version.topicId) ?? "مبحث بدون عنوان",
            answered: 0,
            evaluated: 0,
            correctIndependent: 0,
            correctAssisted: 0,
            incorrect: 0,
          };
          current.answered += 1;
          const assignment = assignments.find(
            (row) => row._id === attempt.assignmentId,
          );
          const evaluation = evaluationsByAttempt.get(attempt._id);
          if (
            assignment &&
            evaluation &&
            feedbackVisible(assignment.policy ?? {}, assignment.state) &&
            ["correct", "incorrect", "partially_correct"].includes(
              evaluation.result,
            )
          ) {
            current.evaluated += 1;
            if (evaluation.result === "correct") {
              if (attempt.hintsUsed === 0) current.correctIndependent += 1;
              else current.correctAssisted += 1;
            } else current.incorrect += 1;
          }
          byTopic.set(version.topicId, current);
        }
        const topics = [...byTopic.values()].sort(
          (a, b) =>
            b.answered - a.answered || a.title.localeCompare(b.title, "fa"),
        );
        return {
          ...course,
          learningProgress: course.evaluatedQuestions
            ? Math.round(
                (course.correctIndependent / course.evaluatedQuestions) * 100,
              )
            : null,
          incorrectQuestions: topics.reduce(
            (sum, topic) => sum + topic.incorrect,
            0,
          ),
          topics,
        };
      });
      return {
        summary: {
          ...summary,
          activeCourses: courses.length,
          missions: undefined,
        },
        courses: coursesWithEvidence,
        legacy,
        content: {
          nodes: ownerNodes.filter((node) => visibleNodeIds.has(node._id)),
          items: contentItems,
        },
      };
    });
  });
}
