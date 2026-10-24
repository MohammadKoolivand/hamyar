"use client";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { fa, stateLabel } from "@/lib/presentation";
import type { User, Question, Assignment } from "@/lib/types";
import { ArrowLeft, Target, BarChart3 } from "lucide-react";
export function MissionsScreen({
  teacher,
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
  return (
    <>
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
                  questionVersionIds: selected,
                  policy: {
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
              <Field title="دانش‌آموز">
                <select
                  required
                  value={student}
                  onChange={(e) => setStudent(e.target.value)}
                  className="w-full min-h-[46px] glass-field p-3"
                >
                  <option value="">انتخاب دانش‌آموز</option>
                  {students.map((s) => (
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
            <label className="flex-row items-center flex gap-2 text-[13px] text-slate-600">
              <input
                type="checkbox"
                checked={independent}
                onChange={(e) => setIndependent(e.target.checked)}
                className="size-5 min-h-5 shrink-0 cursor-pointer accent-[#233b8f]"
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
            {questions.map((q) => (
              <label
                key={q._id}
                className="flex-row items-center glass-option p-[18px] flex gap-2 text-[13px] text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(q._id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, q._id]
                        : selected.filter((x) => x !== q._id),
                    )
                  }
                  className="size-5 min-h-5 shrink-0 cursor-pointer accent-[#233b8f]"
                />
                {q.statement}
              </label>
            ))}
            {!questions.length && (
              <p className="text-xs leading-loose text-slate-500">
                ابتدا از بانک سؤال، سؤال اضافه کنید.
              </p>
            )}
            <Button
              disabled={busy || !selected.length}
              className="justify-self-start"
            >
              ساخت پیش‌نویس مأموریت
            </Button>
          </form>
          {drafts
            .filter((d) => d.state === "draft")
            .map((d) => (
              <div
                key={d._id}
                className="glass-option p-[18px] flex flex-wrap items-center gap-3"
              >
                <h3 className="text-base font-bold">{d.title}</h3>
                <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
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
            ))}
        </section>
      )}
      <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <Target color="#19b7ae" />
          <h2 className="text-[19px] font-bold">مأموریت‌های منتشرشده</h2>
        </div>
        {!assignments.length && (
          <p className="p-[30px] text-center leading-loose text-slate-500">
            هنوز مأموریتی منتشر نشده است.
          </p>
        )}
        {assignments.map((a) => (
          <div
            key={a._id}
            className="grid gap-3 glass-option p-[18px]"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-bold">{a.title}</h3>
              <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
                {stateLabel[a.state]}
              </span>
            </div>
            <small className="text-xs leading-loose text-slate-500">
              {teacher
                ? students.find((s) => s._id === a.studentId)?.name
                : "تمرین زیر نظر معلم"}{" "}
              ·{" "}
              {a.policy.independent
                ? "سنجش مستقل"
                : `تا ${fa(a.policy.maxHints)} راهنمایی برای هر سؤال`}
            </small>
            <div className="flex flex-wrap items-center gap-3">
              {!teacher &&
                !["completed", "submitted", "cancelled"].includes(a.state) && (
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
        ))}
      </section>
    </>
  );
}
