"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  PlayCircle,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentJoinTeacher } from "@/features/students/join-teacher";
import { api } from "@/lib/api";
import { nextLearningGuidance } from "./learning-guidance";
import type {
  Assignment,
  DashboardCourse,
  DashboardMission,
  StudentDashboardData,
  User,
} from "@/lib/types";

const count = (n: number) => n.toLocaleString("fa-IR");

interface StudentLearningSnapshot {
  recentMissions: {
    assignmentId: string;
    title: string;
    state: string;
    total: number;
    answered: number;
    incorrect: number;
    independent: number;
    assisted: number;
    independentSuccessRate: number | null;
  }[];
  skills: {
    skillId: string;
    title: string;
    status: string;
    incorrect: number;
    supportingAttempts?: number;
    independentFirstAttempts?: number;
  }[];
  mistakes: { _id: string; status: string }[];
}

export function StudentOverview({
  me,
  data,
  assignments,
  busy,
  invitationToken,
  onJoined,
  open,
  showReport,
  setPage,
}: {
  me: User;
  data: StudentDashboardData | null;
  assignments: Assignment[];
  busy: boolean;
  invitationToken?: string;
  onJoined: () => Promise<void>;
  open: (assignment: Assignment) => Promise<void>;
  showReport: (assignment: Assignment) => Promise<void>;
  setPage: (page: string, contextId?: string) => void;
}) {
  const [selected, setSelected] = useState("all");
  const [learning, setLearning] = useState<StudentLearningSnapshot | null>(
    null,
  );
  const courseList = data?.courses ?? [];
  const selectedExists = courseList.some((c) => c.courseId === selected);
  const visibleCourses = selectedExists
    ? courseList.filter((c) => c.courseId === selected)
    : courseList;
  const legacyVisible = !selectedExists && !!data?.legacy.assignments;
  const byId = new Map(assignments.map((a) => [a._id, a]));
  const readyAssignments = assignments.filter((assignment) =>
    ["published", "in_progress"].includes(assignment.state),
  );
  const nextAssignment =
    readyAssignments.find((assignment) => assignment.state === "in_progress") ??
    readyAssignments[0];
  const nextCourse = courseList.find(
    (course) => course.courseId === nextAssignment?.courseId,
  );
  const allMissions = [
    ...courseList.flatMap((course) => course.missions),
    ...(data?.legacy.missions ?? []),
  ];
  const upcomingMissions = allMissions
    .filter((mission) => {
      if (
        !mission.dueAt ||
        !["published", "in_progress"].includes(mission.state)
      )
        return false;
      const remaining = new Date(mission.dueAt).getTime() - Date.now();
      return remaining >= 0 && remaining <= 7 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .slice(0, 3);
  const freshMissions = allMissions
    .filter((mission) => ["published", "in_progress"].includes(mission.state))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 3);
  const reviewSkills = (learning?.skills ?? [])
    .filter(
      (skill) =>
        skill.incorrect > 0 ||
        ["needs_review", "needs_practice", "developing"].includes(skill.status),
    )
    .sort((a, b) => b.incorrect - a.incorrect)
    .slice(0, 3);
  const guidance = learning ? nextLearningGuidance(learning.skills, readyAssignments.length > 0) : null;
  const latestResult = learning?.recentMissions.find(
    (mission) => mission.answered > 0,
  );
  const previousResult = learning?.recentMissions.find(
    (mission) =>
      mission.assignmentId !== latestResult?.assignmentId &&
      mission.answered > 0,
  );

  useEffect(() => {
    let current = true;
    api<StudentLearningSnapshot>(`/students/${me._id}/progress`)
      .then((result) => {
        if (current) setLearning(result);
      })
      .catch(() => {
        if (current) setLearning(null);
      });
    return () => {
      current = false;
    };
  }, [me._id, data]);

  function missionRow(mission: DashboardMission) {
    const assignment = byId.get(mission._id);
    if (!assignment) return null;
    const active = ["published", "in_progress"].includes(mission.state);
    const state =
      mission.state === "completed"
        ? "تکمیل‌شده"
        : mission.state === "submitted"
          ? "در انتظار بررسی"
          : mission.state === "cancelled"
            ? "لغوشده"
            : mission.state === "in_progress"
              ? "در حال انجام"
              : "آماده شروع";
    return (
      <div
        key={mission._id}
        className="glass-option flex flex-wrap items-center justify-between gap-3 p-3"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#17305e]">{mission.title}</p>
          <p className="mt-1 text-xs text-slate-600">{state}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {active && (
            <Button disabled={busy} onClick={() => void open(assignment)}>
              {mission.state === "in_progress" ? "ادامه تمرین" : "شروع تمرین"}
              <ArrowLeft size={15} aria-hidden />
            </Button>
          )}
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void showReport(assignment)}
          >
            گزارش
          </Button>
        </div>
      </div>
    );
  }

  function courseCard(course: DashboardCourse) {
    const percentage = course.assignments
      ? Math.round((course.completed / course.assignments) * 100)
      : 0;
    return (
      <article
        data-testid="student-course-card"
        key={course.courseId}
        className="glass-panel grid gap-4 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#E5F8F5] text-[#08796E]">
            <BookOpenCheck size={21} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-600">{course.subject}</p>
            <h3 className="text-lg font-bold">{course.title}</h3>
            <p className="mt-1 text-xs text-slate-600">
              معلم: {course.teacherName}
            </p>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex justify-between gap-2 text-sm">
            <span>تکمیل مأموریت‌ها</span>
            <strong>
              {count(course.completed)} از {count(course.assignments)}
            </strong>
          </div>
          <div
            role="progressbar"
            aria-label={`تکمیل مأموریت‌های ${course.title}`}
            aria-valuenow={course.completed}
            aria-valuemin={0}
            aria-valuemax={Math.max(1, course.assignments)}
            className="h-2.5 overflow-hidden rounded-full bg-[#E9EEF7]"
          >
            <div
              className="h-full rounded-full bg-[#2EC8C3]"
              style={{ width: percentage + "%" }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="glass-note p-3">
            <p className="text-xs text-slate-600">سؤال‌های پاسخ‌داده‌شده</p>
            <strong>
              {count(course.answeredQuestions)} از{" "}
              {count(course.assignedQuestions)}
            </strong>
          </div>
          <div className="glass-note p-3">
            <p className="text-xs text-slate-600">درست بدون کمک / با کمک</p>
            <strong>
              {count(course.correctIndependent)} /{" "}
              {count(course.correctAssisted)}
            </strong>
          </div>
        </div>
        <p className="text-xs leading-loose text-slate-600">
          {course.pendingReview
            ? `${count(course.pendingReview)} پاسخ در انتظار ارزیابی · `
            : ""}
          {count(course.evaluatedQuestions)} پاسخ ارزیابی‌شده؛ این اعداد
          نشان‌دهنده شواهد تمرین‌اند، نه درصد تسلط قطعی.
        </p>
        <Button onClick={() => setPage("student-course", course.courseId)}>
          صفحه جامع درس
        </Button>
      </article>
    );
  }

  return (
    <div className="hy-student-home grid gap-7">
      <section className="hy-home-spotlight" aria-label="قدم بعدی یادگیری">
        <div className="hy-home-spotlight-main">
          <span className="hy-home-eyebrow"><Sparkles size={15} aria-hidden /> مسیر یادگیری تو</span>
          <p className="hy-home-welcome">سلام {me.name} <span aria-hidden>👋</span></p>
          <h1 className="hy-home-title">
            {nextAssignment
              ? nextAssignment.state === "in_progress"
                ? "از همان‌جایی ادامه بده که مانده بودی"
                : "آماده‌ای یک قدم جلوتر بروی؟"
              : "امروز چه چیزی یاد می‌گیریم؟"}
          </h1>
          <p className="hy-home-lead">
            {nextAssignment
              ? "لازم نیست بین صفحه‌ها بگردی؛ قدم بعدی یادگیری همین‌جاست."
              : "برای شروع، یک درس یا تمرین انتخاب کن. هدهد قدم‌به‌قدم همراه توست."}
          </p>
          <div className="hy-home-main-action">
            <div className="min-w-0">
              <span className="hy-home-action-label">{nextAssignment ? "پیشنهاد ویژه‌ی تو" : "نقطه‌ی شروع"}</span>
              <h2 className="hy-home-action-title">{nextAssignment?.title ?? "پیدا کردن اولین تمرین"}</h2>
              {nextAssignment && (
                <p className="hy-home-action-context">
                  {nextCourse?.title ?? "مأموریت معلم"} · {nextAssignment.state === "in_progress" ? "نیمه‌تمام" : "آماده‌ی شروع"}
                </p>
              )}
            </div>
            <Button
              className="hy-home-primary-button"
              disabled={busy}
              onClick={() => nextAssignment ? void open(nextAssignment) : setPage("student-practice")}
            >
              {nextAssignment ? nextAssignment.state === "in_progress" ? "ادامه‌ی تمرین" : "شروع تمرین" : "کاوش تمرین‌ها"}
              <ArrowLeft size={18} aria-hidden />
            </Button>
          </div>
        </div>
        <div className="hy-home-spotlight-aside">
          <div className="hy-home-aside-illustration" aria-hidden="true">
            <div className="hy-home-orbit hy-home-orbit-one" />
            <div className="hy-home-orbit hy-home-orbit-two" />
            <span className="hy-home-orbit-icon"><BookOpenCheck size={43} strokeWidth={1.6} /></span>
            <span className="hy-home-orbit-star hy-home-orbit-star-one">✦</span>
            <span className="hy-home-orbit-star hy-home-orbit-star-two">✧</span>
          </div>
          <button type="button" onClick={() => setPage("student-search")} className="hy-home-search-link">
            <Search size={17} aria-hidden /> دنبال درس یا مبحث خاصی هستی؟
            <ArrowLeft size={16} aria-hidden />
          </button>
        </div>
      </section>
      {guidance && (
        <section aria-label="پیشنهاد شخصی یادگیری" className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 via-white to-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-800">بر پایه‌ی پاسخ‌های واقعی تو · قدم پیشنهادی بعدی</p>
              <h2 className="mt-2 text-lg font-extrabold text-[#17305e]">{guidance.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{guidance.description}</p>
            </div>
            <Button className="shrink-0" onClick={() => setPage(guidance.destination)}>
              {guidance.kind === "review" ? "مرور اشتباهات" : "رفتن به تمرین‌ها"}
              <ArrowLeft size={17} aria-hidden />
            </Button>
          </div>
        </section>
      )}
      {!data ? (
        <section className="glass-panel p-6" role="status">
          در حال آماده‌سازی نمای درس‌ها و شواهد تمرین…
        </section>
      ) : (
        <>
          <section
            aria-label="دسترسی سریع"
            className="hy-home-quick-links grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {[
              {
                label: "تمرین و آزمون",
                ariaLabel: "باز کردن تمرین‌های آماده",
                detail: `${count(readyAssignments.length)} تمرین آماده`,
                icon: PlayCircle,
                tone: "blue",
                page: "student-practice",
              },
              {
                label: "مأموریت‌های معلم",
                ariaLabel: "باز کردن تکلیف‌های من",
                detail: `${count(data.summary.assignments)} مأموریت`,
                icon: Target,
                tone: "amber",
                page: "student-missions",
              },
              {
                label: "مرور اشتباهات",
                ariaLabel: "باز کردن مرور اشتباهات",
                detail: "تمرین دوباره و اصلاح",
                icon: RotateCcw,
                tone: "rose",
                page: "student-mistakes",
              },
              {
                label: "پیشرفت من",
                ariaLabel: "باز کردن گزارش پیشرفت",
                detail: `${count(data.summary.completed)} مأموریت تکمیل‌شده`,
                icon: BarChart3,
                tone: "mint",
                page: "student-progress",
              },
            ].map((item) => (
              <button
                key={item.label}
                data-tone={item.tone}
                type="button"
                aria-label={item.ariaLabel}
                onClick={() => setPage(item.page)}
                className="hy-home-quick-link grid cursor-pointer gap-3 p-4 text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2457b8]"
              >
                <span className="hy-home-quick-icon"><item.icon size={22} aria-hidden /></span>
                <span>
                  <strong className="block text-sm">{item.label}</strong>
                  <small className="mt-1 block text-xs leading-6 text-slate-500">
                    {item.detail}
                  </small>
                </span>
              </button>
            ))}
          </section>
          <section
            aria-label="برنامه امروز"
            className="hy-home-daily grid gap-4 xl:grid-cols-2"
          >
            <article className="hy-home-daily-card glass-panel grid gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
                  <Clock3 size={20} aria-hidden />
                </span>
                <div>
                  <h2 className="font-bold">مأموریت‌های نزدیک به موعد</h2>
                  <p className="text-xs text-slate-600">
                    کارهایی که تا هفت روز آینده موعد دارند.
                  </p>
                </div>
              </div>
              {upcomingMissions.length ? (
                upcomingMissions.map((mission) => (
                  <div
                    key={mission._id}
                    className="glass-option flex items-center justify-between gap-3 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{mission.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        موعد{" "}
                        {new Date(mission.dueAt!).toLocaleDateString("fa-IR")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setPage("student-missions")}
                    >
                      مشاهده
                    </Button>
                  </div>
                ))
              ) : (
                <p className="glass-note p-4 text-sm text-slate-600">
                  در هفت روز آینده مأموریت موعدداری نداری.
                </p>
              )}
            </article>

            <article className="hy-home-daily-card glass-panel grid gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700">
                  <Sparkles size={20} aria-hidden />
                </span>
                <div>
                  <h2 className="font-bold">تمرین پیشنهادی هدهد</h2>
                  <p className="text-xs text-slate-600">
                    پیشنهاد بر پایه پاسخ‌ها و فعالیت واقعی تو.
                  </p>
                </div>
              </div>
              {reviewSkills[0] ? (
                <>
                  <div className="glass-note p-4">
                    <p className="text-xs text-slate-500">مرور پیشنهادی</p>
                    <p className="mt-1 font-bold">{reviewSkills[0].title}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      {count(reviewSkills[0].incorrect)} پاسخ نادرست ثبت‌شده
                    </p>
                  </div>
                  <Button onClick={() => setPage("student-mistakes")}>
                    شروع مرور <ArrowLeft size={16} aria-hidden />
                  </Button>
                </>
              ) : nextAssignment ? (
                <>
                  <p className="glass-note p-4 text-sm">
                    {nextAssignment.title}
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() => void open(nextAssignment)}
                  >
                    شروع تمرین <ArrowLeft size={16} aria-hidden />
                  </Button>
                </>
              ) : (
                <p className="glass-note p-4 text-sm text-slate-600">
                  هنوز شواهد کافی برای پیشنهاد تمرین نداریم.
                </p>
              )}
            </article>

            <article className="hy-home-daily-card glass-panel grid gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-700">
                  <AlertCircle size={20} aria-hidden />
                </span>
                <div>
                  <h2 className="font-bold">مباحث نیازمند مرور</h2>
                  <p className="text-xs text-slate-600">
                    مبحث‌هایی که در پاسخ‌ها نیاز به تمرین بیشتری نشان داده‌اند.
                  </p>
                </div>
              </div>
              {reviewSkills.length ? (
                <div className="grid gap-2">
                  {reviewSkills.map((skill) => (
                    <button
                      key={skill.skillId}
                      type="button"
                      onClick={() => setPage("student-mistakes")}
                      className="glass-option flex cursor-pointer items-center justify-between gap-3 p-3 text-right"
                    >
                      <span className="text-sm font-medium">{skill.title}</span>
                      <span className="text-xs text-slate-500">
                        {count(skill.incorrect)} خطا
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="glass-note p-4 text-sm text-slate-600">
                  فعلاً مبحث نیازمند مروری ثبت نشده است.
                </p>
              )}
            </article>

            <article className="hy-home-daily-card glass-panel grid gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <TrendingUp size={20} aria-hidden />
                </span>
                <div>
                  <h2 className="font-bold">آخرین نتیجه و روند پیشرفت</h2>
                  <p className="text-xs text-slate-600">
                    فقط بر پایه پاسخ‌های ارزیابی‌شده.
                  </p>
                </div>
              </div>
              {latestResult ? (
                <div className="grid gap-3">
                  <div className="glass-note p-4">
                    <p className="font-bold">{latestResult.title}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {count(latestResult.independent)} حل مستقل ·{" "}
                      {count(latestResult.assisted)} حل با کمک ·{" "}
                      {count(latestResult.incorrect)} نادرست
                    </p>
                  </div>
                  <p className="text-xs text-slate-600">
                    {previousResult
                      ? `نسبت به تمرین قبلی، تعداد حل مستقل ${latestResult.independent >= previousResult.independent ? "کم نشده" : "کمتر شده"} است.`
                      : "با انجام تمرین بعدی، روند مقایسه‌ای اینجا نمایش داده می‌شود."}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setPage("student-progress")}
                  >
                    مشاهده پیشرفت
                  </Button>
                </div>
              ) : (
                <p className="glass-note p-4 text-sm text-slate-600">
                  پس از ثبت نخستین پاسخ ارزیابی‌شده، نتیجه اینجا نمایش داده
                  می‌شود.
                </p>
              )}
            </article>
          </section>

          <section
            className="hy-home-fresh glass-panel grid gap-4 p-5 sm:p-6"
            aria-label="محتوای تازه برای درس‌های من"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">محتوای تازه برای درس‌های تو</h2>
                <p className="mt-1 text-xs text-slate-600">
                  فعالیت‌های تازه فقط از درس‌هایی که عضو آن‌ها هستی.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setPage("student-missions")}
              >
                مشاهده همه
              </Button>
            </div>
            {freshMissions.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {freshMissions.map((mission) => (
                  <button
                    key={mission._id}
                    type="button"
                    onClick={() => setPage("student-missions")}
                    className="glass-option grid cursor-pointer gap-2 p-4 text-right"
                  >
                    <span className="text-sm font-bold">{mission.title}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(mission.createdAt).toLocaleDateString("fa-IR")}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="glass-note p-4 text-sm text-slate-600">
                محتوای تازه‌ای برای درس‌های فعال تو منتشر نشده است.
              </p>
            )}
          </section>
          <section
            aria-label="خلاصه یادگیری"
            className="hy-home-stats grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {[
              {
                label: "درس‌های فعال",
                value: data.summary.activeCourses,
                icon: BookOpenCheck,
              },
              {
                label: "مأموریت‌ها",
                value: data.summary.assignments,
                icon: ClipboardList,
              },
              {
                label: "مأموریت‌های تکمیل‌شده",
                value: data.summary.completed,
                icon: CheckCircle2,
              },
              {
                label: "در انتظار بررسی",
                value: data.summary.awaitingReview,
                icon: ClipboardList,
              },
            ].map((item) => (
              <div key={item.label} className="hy-home-stat grid gap-2 p-4">
                <item.icon size={20} color="#1F3F97" aria-hidden />
                <p className="text-xs text-slate-600">{item.label}</p>
                <strong className="text-2xl text-[#1F3F97]">
                  {count(item.value)}
                </strong>
              </div>
            ))}
          </section>
          {!data.summary.assignments && (
            <p className="glass-note p-4 text-sm leading-loose">
              هنوز مأموریتی نداری. اگر درسی فعال داری، پس از انتشار مأموریت توسط
              معلم اینجا نمایش داده می‌شود.
            </p>
          )}
          <section className="grid gap-4" aria-label="پیشرفت به تفکیک درس">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">درس‌های من</h2>
                <p className="mt-1 text-xs text-slate-600">
                  درس‌ها، مأموریت‌ها و پیشرفت هر درس در یک نگاه.
                </p>
              </div>
              {!!courseList.length && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  نمایش درس
                  <select
                    className="glass-field min-h-11 max-w-[220px] p-2"
                    value={selectedExists ? selected : "all"}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="all">همه درس‌ها</option>
                    {courseList.map((course) => (
                      <option key={course.courseId} value={course.courseId}>
                        {course.title} · {course.teacherName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {!courseList.length && (
              <p className="glass-panel p-5 text-sm leading-loose text-slate-600">
                هنوز عضو هیچ درسی نیستی. می‌توانی با کد دعوت مخصوص هر درس به
                معلم آن متصل شوی.
              </p>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleCourses.map(courseCard)}
            </div>
          </section>
          {legacyVisible && (
            <section
              className="glass-panel grid gap-3 p-5"
              data-testid="legacy-missions"
            >
              <h2 className="text-lg font-bold">
                مأموریت‌های قدیمی یا بدون درس
              </h2>
              <p className="text-xs leading-loose text-slate-600">
                این مأموریت‌ها به درس فعالی منتسب نشده‌اند و در آمار ریاضی،
                فیزیک یا سایر درس‌ها محاسبه نمی‌شوند.
              </p>
              <p className="text-sm">
                {count(data.legacy.completed)} تکمیل‌شده از{" "}
                {count(data.legacy.assignments)} مأموریت
              </p>
              {data.legacy.missions.slice(0, 5).map(missionRow)}
              {data.legacy.missions.length > 5 && (
                <Button variant="outline" onClick={() => setPage("missions")}>
                  مشاهده بقیه مأموریت‌ها
                </Button>
              )}
            </section>
          )}
        </>
      )}
      <StudentJoinTeacher
        invitationToken={invitationToken}
        onJoined={onJoined}
      />
    </div>
  );
}
