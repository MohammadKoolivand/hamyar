import { MAX_MISSION_QUESTIONS } from "../../lib/mission-limits";
import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { policySchema } from "../domain";

// One group task is an immutable recipient snapshot. Each student receives
// a separate mission + assignment; existing evidence and review paths apply.
export function registerClassGroups(app: FastifyInstance, ctx: Context) {
  const { c, user, fail, id, now, owned } = ctx;
  const uuid = z.string().uuid();
  const ids = z
    .array(uuid)
    .min(1)
    .max(50)
    .refine((v) => new Set(v).size === v.length);

  async function validMembers(
    courseId: string,
    teacherId: string,
    studentIds: string[],
    session?: import("mongodb").ClientSession,
  ) {
    const rows = await c("enrollments")
      .find(
        {
          teacherId,
          courseId,
          studentId: { $in: studentIds },
          status: "active",
        },
        { session },
      )
      .toArray();
    if (rows.length !== studentIds.length)
      fail(409, "همه دانش‌آموزان باید عضو فعال همین درس باشند");
    return new Map(rows.map((row) => [row.studentId as string, row._id]));
  }

  app.get("/api/class-groups", async (r) => {
    const teacher = await user(r, "teacher");
    return c("classGroups")
      .find({ teacherId: teacher._id })
      .sort({ createdAt: -1 })
      .toArray();
  });

  app.post("/api/class-groups", async (r) => {
    const teacher = await user(r, "teacher");
    const body = z
      .object({
        courseId: uuid,
        title: z.string().trim().min(2).max(100),
        studentIds: ids,
      })
      .parse(r.body);
    const course = await c("courses").findOne({
      _id: body.courseId,
      teacherId: teacher._id,
      status: "active",
    });
    if (!course) fail(404, "درس یافت نشد");
    await validMembers(body.courseId, teacher._id, body.studentIds);
    const row = {
      _id: id(),
      teacherId: teacher._id,
      courseId: body.courseId,
      title: body.title,
      studentIds: body.studentIds,
      createdAt: now(),
    };
    await c("classGroups").insertOne(row);
    await ctx.audit(teacher._id, "create_class_group", row._id);
    return row;
  });

  app.post("/api/class-groups/:gid/members", async (r) => {
    const teacher = await user(r, "teacher");
    const { gid } = z.object({ gid: uuid }).parse(r.params);
    const { studentIds } = z.object({ studentIds: ids }).parse(r.body);
    return ctx.transaction(async (session) => {
      const group = await c("classGroups").findOne(
        {
          _id: gid,
          teacherId: teacher._id,
        },
        { session },
      );
      if (!group) fail(404, "کلاس یافت نشد");
      const course = await c("courses").findOne(
        {
          _id: group!.courseId,
          teacherId: teacher._id,
          status: "active",
        },
        { session },
      );
      if (!course) fail(409, "درس غیرفعال است");
      await validMembers(group!.courseId, teacher._id, studentIds, session);
      await c("classGroups").updateOne(
        { _id: gid, teacherId: teacher._id },
        { $set: { studentIds, updatedAt: now() } },
        { session },
      );
      await c("auditLogs").insertOne(
        {
          _id: id(),
          actorId: teacher._id,
          action: "update_class_group_members",
          resourceId: gid,
          createdAt: now(),
        },
        { session },
      );
      return { ok: true };
    });
  });

  app.get("/api/group-tasks", async (r) => {
    const teacher = await user(r, "teacher");
    return c("groupTasks")
      .find({ teacherId: teacher._id })
      .sort({ createdAt: -1 })
      .project({
        _id: 1,
        groupId: 1,
        courseId: 1,
        title: 1,
        state: 1,
        studentIds: 1,
        createdAt: 1,
      })
      .toArray();
  });

  app.post("/api/group-tasks", async (r) => {
    const teacher = await user(r, "teacher");
    const body = z
      .object({
        groupId: uuid,
        title: z.string().trim().min(3).max(150),
        questionVersionIds: z
          .array(uuid)
          .min(1)
          .max(MAX_MISSION_QUESTIONS)
          .refine((v) => new Set(v).size === v.length),
        policy: policySchema,
      })
      .parse(r.body);
    const group = await c("classGroups").findOne({
      _id: body.groupId,
      teacherId: teacher._id,
    });
    if (!group) fail(404, "کلاس یافت نشد");
    const course = await c("courses").findOne({
      _id: group!.courseId,
      teacherId: teacher._id,
      status: "active",
    });
    if (!course) fail(404, "درس یافت نشد");
    await validMembers(group!.courseId, teacher._id, group!.studentIds);
    for (const q of body.questionVersionIds)
      await owned("questionVersions", q, teacher._id);
    const task = {
      _id: id(),
      teacherId: teacher._id,
      groupId: group!._id,
      courseId: group!.courseId,
      title: body.title,
      studentIds: [...group!.studentIds],
      questionVersionIds: body.questionVersionIds,
      policy: body.policy,
      state: "draft",
      createdAt: now(),
    };
    await c("groupTasks").insertOne(task);
    return {
      _id: task!._id,
      groupId: task!.groupId,
      courseId: task!.courseId,
      title: task!.title,
      state: task!.state,
      studentIds: task!.studentIds,
    };
  });

  app.post("/api/group-tasks/:tid/publish", async (r) => {
    const teacher = await user(r, "teacher");
    const { tid } = z.object({ tid: uuid }).parse(r.params);
    return ctx.atomic(
      r,
      teacher._id,
      "group-publish:" + tid,
      {},
      async (session) => {
        const task = await c("groupTasks").findOne(
          {
            _id: tid,
            teacherId: teacher._id,
          },
          { session },
        );
        if (!task) fail(404, "مأموریت گروهی یافت نشد");
        if (task!.state === "published") return { ok: true };
        if (task!.state !== "draft") fail(409, "این مأموریت قابل انتشار نیست");
        const course = await c("courses").findOne(
          {
            _id: task!.courseId,
            teacherId: teacher._id,
            status: "active",
          },
          { session },
        );
        if (!course) fail(409, "درس غیرفعال است");
        const enrollmentIds = await validMembers(
          task!.courseId,
          teacher._id,
          task!.studentIds,
          session,
        );
        const questions = await c("questionVersions").countDocuments(
          {
            _id: { $in: task!.questionVersionIds },
            ownerId: teacher._id,
          },
          { session },
        );
        if (questions !== task!.questionVersionIds.length)
          fail(409, "برخی سؤال‌ها دیگر معتبر نیستند");
        const timestamp = now();
        for (const studentId of task!.studentIds as string[]) {
          const missionId = id();
          const assignmentId = id();
          const enrollmentId = enrollmentIds.get(studentId);
          const progress = Object.fromEntries(
            (task!.questionVersionIds as string[]).map((questionId) => [
              questionId,
              { attempts: 0, hints: 0 },
            ]),
          );
          await c("missions").insertOne(
            {
              _id: missionId,
              teacherId: teacher._id,
              studentId,
              courseId: task!.courseId,
              enrollmentId,
              groupId: task!.groupId,
              groupTaskId: task!._id,
              title: task!.title,
              questionVersionIds: task!.questionVersionIds,
              policy: task!.policy,
              state: "published",
              createdAt: timestamp,
            },
            { session },
          );
          await c("assignments").insertOne(
            {
              _id: assignmentId,
              missionId,
              teacherId: teacher._id,
              studentId,
              courseId: task!.courseId,
              enrollmentId,
              groupId: task!.groupId,
              groupTaskId: task!._id,
              title: task!.title,
              questionVersionIds: task!.questionVersionIds,
              policy: task!.policy,
              state: "published",
              createdAt: timestamp,
              progress,
              revision: 0,
            },
            { session },
          );
        }
        await ctx.boundary("after_group_assignment_insert");
        await c("groupTasks").updateOne(
          { _id: task!._id, state: "draft" },
          { $set: { state: "published", publishedAt: timestamp } },
          { session },
        );
        await c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: teacher._id,
            action: "publish_group_task",
            resourceId: tid,
            createdAt: timestamp,
          },
          { session },
        );
        return { ok: true };
      },
    );
  });

  // Summary rows are deliberately scoped to a group task, and never include
  // answers or teacher-owned reference material. Detail uses /assignments/:aid/report.
  app.get("/api/group-tasks/:tid/report", async (r) => {
    const teacher = await user(r, "teacher");
    const { tid } = z.object({ tid: uuid }).parse(r.params);
    const task = await c("groupTasks").findOne({
      _id: tid,
      teacherId: teacher._id,
    });
    if (!task) fail(404, "مأموریت گروهی یافت نشد");
    const assignments = await c("assignments")
      .find({
        groupTaskId: tid,
        teacherId: teacher._id,
      })
      .project({
        _id: 1,
        studentId: 1,
        state: 1,
        questionVersionIds: 1,
      })
      .toArray();
    const attempts = assignments.length
      ? await c("attempts")
          .find({ assignmentId: { $in: assignments.map((a) => a._id) } })
          .project({
            _id: 1,
            assignmentId: 1,
            questionVersionId: 1,
            sequence: 1,
            hintsUsed: 1,
          })
          .toArray()
      : [];
    const evals = attempts.length
      ? await c("evaluations")
          .find({ attemptId: { $in: attempts.map((a) => a._id) } })
          .project({ attemptId: 1, result: 1 })
          .toArray()
      : [];
    const latest = new Map<string, (typeof attempts)[number]>();
    for (const attempt of attempts) {
      const key = attempt.assignmentId + ":" + attempt.questionVersionId;
      const previous = latest.get(key);
      if (!previous || attempt.sequence > previous.sequence)
        latest.set(key, attempt);
    }
    const verdict = new Map(
      evals.map((e) => [e.attemptId, e.result as string]),
    );
    const people = await c("users")
      .find({
        _id: { $in: assignments.map((a) => a.studentId) },
        role: "student",
      })
      .project({ _id: 1, name: 1 })
      .toArray();
    const names = new Map(people.map((p) => [p._id, p.name as string]));
    return {
      _id: task!._id,
      title: task!.title,
      state: task!.state,
      recipients: task!.studentIds.length,
      students: assignments.map((a) => {
        const evidence = [...latest.values()].filter(
          (t) => t.assignmentId === a._id,
        );
        return {
          assignmentId: a._id,
          studentId: a.studentId,
          studentName: names.get(a.studentId) ?? "دانش‌آموز",
          state: a.state,
          total: a.questionVersionIds.length,
          answered: evidence.length,
          independent: evidence.filter(
            (t) => verdict.get(t._id) === "correct" && t.hintsUsed === 0,
          ).length,
          assisted: evidence.filter(
            (t) => verdict.get(t._id) === "correct" && t.hintsUsed > 0,
          ).length,
          pending: evidence.filter(
            (t) => verdict.get(t._id) === "pending_review",
          ).length,
        };
      }),
    };
  });
}
