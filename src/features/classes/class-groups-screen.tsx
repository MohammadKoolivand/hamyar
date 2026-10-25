"use client";

import { useEffect, useState, type FormEvent } from "react";
import { UsersRound, BookOpen, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import type {
  Assignment,
  Course,
  Enrollment,
  Question,
  User,
} from "@/lib/types";

interface ClassGroup {
  _id: string;
  courseId: string;
  title: string;
  studentIds: string[];
}
interface GroupTask {
  _id: string;
  groupId: string;
  courseId: string;
  title: string;
  state: string;
  studentIds: string[];
}
interface GroupReport {
  _id: string;
  title: string;
  recipients: number;
  students: {
    assignmentId: string;
    studentId: string;
    studentName: string;
    state: string;
    total: number;
    answered: number;
    independent: number;
    assisted: number;
    pending: number;
  }[];
}

export function ClassGroupsScreen({
  courses,
  enrollments,
  students,
  questions,
  assignments,
  refresh,
  showReport,
}: {
  courses: Course[];
  enrollments: Enrollment[];
  students: User[];
  questions: Question[];
  assignments: Assignment[];
  refresh: () => Promise<void>;
  showReport: (a: Assignment) => Promise<void>;
}) {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [reports, setReports] = useState<Record<string, GroupReport>>({});
  const [courseId, setCourseId] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupStudents, setGroupStudents] = useState<string[]>([]);
  const [taskGroup, setTaskGroup] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [feedbackMode, setFeedbackMode] = useState<"immediate" | "end">("end");
  const [maxHints, setMaxHints] = useState(2);
  const [independent, setIndependent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [g, t] = await Promise.all([
      api<ClassGroup[]>("/class-groups"),
      api<GroupTask[]>("/group-tasks"),
    ]);
    setGroups(g);
    setTasks(t);
  }
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<ClassGroup[]>("/class-groups"),
      api<GroupTask[]>("/group-tasks"),
    ])
      .then(([g, t]) => {
        if (mounted) {
          setGroups(g);
          setTasks(t);
        }
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const eligible = (course: string) =>
    students.filter((student) =>
      enrollments.some(
        (e) => e.courseId === course && e.studentId === student._id,
      ),
    );

  function studentPicker(
    course: string,
    chosen: string[],
    onChange: (ids: string[]) => void,
  ) {
    return (
      <div className="grid gap-2" aria-label="دانش‌آموزان کلاس">
        {eligible(course).map((person) => (
          <label
            key={person._id}
            className="glass-option flex items-center gap-3 p-3 text-sm"
          >
            <input
              type="checkbox"
              className="size-5 accent-[#1f3f97]"
              checked={chosen.includes(person._id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...chosen, person._id]
                    : chosen.filter((x) => x !== person._id),
                )
              }
            />
            {person.name}
          </label>
        ))}
        {!eligible(course).length && (
          <p className="text-sm text-slate-600">
            ابتدا عضویت دانش‌آموزان در درس را تأیید کنید.
          </p>
        )}
      </div>
    );
  }

  function roster(group: ClassGroup) {
    const valid = eligible(group.courseId);
    const activeIds = new Set(valid.map((s) => s._id));
    const activeInGroup = group.studentIds.filter((sid) => activeIds.has(sid));
    return (
      <div key={group._id} className="glass-card grid gap-3 p-5">
        <div className="flex items-center gap-2">
          <UsersRound size={20} className="text-[#1f3f97]" aria-hidden />
          <h3 className="font-bold">{group.title}</h3>
        </div>
        <p className="text-xs text-slate-600">
          {courses.find((c) => c._id === group.courseId)?.title ?? "درس"} ·{" "}
          {activeInGroup.length} عضو فعال
        </p>
        <p className="text-sm leading-loose text-slate-600">
          {group.studentIds
            .map(
              (sid) => students.find((s) => s._id === sid)?.name ?? "دانش‌آموز",
            )
            .join("، ")}
        </p>
        {group.studentIds.some((sid) => !activeIds.has(sid)) && (
          <p className="text-xs text-amber-800">
            یک یا چند عضو از درس خارج شده‌اند؛ قبل از انتشار فهرست را اصلاح
            کنید.
          </p>
        )}
        <details className="grid gap-3">
          <summary className="cursor-pointer text-sm font-medium text-[#1f3f97]">
            ویرایش اعضای کلاس
          </summary>
          <div className="mt-3 grid gap-3">
            {studentPicker(
              group.courseId,
              groupEdits[group._id] ?? group.studentIds,
              (ids) =>
                setGroupEdits((previous) => ({
                  ...previous,
                  [group._id]: ids,
                })),
            )}
            <Button
              disabled={
                busy || !(groupEdits[group._id] ?? group.studentIds).length
              }
              onClick={() =>
                void act(async () => {
                  await api("/class-groups/" + group._id + "/members", {
                    studentIds: groupEdits[group._id] ?? group.studentIds,
                  });
                  setGroupEdits((prev) => {
                    const next = { ...prev };
                    delete next[group._id];
                    return next;
                  });
                  setNotice("اعضای کلاس به‌روز شدند.");
                })
              }
            >
              ذخیره اعضا
            </Button>
          </div>
        </details>
      </div>
    );
  }

  const [groupEdits, setGroupEdits] = useState<Record<string, string[]>>({});
  async function createGroup(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      await api("/class-groups", {
        courseId,
        title: groupTitle.trim(),
        studentIds: groupStudents,
      });
      setGroupTitle("");
      setGroupStudents([]);
      setNotice("کلاس جدید ایجاد شد.");
    });
  }
  async function createTask(event: FormEvent) {
    event.preventDefault();
    await act(async () => {
      await api("/group-tasks", {
        groupId: taskGroup,
        title: taskTitle.trim(),
        questionVersionIds: selectedQuestions,
        policy: {
          feedbackMode,
          maxAttempts,
          maxHints: independent ? 0 : maxHints,
          independent,
          maxHintLevel: independent ? 0 : 3,
          allowFullSolution: false,
        },
      });
      setTaskTitle("");
      setSelectedQuestions([]);
      setNotice("پیش‌نویس مأموریت گروهی ساخته شد.");
    });
  }

  return (
    <div className="grid gap-5">
      <section className="glass-hero grid gap-2 p-6">
        <h2 className="text-xl font-bold">کلاس‌ها و مأموریت‌های گروهی</h2>
        <p className="text-sm leading-loose text-slate-600">
          یک مأموریت برای چند دانش‌آموز منتشر کنید؛ هر نفر پاسخ و گزارش مستقل
          خودش را دارد.
        </p>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="glass-note p-3 text-sm">
          {notice}
        </p>
      )}
      <section className="glass-panel grid gap-4 p-6">
        <h3 className="flex items-center gap-2 font-bold">
          <UsersRound size={19} /> ساخت کلاس
        </h3>
        <form onSubmit={(e) => void createGroup(e)} className="grid gap-3">
          <Field title="عنوان کلاس">
            <input
              className="glass-field min-h-11 w-full p-3"
              required
              minLength={2}
              maxLength={100}
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="کلاس ریاضی ۱۰/۱"
            />
          </Field>
          <Field title="درس کلاس">
            <select
              required
              className="glass-field min-h-11 w-full p-3"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setGroupStudents([]);
              }}
            >
              <option value="">انتخاب درس</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          {courseId && studentPicker(courseId, groupStudents, setGroupStudents)}
          <Button
            disabled={busy || !courseId || !groupStudents.length}
            type="submit"
          >
            ایجاد کلاس
          </Button>
        </form>
      </section>
      <section className="grid gap-3">
        <h3 className="text-lg font-bold">کلاس‌های من</h3>
        {!groups.length && (
          <p className="glass-panel p-5 text-sm text-slate-600">
            هنوز کلاسی ساخته نشده است.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">{groups.map(roster)}</div>
      </section>
      <section className="glass-panel grid gap-4 p-6">
        <h3 className="flex items-center gap-2 font-bold">
          <BookOpen size={20} /> مأموریت گروهی جدید
        </h3>
        <form className="grid gap-3" onSubmit={(e) => void createTask(e)}>
          <Field title="کلاس مقصد">
            <select
              required
              className="glass-field min-h-11 w-full p-3"
              value={taskGroup}
              onChange={(e) => setTaskGroup(e.target.value)}
            >
              <option value="">انتخاب کلاس</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
          <Field title="عنوان مأموریت">
            <input
              required
              minLength={3}
              maxLength={150}
              className="glass-field min-h-11 w-full p-3"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
          </Field>
          <div className="grid gap-2">
            <strong className="text-sm">سؤال‌های مأموریت</strong>
            {questions.map((q) => (
              <label
                key={q._id}
                className="glass-option flex items-center gap-3 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-[#1f3f97]"
                  checked={selectedQuestions.includes(q._id)}
                  onChange={(e) =>
                    setSelectedQuestions(
                      e.target.checked
                        ? [...selectedQuestions, q._id]
                        : selectedQuestions.filter((v) => v !== q._id),
                    )
                  }
                />
                {q.statement}
              </label>
            ))}
            {!questions.length && (
              <p className="text-sm text-slate-600">
                ابتدا از بانک سؤال، سؤال تعریف کنید.
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field title="زمان نمایش نتیجه به دانش‌آموز">
              <select
                className="glass-field min-h-11 w-full p-3"
                value={feedbackMode}
                onChange={(e) =>
                  setFeedbackMode(e.target.value as "immediate" | "end")
                }
              >
                <option value="immediate">بعد از هر پاسخ</option>
                <option value="end">پس از پایان همه سؤال‌ها</option>
              </select>
            </Field>
            <Field title="حداکثر تلاش هر سؤال">
              <input
                type="number"
                min={1}
                max={10}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="glass-field min-h-11 w-full p-3"
              />
            </Field>
            <Field title="حداکثر راهنمایی">
              <input
                type="number"
                min={0}
                max={3}
                disabled={independent}
                value={independent ? 0 : maxHints}
                onChange={(e) => setMaxHints(Number(e.target.value))}
                className="glass-field min-h-11 w-full p-3"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={independent}
              onChange={(e) => setIndependent(e.target.checked)}
              className="size-5 accent-[#1f3f97]"
            />{" "}
            سنجش مستقل بدون راهنمایی
          </label>
          <Button
            disabled={busy || !taskGroup || !selectedQuestions.length}
            type="submit"
          >
            ساخت پیش‌نویس گروهی
          </Button>
        </form>
      </section>
      <section className="grid gap-3">
        <h3 className="text-lg font-bold">
          مأموریت‌های گروهی و گزارش هر دانش‌آموز
        </h3>
        {!tasks.length && (
          <p className="glass-panel p-5 text-sm text-slate-600">
            هنوز مأموریت گروهی ندارید.
          </p>
        )}
        {tasks.map((task) => (
          <article key={task._id} className="glass-card grid gap-3 p-5">
            <h4 className="font-bold">{task.title}</h4>
            <p className="text-xs text-slate-600">
              {groups.find((g) => g._id === task.groupId)?.title ?? "کلاس"} ·
              {task.studentIds.length.toLocaleString("fa-IR")} دانش‌آموز ·
              {task.state === "draft" ? "پیش‌نویس" : "منتشرشده"}
            </p>
            {task.state === "draft" ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api("/group-tasks/" + task._id + "/publish", {});
                    setNotice("مأموریت برای همه دانش‌آموزان کلاس منتشر شد.");
                  })
                }
              >
                انتشار برای تمام اعضای کلاس
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    const data = await api<GroupReport>(
                      "/group-tasks/" + task._id + "/report",
                    );
                    setReports((prev) => ({ ...prev, [task._id]: data }));
                  })
                }
              >
                <BarChart3 size={16} /> نمایش / به‌روزرسانی گزارش گروه
              </Button>
            )}
            {reports[task._id] && (
              <div data-testid="class-group-report" className="grid gap-2">
                {reports[task._id].students.map((person) => (
                  <div
                    key={person.assignmentId}
                    className="glass-option flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="text-sm">
                      <p className="font-bold">{person.studentName}</p>
                      <p className="text-slate-600">
                        {person.answered}/{person.total} پاسخ ·{" "}
                        {person.independent} درست مستقل ·{person.assisted} با
                        کمک · {person.pending} در انتظار بررسی
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const assignment = assignments.find(
                          (a) => a._id === person.assignmentId,
                        );
                        if (assignment) void showReport(assignment);
                      }}
                    >
                      گزارش اختصاصی
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
