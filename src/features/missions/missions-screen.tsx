"use client";
import { PagedList } from "@/components/ui/paged-list";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { QuestionPicker } from "@/features/content/question-picker";
import { IndividualRemediation } from "./individual-remediation";
import { fa, stateLabel } from "@/lib/presentation";
import type {
  User,
  Question,
  Assignment,
  Course,
  Enrollment,
} from "@/lib/types";
import { ArrowLeft, Target, BarChart3 } from "lucide-react";
export function MissionsScreen({
  teacher,
  courses,
  enrollments,
  students,
  questions,
  assignments,
  drafts,
  missionTitle,
  student,
  selected,
  maxHints,
  maxAttempts,
  independent,
  maxHintLevel,
  allowFullSolution,
  busy,
  run,
  refresh,
  setMissionTitle,
  setStudent,
  setSelected,
  setMaxHints,
  setMaxAttempts,
  setIndependent,
  setMaxHintLevel,
  setAllowFullSolution,
  setNotice,
  showReport,
  open,
}: {
  teacher: boolean;
  courses: Course[];
  enrollments: Enrollment[];
  students: User[];
  questions: Question[];
  assignments: Assignment[];
  drafts: { _id: string; title: string; state: string }[];
  missionTitle: string;
  student: string;
  selected: string[];
  maxHints: number;
  maxAttempts: number;
  independent: boolean;
  maxHintLevel: number;
  allowFullSolution: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  setMissionTitle: (v: string) => void;
  setStudent: (v: string) => void;
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  setMaxHints: (v: number) => void;
  setMaxAttempts: (v: number) => void;
  setIndependent: (v: boolean) => void;
  setMaxHintLevel: (v: number) => void;
  setAllowFullSolution: (v: boolean) => void;
  setNotice: (v: string) => void;
  showReport: (v: Assignment) => Promise<void>;
  open: (v: Assignment) => Promise<void>;
}) {
  const [feedbackMode, setFeedbackMode] = useState<"immediate" | "end">("end");
  const [courseId, setCourseId] = useState("");
  const allowedStudents = courseId
    ? students.filter((person) =>
        enrollments.some(
          (e) => e.courseId === courseId && e.studentId === person._id,
        ),
      )
    : students;
  return (
    <>
      {teacher && (
        <IndividualRemediation
          students={students}
          courses={courses}
          enrollments={enrollments}
          refresh={refresh}
        />
      )}
      {teacher && (
        <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
          <h2 className="text-[19px] font-bold">طراحی مأموریت تمرینی</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("/missions", {
                  title: missionTitle,
                  studentId: student,
                  ...(courseId ? { courseId } : {}),
                  questionVersionIds: selected,
                  policy: {
                    feedbackMode,
                    maxHints,
                    maxAttempts,
                    independent,
                    maxHintLevel,
                    allowFullSolution,
                  },
                });
                setMissionTitle("");
                setSelected([]);
                await refresh();
                setNotice("پیش‌نویس ساخته شد؛ برای تخصیص، منتشر کنید.");
              });
            }}
            className="grid gap-[18px]"
          >
            <div className="grid gap-[22px] min-[951px]:grid-cols-2">
              <Field title="عنوان مأموریت">
                <input
                  required
                  value={missionTitle}
                  onChange={(e) => setMissionTitle(e.target.value)}
                  className="w-full min-h-[46px] glass-field p-3"
                />
              </Field>
              {!!courses.length && (
                <Field title="درس مأموریت">
                  <select
                    className="w-full min-h-[46px] glass-field p-3"
                    value={courseId}
                    onChange={(e) => {
                      setCourseId(e.target.value);
                      setStudent("");
                    }}
                  >
                    <option value="">بدون درس (مأموریت قدیمی)</option>
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.title} · {c.subject}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field title="دانش‌آموز">
                <select
                  required
                  value={student}
                  onChange={(e) => setStudent(e.target.value)}
                  className="w-full min-h-[46px] glass-field p-3"
                >
                  <option value="">انتخاب دانش‌آموز</option>
                  {allowedStudents.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title="حداکثر تلاش هر سؤال">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  className="w-full min-h-[46px] glass-field p-3"
                />
              </Field>
              <Field title="حداکثر راهنمایی هر سؤال">
                <input
                  type="number"
                  min={0}
                  max={3}
                  disabled={independent}
                  value={maxHints}
                  onChange={(e) => setMaxHints(Number(e.target.value))}
                  className="w-full min-h-[46px] glass-field p-3"
                />
              </Field>
            </div>
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
            <label className="flex-row items-center flex gap-2 text-[13px] text-slate-600">
              <input
                type="checkbox"
                checked={independent}
                onChange={(e) => setIndependent(e.target.checked)}
                className="size-5 min-h-5 shrink-0 cursor-pointer accent-[#1f3f97]"
              />
              سنجش مستقل (راهنمایی در سرور غیرفعال می‌شود)
            </label>
            <Field title="حداکثر سطح راهنمایی">
              <select
                value={maxHintLevel}
                onChange={(e) => {
                  setMaxHintLevel(Number(e.target.value));
                  setAllowFullSolution(false);
                }}
                className="min-h-11 glass-field p-3"
              >
                {[
                  "بدون کمک",
                  "سرنخ کوتاه",
                  "راهنمای مفهومی",
                  "بررسی روش حل",
                  "پاسخ کامل با مجوز جداگانه",
                ].map((title, level) => (
                  <option key={level} value={level}>
                    {title}
                  </option>
                ))}
              </select>
            </Field>
            {maxHintLevel === 4 && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowFullSolution}
                  onChange={(e) => setAllowFullSolution(e.target.checked)}
                />
                اجازه صریح نمایش پاسخ مرجع کامل
              </label>
            )}
            <h3 className="text-base font-bold">انتخاب سؤال از بانک معتبر</h3>
            <QuestionPicker
              onRefresh={refresh}
              questions={questions}
              selected={selected}
              onChange={setSelected}
              disabled={busy}
            />
            <Button
              disabled={busy || !selected.length}
              className="justify-self-start"
            >
              ساخت پیش‌نویس مأموریت
            </Button>
          </form>
          <PagedList
            items={drafts.filter((d) => d.state === "draft")}
            label="پیش‌نویس مأموریت"
          >
            {(d) => (
              <div
                key={d._id}
                className="glass-option p-[18px] flex flex-wrap items-center gap-3"
              >
                <h3 className="text-base font-bold">{d.title}</h3>
                <span className="inline-block rounded-full border border-[#2ec8c333] bg-[#2ec8c314] px-3 py-1.5 text-[11px] text-[#08746f]">
                  پیش‌نویس
                </span>
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/missions/" + d._id + "/publish", {});
                      await refresh();
                    })
                  }
                >
                  انتشار برای دانش‌آموز
                </Button>
              </div>
            )}
          </PagedList>
        </section>
      )}
      <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <Target color="#2ec8c3" />
          <h2 className="text-[19px] font-bold">مأموریت‌های منتشرشده</h2>
        </div>
        {!assignments.length && (
          <p className="p-[30px] text-center leading-loose text-slate-500">
            هنوز مأموریتی منتشر نشده است.
          </p>
        )}
        <PagedList items={assignments} label="مأموریت‌ها">
          {(a) => (
            <div key={a._id} className="grid gap-3 glass-option p-[18px]">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-bold">{a.title}</h3>
                <span className="inline-block rounded-full border border-[#2ec8c333] bg-[#2ec8c314] px-3 py-1.5 text-[11px] text-[#08746f]">
                  {stateLabel[a.state]}
                </span>
              </div>
              <small className="text-xs leading-loose text-slate-500">
                {teacher
                  ? students.find((s) => s._id === a.studentId)?.name
                  : "تمرین زیر نظر معلم"}{" "}
                {a.courseId
                  ? " · " +
                    (courses.find((c) => c._id === a.courseId)?.title ?? "درس")
                  : ""}{" "}
                ·{" "}
                {a.policy.independent
                  ? "سنجش مستقل"
                  : `تا ${fa(a.policy.maxHints)} راهنمایی برای هر سؤال`}
              </small>
              <div className="flex flex-wrap items-center gap-3">
                {!teacher &&
                  !["completed", "submitted", "cancelled"].includes(
                    a.state,
                  ) && (
                    <Button disabled={busy} onClick={() => open(a)}>
                      شروع / ادامه تمرین
                      <ArrowLeft size={16} />
                    </Button>
                  )}
                {teacher && !["completed", "cancelled"].includes(a.state) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api("/missions/" + a.missionId + "/cancel", {});
                        await refresh();
                      })
                    }
                  >
                    لغو مأموریت
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => showReport(a)}
                >
                  <BarChart3 size={16} />
                  گزارش و شواهد
                </Button>
              </div>
            </div>
          )}
        </PagedList>
      </section>
    </>
  );
}
