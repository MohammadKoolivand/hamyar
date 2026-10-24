"use client";

import { useState } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentJoinTeacher } from "@/features/students/join-teacher";
import type { Assignment, DashboardCourse, DashboardMission, StudentDashboardData, User } from "@/lib/types";

const count = (n: number) => n.toLocaleString("fa-IR");

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
  setPage: (page: string) => void;
}) {
  const [selected, setSelected] = useState("all");
  const courseList = data?.courses ?? [];
  const selectedExists = courseList.some((c) => c.courseId === selected);
  const visibleCourses = selectedExists
    ? courseList.filter((c) => c.courseId === selected)
    : courseList;
  const legacyVisible = !selectedExists && !!data?.legacy.assignments;
  const byId = new Map(assignments.map((a) => [a._id, a]));

  function missionRow(mission: DashboardMission) {
    const assignment = byId.get(mission._id);
    if (!assignment) return null;
    const active = ["published", "in_progress"].includes(mission.state);
    const state = mission.state === "completed"
      ? "تکمیل‌شده"
      : mission.state === "submitted"
        ? "در انتظار بررسی"
        : mission.state === "cancelled"
          ? "لغوشده"
          : mission.state === "in_progress"
            ? "در حال انجام"
            : "آماده شروع";
    return (
      <div key={mission._id} className="glass-option flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#1f2937]">{mission.title}</p>
          <p className="mt-1 text-xs text-slate-600">{state}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {active && (
            <Button disabled={busy} onClick={() => void open(assignment)}>
              {mission.state === "in_progress" ? "ادامه تمرین" : "شروع تمرین"}
              <ArrowLeft size={15} aria-hidden />
            </Button>
          )}
          <Button disabled={busy} variant="outline" onClick={() => void showReport(assignment)}>
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
      <article data-testid="student-course-card" key={course.courseId} className="glass-panel grid gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#E5F8F5] text-[#08796E]">
            <BookOpenCheck size={21} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-600">{course.subject}</p>
            <h3 className="text-lg font-bold">{course.title}</h3>
            <p className="mt-1 text-xs text-slate-600">معلم: {course.teacherName}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex justify-between gap-2 text-sm">
            <span>تکمیل مأموریت‌ها</span>
            <strong>{count(course.completed)} از {count(course.assignments)}</strong>
          </div>
          <div
            role="progressbar"
            aria-label={`تکمیل مأموریت‌های ${course.title}`}
            aria-valuenow={course.completed}
            aria-valuemin={0}
            aria-valuemax={Math.max(1, course.assignments)}
            className="h-2.5 overflow-hidden rounded-full bg-[#E9EEF7]"
          >
            <div className="h-full rounded-full bg-[#19B7AE]" style={{ width: percentage + "%" }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="glass-note p-3">
            <p className="text-xs text-slate-600">سؤال‌های پاسخ‌داده‌شده</p>
            <strong>{count(course.answeredQuestions)} از {count(course.assignedQuestions)}</strong>
          </div>
          <div className="glass-note p-3">
            <p className="text-xs text-slate-600">درست بدون کمک / با کمک</p>
            <strong>{count(course.correctIndependent)} / {count(course.correctAssisted)}</strong>
          </div>
        </div>
        <p className="text-xs leading-loose text-slate-600">
          {course.pendingReview
            ? `${count(course.pendingReview)} پاسخ در انتظار ارزیابی · `
            : ""}
          {count(course.evaluatedQuestions)} پاسخ ارزیابی‌شده؛ این اعداد نشان‌دهنده شواهد تمرین‌اند، نه درصد تسلط قطعی.
        </p>
        <div className="grid gap-2">
          <h4 className="font-medium">مأموریت‌های این درس</h4>
          {course.missions.length ? (
            <>
              {course.missions.slice(0, 3).map(missionRow)}
              {course.missions.length > 3 && (
                <Button variant="outline" onClick={() => setPage("missions")}>
                  مشاهده همه مأموریت‌ها
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600">هنوز مأموریتی برای این درس منتشر نشده است.</p>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="glass-hero flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8">
        <div className="grid gap-3">
          <span className="glass-kicker w-fit px-3 py-1.5 text-xs">یادگیری، قدم به قدم</span>
          <h2 className="text-[24px] font-bold text-[#1f2937]">سلام {me.name}، خوش آمدی</h2>
          <p className="max-w-2xl text-sm leading-loose text-slate-600">
            مأموریت‌های همه معلم‌ها را یکجا ببین و پیشرفت تمرین در هر درس را جداگانه دنبال کن.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPage("courses")}>
          مشاهده همه درس‌ها <ArrowLeft size={16} aria-hidden />
        </Button>
      </section>
      {!data ? (
        <section className="glass-panel p-6" role="status">در حال آماده‌سازی نمای درس‌ها و شواهد تمرین…</section>
      ) : (
        <>
          <section aria-label="خلاصه یادگیری" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "درس‌های فعال", value: data.summary.activeCourses, icon: BookOpenCheck },
              { label: "مأموریت‌ها", value: data.summary.assignments, icon: ClipboardList },
              { label: "مأموریت‌های تکمیل‌شده", value: data.summary.completed, icon: CheckCircle2 },
              { label: "در انتظار بررسی", value: data.summary.awaitingReview, icon: ClipboardList },
            ].map((item) => (
              <div key={item.label} className="glass-stat grid gap-2 p-4">
                <item.icon size={20} color="#233B8F" aria-hidden />
                <p className="text-xs text-slate-600">{item.label}</p>
                <strong className="text-2xl text-[#233B8F]">{count(item.value)}</strong>
              </div>
            ))}
          </section>
          {!data.summary.assignments && (
            <p className="glass-note p-4 text-sm leading-loose">
              هنوز مأموریتی نداری. اگر درسی فعال داری، پس از انتشار مأموریت توسط معلم اینجا نمایش داده می‌شود.
            </p>
          )}
          <section className="grid gap-4" aria-label="پیشرفت به تفکیک درس">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">پیشرفت به تفکیک درس</h2>
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
                هنوز عضو هیچ درسی نیستی. می‌توانی با کد دعوت مخصوص هر درس به معلم آن متصل شوی.
              </p>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleCourses.map(courseCard)}
            </div>
          </section>
          {legacyVisible && (
            <section className="glass-panel grid gap-3 p-5" data-testid="legacy-missions">
              <h2 className="text-lg font-bold">مأموریت‌های قدیمی یا بدون درس</h2>
              <p className="text-xs leading-loose text-slate-600">
                این مأموریت‌ها به درس فعالی منتسب نشده‌اند و در آمار ریاضی، فیزیک یا سایر درس‌ها محاسبه نمی‌شوند.
              </p>
              <p className="text-sm">
                {count(data.legacy.completed)} تکمیل‌شده از {count(data.legacy.assignments)} مأموریت
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
      <StudentJoinTeacher invitationToken={invitationToken} onJoined={onJoined} />
    </div>
  );
}
