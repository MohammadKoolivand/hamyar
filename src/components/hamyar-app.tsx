"use client";
import { AccessConsole } from "@/features/access/access-console";
import { AdminSystemOverviewScreen } from "@/features/access/admin-system-overview";
import { PublicQuestionBank } from "@/features/content/public-question-bank";
import React, { useState, useEffect } from "react";
import {
  Library,
  GraduationCap,
  NotebookPen,
  FolderOpen,
  FileUp,
  ChartNoAxesCombined,
  LogOut,
  UsersRound,
  Settings,
  Database,
  ChevronDown,
  UserRound,
} from "lucide-react";
import { Button } from "./ui/button";
import { Brand } from "./ui/brand";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { HeaderDropdownController } from "./header-dropdown-controller";
import type {
  User,
  Node,
  Question,
  Assignment,
  Report,
  Course,
  Enrollment,
  StudentDashboardData,
} from "@/lib/types";
import { practiceAnswer } from "@/lib/practice-answer";
import { api } from "@/lib/api";
import {
  assignmentFromSearch,
  courseFromSearch,
  pageFromPath,
  pathForPage,
} from "@/lib/app-routes";

import { AuthScreen } from "@/features/auth/auth-screen";
import { PracticeScreen } from "@/features/practice/practice-screen";
import { MissionReport } from "@/features/analytics/mission-report";
import { OverviewScreen } from "@/features/dashboard/dashboard-screen";
import { StudentOverview } from "@/features/dashboard/student-overview";
import { StudentCourseScreen } from "@/features/dashboard/student-course-screen";
import { StudentsScreen } from "@/features/students/students-screen";
import { AiSettingsScreen } from "@/features/settings/ai-settings-screen";
import { ContentScreen } from "@/features/content/content-screen";
import { ExamImportScreen } from "@/features/content/exam-import-screen";
import { MissionsScreen } from "@/features/missions/missions-screen";
import { ParentDashboard } from "@/features/analytics/parent-dashboard";
import { LearningDashboard } from "@/features/analytics/learning-dashboard";
import { CoursesScreen } from "@/features/courses/courses-screen";
import { ClassGroupsScreen } from "@/features/classes/class-groups-screen";
export default function HamyarApp() {
  const [me, setMe] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState("dashboard");
  const [courses, setCourses] = useState<Course[]>([]),
    [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [studentDashboard, setStudentDashboard] =
    useState<StudentDashboardData | null>(null);
  const [students, setStudents] = useState<User[]>([]),
    [nodes, setNodes] = useState<Node[]>([]),
    [questions, setQuestions] = useState<Question[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [drafts, setDrafts] = useState<
      { _id: string; title: string; state: string }[]
    >([]),
    [active, setActive] = useState<Assignment | null>(null),
    [report, setReport] = useState<Report | null>(null);
  const [token, setToken] = useState("");
  const [invitePhone, setInvitePhone] = useState(""),
    [inviteToken, setInviteToken] = useState("");
  const [nodeTitle, setNodeTitle] = useState(""),
    [nodeKind, setNodeKind] = useState("subject"),
    [parent, setParent] = useState("");
  const [topic, setTopic] = useState(""),
    [statement, setStatement] = useState(""),
    [qtype, setQtype] = useState("numeric"),
    [reference, setReference] = useState(""),
    [hints, setHints] = useState(""),
    [options, setOptions] = useState("");
  const [absoluteTolerance, setAbsoluteTolerance] = useState(0),
    [relativeTolerance, setRelativeTolerance] = useState(0),
    [mathVariables, setMathVariables] = useState("x"),
    [mathMode, setMathMode] = useState<"expression" | "equation">("expression"),
    [rubric, setRubric] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [hintAlternatives, setHintAlternatives] = useState(""),
    [maxHintLevel, setMaxHintLevel] = useState(3),
    [allowFullSolution, setAllowFullSolution] = useState(false);
  const [missionTitle, setMissionTitle] = useState(""),
    [student, setStudent] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [maxHints, setMaxHints] = useState(2),
    [maxAttempts, setMaxAttempts] = useState(3),
    [independent, setIndependent] = useState(false);
  const [qi, setQi] = useState(0),
    [answer, setAnswer] = useState("");
  async function refresh(u = me) {
    if (!u || u.role === "parent") return;
    if (u.role === "secretary") {
      const [n, q] = await Promise.all([
        api<Node[]>("/curriculum"),
        api<Question[]>("/questions"),
      ]);
      setNodes(n);
      setQuestions(q);
      return;
    }
    const [nextAssignments, nextCourses, nextEnrollments] = await Promise.all([
      api<Assignment[]>("/assignments"),
      api<Course[]>("/courses"),
      api<Enrollment[]>("/enrollments"),
    ]);
    setAssignments(nextAssignments);
    setCourses(nextCourses);
    setEnrollments(nextEnrollments);
    if (u.role === "student") {
      setStudentDashboard(
        await api<StudentDashboardData>("/student/dashboard"),
      );
    } else {
      setStudentDashboard(null);
    }
    if (u.role === "teacher" || u.role === "super_admin") {
      const [s, n, q, d] = await Promise.all([
        api<User[]>("/students"),
        api<Node[]>("/curriculum"),
        api<Question[]>("/questions"),
        api<typeof drafts>("/missions"),
      ]);
      setStudents(s);
      setNodes(n);
      setQuestions(q);
      setDrafts(d);
    }
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function navigatePage(
    nextPage: string,
    assignmentId?: string,
    replace = false,
  ) {
    const target = pathForPage(nextPage, assignmentId ?? active?._id);
    const current = window.location.pathname + window.location.search;
    if (current !== target) {
      if (replace)
        window.history.replaceState(window.history.state, "", target);
      else window.history.pushState(window.history.state, "", target);
    }
    setPage(nextPage);
    setError("");
  }

  async function restoreLocation(currentUser = me) {
    let next = pageFromPath(window.location.pathname);
    if (next === "admin-overview" && currentUser?.role !== "super_admin") {
      next = "dashboard";
      window.history.replaceState(window.history.state, "", "/dashboard");
    }
    if (currentUser?.role === "parent" && !["dashboard", "home", "public-bank"].includes(next)) {
      next = "dashboard";
      window.history.replaceState(window.history.state, "", "/dashboard");
    }
    if (currentUser?.role === "student") {
      if (
        ["student-practice", "student-search", "public-bank"].includes(next)
      ) {
        next = "dashboard";
        window.history.replaceState(
          window.history.state,
          "",
          `/dashboard${window.location.search}`,
        );
      }
      if (next === "missions") next = "student-missions";
      if (next === "learning") next = "student-progress";
    }
    if (
      currentUser?.role === "teacher" &&
      [
        "student-practice",
        "student-missions",
        "student-mistakes",
        "student-progress",
        "student-search",
      ].includes(next)
    ) {
      next = "dashboard";
      window.history.replaceState({}, "", pathForPage(next));
    }
    if (next !== "practice" && next !== "report") {
      setPage(next);
      return;
    }
    const assignmentId = assignmentFromSearch(window.location.search);
    if (!assignmentId) {
      window.history.replaceState(window.history.state, "", "/homeworks");
      setPage("missions");
      return;
    }
    try {
      const detail = await api<Assignment>("/assignments/" + assignmentId);
      setActive(detail);
      setQi(0);
      setAnswer(
        practiceAnswer(detail, detail.questions?.[0]?._id ?? "", localStorage),
      );
      if (next === "report") {
        setReport(
          await api<Report>("/assignments/" + assignmentId + "/report"),
        );
      } else {
        setReport(null);
      }
      setPage(next);
    } catch {
      // An expired/deleted or unauthorized deep link cannot show another user's data.
      window.history.replaceState(window.history.state, "", "/homeworks");
      setActive(null);
      setReport(null);
      setPage("missions");
      setError("این تمرین یا گزارش در دسترس نیست.");
    }
  }

  useEffect(() => {
    const handleHistory = () => {
      void restoreLocation();
    };
    window.addEventListener("popstate", handleHistory);
    const sessionCheck = api<User>("/auth/me");
    sessionCheck
      .then(async (u) => {
        setMe(u);
        await refresh(u);
        await restoreLocation(u);
      })
      .catch(() => {
        setPage(pageFromPath(window.location.pathname));
      })
      .finally(() => setLoading(false));
    const invitation = new URLSearchParams(window.location.search).get(
      "invite",
    );
    if (invitation) setToken(invitation);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => window.removeEventListener("popstate", handleHistory);
  }, []); // initial session hydration
  async function logout() {
    await api("/auth/logout", {});
    Object.keys(localStorage)
      .filter((k) => k.startsWith("draft:" + me!._id + ":"))
      .forEach((k) => localStorage.removeItem(k));
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("mutation:"))
      .forEach((k) => sessionStorage.removeItem(k));
    // A new document discards every in-memory private form/report, including unpublished references.
    window.location.replace("/");
  }
  async function open(a: Assignment) {
    await run(async () => {
      const detail = await api<Assignment>("/assignments/" + a._id);
      setActive(detail);
      setReport(null);
      setQi(0);
      setAnswer(practiceAnswer(detail, detail.questions![0]._id, localStorage));
      navigatePage("practice", detail._id);
    });
  }
  async function reloadActive() {
    if (active) setActive(await api("/assignments/" + active._id));
    await refresh();
  }
  async function showReport(a: Assignment) {
    await run(async () => {
      setActive(await api("/assignments/" + a._id));
      setReport(await api("/assignments/" + a._id + "/report"));
      navigatePage("report", a._id);
    });
  }
  if (loading)
    return (
      <div
        role="status"
        className="flex min-h-[70vh] flex-col items-center justify-center gap-6 bg-white"
        aria-live="polite"
      >
        <Brand />
        <span
          className="relative flex size-12 items-center justify-center"
          aria-hidden="true"
        >
          <span className="absolute inset-0 rounded-full border-[3px] border-slate-100" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-teal-500 border-r-amber-400 motion-reduce:animate-none" />
          <span className="size-2 rounded-full bg-teal-500" />
        </span>
        <span className="sr-only">در حال بارگذاری هدهد</span>
      </div>
    );
  const feedback = (
    <>
      {error && (
        <div
          role="alert"
          className="bg-rose-50 text-rose-800 rounded-[14px] p-3.5 leading-[1.9]"
        >
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="glass-note p-3.5 leading-[1.9]">
          {notice}
        </div>
      )}
    </>
  );
  if (!me) {
    const publicPage = [
      "dashboard",
      "home",
      "student-practice",
      "student-search",
      "public-bank",
    ].includes(page);
    return (
      <div className="hy-student-site hy-site-shell min-h-screen" dir="rtl">
        <header className="hy-student-site-header sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-5 py-3 md:flex-nowrap lg:px-8">
            <button
              aria-label="خانه‌ی هدهد"
              className="shrink-0 cursor-pointer"
              onClick={() => navigatePage("home")}
            >
              <Brand />
            </button>
            <nav
              aria-label="بخش‌های اصلی"
              className="order-3 hidden w-full gap-1 overflow-x-auto border-t border-slate-100 pt-2 md:order-none md:flex md:w-auto md:flex-1 md:border-0 md:pt-0"
            >
              <button
                data-active={publicPage}
                className="hy-student-nav-link hy-nav-illustrated flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600"
                onClick={() => navigatePage("home")}
              >
                <Library size={17} aria-hidden />
                تمرین و نمونه‌سؤال
              </button>
              <button
                data-active={page === "courses"}
                className="hy-student-nav-link hy-nav-illustrated flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600"
                onClick={() => navigatePage("courses")}
              >
                <GraduationCap size={18} aria-hidden />
                معلم و درس‌های من
              </button>
            </nav>
            <Button
              className="ms-auto hidden shrink-0 md:inline-flex"
              variant="outline"
              onClick={() => navigatePage("login")}
            >
              ورود / ثبت‌نام
            </Button>
          </div>
        </header>
        <main className="hy-site-main mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {publicPage ? (
            <PublicQuestionBank home onLogin={() => navigatePage("login")} />
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => navigatePage("home")}
              >
                ادامه‌ی مرور بدون ورود
              </Button>
              <AuthScreen />
            </>
          )}
        </main>
        <MobileBottomNav role="guest" page={page} onNavigate={navigatePage} />
      </div>
    );
  }
  if (me.role === "parent")
    return (
      <div className="hy-student-site hy-site-shell min-h-screen" dir="rtl">
        <HeaderDropdownController />
        <header className="hy-student-site-header sticky top-0 z-40 border-b border-slate-200/80 bg-white/95">
          <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
            <button type="button" onClick={() => navigatePage("home")} className="shrink-0" aria-label="خانه هدهد">
              <Brand />
            </button>
            <nav aria-label="بخش‌های اصلی" className="hidden flex-1 gap-2 md:flex">
              <button type="button" onClick={() => navigatePage("home")} data-active={page === "home" || page === "public-bank"} className="hy-student-nav-link rounded-xl px-4 py-2 text-sm">تمرین و نمونه‌سؤال</button>
              <button type="button" onClick={() => navigatePage("dashboard")} data-active={page === "dashboard"} className="hy-student-nav-link rounded-xl px-4 py-2 text-sm">گزارش فرزند</button>
            </nav>
            <details className="hy-header-menu relative ms-auto">
              <summary aria-label="پروفایل کاربر" className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 pe-3 shadow-sm">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#e3f4ee] font-bold text-[#10766f]">{me.name.trim().charAt(0)}</span>
                <span className="hidden text-xs font-bold sm:block">{me.name}</span>
                <ChevronDown size={15} />
              </summary>
              <div className="hy-header-dropdown absolute left-0 top-full z-50 mt-2 grid min-w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-3 py-2 text-xs text-slate-500">حساب والد</p>
                <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); navigatePage("dashboard"); }}>گزارش فرزند</button>
                <button type="button" className="!text-rose-700" onClick={() => void run(logout)}><LogOut size={16} /> خروج از حساب</button>
              </div>
            </details>
          </div>
        </header>
        <main className="hy-site-main mx-auto grid w-full max-w-[1440px] gap-5 px-4 py-6 sm:px-6 lg:px-8">
          {page === "home" ? <PublicQuestionBank home signedIn /> : page === "public-bank" ? <PublicQuestionBank /> : <ParentDashboard me={me} />}
        </main>
        <MobileBottomNav role="parent" page={page} onNavigate={navigatePage} />
      </div>
    );
  const teacher = ["teacher", "super_admin", "secretary"].includes(me.role);
  const educator = ["teacher", "super_admin"].includes(me.role);
  const pageTitles: Record<string, string> = {
    dashboard: teacher ? "نمای کلی" : "تمرین و نمونه‌سؤال",
    home: "انتخاب نمونه‌سؤال",
    "public-bank": "بانک سؤال عمومی",
    courses: "معلم و درس‌های من",
    students: "دانش‌آموزان",
    classes: "کلاس‌های گروهی",
    content: "بانک سؤال و محتوا",
    "content-new": "افزودن سؤال",
    "exam-import": "ورود آزمون",
    resources: "منابع آموزشی",
    missions: "مأموریت‌ها",
    "student-missions": "مأموریت‌های معلم",
    learning: "یادگیری و مرور",
    "student-progress": "پیشرفت من",
    "student-mistakes": "مرور اشتباهات",
    "student-search": "جست‌وجو",
    settings: "تنظیمات",
    "admin-overview": "آمار سامانه",
    access: "مدیریت دسترسی‌ها",
    report: "گزارش عملکرد",
    "student-course": "صفحه درس",
    practice: "محیط تمرین",
  };
  const currentTitle = pageTitles[page] ?? "هدهد";
  const roleLabel =
    me.role === "super_admin" ? "مدیر سامانه" :
    me.role === "secretary" ? "همکار اجرایی" :
    me.role === "student" ? "دانش‌آموز" : "معلم";
  function navigateFromMenu(event: React.MouseEvent<HTMLButtonElement>, nextPage: string) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    navigatePage(nextPage);
  }
  return (
    <div className="hy-student-site hy-site-shell min-h-screen" dir="rtl">
      <HeaderDropdownController />
      <header className="hy-student-site-header sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
          <button
            type="button"
            onClick={() => navigatePage("home")}
            className="shrink-0 cursor-pointer"
            aria-label="رفتن به خانه هدهد"
          >
            <Brand />
          </button>
          <nav aria-label="بخش‌های اصلی" className="order-3 hidden min-w-0 w-full flex-1 items-center gap-1 border-t border-slate-100 pt-2 md:order-none md:flex md:w-auto md:flex-wrap md:overflow-visible md:border-0 md:pt-0">
            <button
              type="button"
              onClick={() => navigatePage("home")}
              data-active={page === "home" || page === "public-bank"}
              className="hy-student-nav-link hy-nav-illustrated flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600"
            >
              <Library size={17} aria-hidden />
              تمرین و نمونه‌سؤال
            </button>
            {me.role !== "secretary" && <button
              type="button"
              onClick={() => navigatePage("courses")}
              data-active={page === "courses" || page === "student-course"}
              className="hy-student-nav-link hy-nav-illustrated flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600"
            >
              <GraduationCap size={18} aria-hidden />
              معلم و درس‌های من
            </button>}
            {teacher && (
              <>
                {educator && <details className="hy-header-menu relative shrink-0">
                  <summary data-active={["students", "classes"].includes(page)} className="hy-student-nav-link hy-nav-illustrated flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600">
                    <UsersRound size={17} aria-hidden /> کلاس و دانش‌آموزان <ChevronDown size={14} />
                  </summary>
                  <div className="hy-header-dropdown absolute right-0 top-full z-50 mt-2 grid min-w-52 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <button type="button" onClick={(event) => navigateFromMenu(event, "students")}><UsersRound size={16} aria-hidden /> دانش‌آموزان</button>
                    <button type="button" onClick={(event) => navigateFromMenu(event, "classes")}><UsersRound size={16} aria-hidden /> کلاس‌های گروهی</button>
                  </div>
                </details>}
                <details className="hy-header-menu relative shrink-0">
                  <summary data-active={["content", "exam-import", "resources"].includes(page)} className="hy-student-nav-link hy-nav-illustrated flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600">
                    <FolderOpen size={18} aria-hidden /> محتوا و منابع <ChevronDown size={14} />
                  </summary>
                  <div className="hy-header-dropdown absolute right-0 top-full z-50 mt-2 grid min-w-56 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <button type="button" onClick={(event) => navigateFromMenu(event, "content")}><Library size={16} aria-hidden /> بانک سؤال و محتوا</button>
                    <button type="button" onClick={(event) => navigateFromMenu(event, "exam-import")}><FileUp size={16} aria-hidden /> ورود آزمون</button>
                    <button type="button" onClick={(event) => navigateFromMenu(event, "resources")}><FolderOpen size={16} aria-hidden /> منابع آموزشی</button>
                  </div>
                </details>
                {educator && <details className="hy-header-menu relative shrink-0">
                  <summary data-active={["missions", "learning"].includes(page)} className="hy-student-nav-link hy-nav-illustrated flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600">
                    <NotebookPen size={18} aria-hidden /> تمرین و تحلیل <ChevronDown size={14} />
                  </summary>
                  <div className="hy-header-dropdown absolute right-0 top-full z-50 mt-2 grid min-w-52 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <button type="button" onClick={(event) => navigateFromMenu(event, "missions")}><NotebookPen size={16} aria-hidden /> مأموریت‌ها</button>
                    <button type="button" onClick={(event) => navigateFromMenu(event, "learning")}><ChartNoAxesCombined size={16} aria-hidden /> یادگیری و مرور</button>
                  </div>
                </details>}
              </>
            )}
            {!teacher && me.role === "student" && (
              <details className="hy-header-menu relative shrink-0">
                <summary data-active={["student-missions", "student-mistakes", "student-progress"].includes(page)} className="hy-student-nav-link hy-nav-illustrated flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600">
                  <NotebookPen size={18} aria-hidden /> فعالیت‌های من <ChevronDown size={14} />
                </summary>
                <div className="hy-header-dropdown absolute right-0 top-full z-50 mt-2 grid min-w-52 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button type="button" onClick={(event) => navigateFromMenu(event, "student-missions")}><NotebookPen size={16} aria-hidden /> مأموریت‌های معلم</button>
                  <button type="button" onClick={(event) => navigateFromMenu(event, "student-mistakes")}><Library size={16} aria-hidden /> مرور اشتباهات</button>
                  <button type="button" onClick={(event) => navigateFromMenu(event, "student-progress")}><ChartNoAxesCombined size={16} aria-hidden /> پیشرفت من</button>
                </div>
              </details>
            )}
          </nav>
          <details className="hy-header-menu relative ms-auto shrink-0">
            <summary aria-label="پروفایل کاربر" className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 pe-3 shadow-sm hover:bg-slate-50">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#eaf3f2] text-sm font-bold text-[#147d78]">
                {me.name.trim().charAt(0) || <UserRound size={18} />}
              </span>
              <span className="hidden max-w-28 text-right text-xs font-semibold sm:block">{me.name}</span>
              <ChevronDown size={15} />
            </summary>
            <div className="hy-header-dropdown absolute left-0 top-full z-50 mt-2 grid min-w-56 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="font-bold">{me.name}</p>
                <p className="text-xs text-slate-500">{roleLabel}</p>
              </div>
              <button type="button" onClick={(event) => navigateFromMenu(event, "dashboard")}><ChartNoAxesCombined size={16} aria-hidden /> نمای کلی</button>
              {educator && <button type="button" onClick={(event) => navigateFromMenu(event, "settings")}><Settings size={15} /> تنظیمات</button>}
              {me.role === "super_admin" && (
                <>
                  <button type="button" onClick={(event) => navigateFromMenu(event, "admin-overview")}><Database size={15} /> آمار سامانه</button>
                  <button type="button" onClick={(event) => navigateFromMenu(event, "access")}><Settings size={15} /> مدیریت دسترسی‌ها</button>
                </>
              )}
              {me.role === "secretary" && <button type="button" onClick={(event) => navigateFromMenu(event, "access")}><Settings size={15} /> دسترسی‌های تفویض‌شده</button>}
              <button type="button" className="!text-rose-700" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void run(async () => { await logout(); }); }}><LogOut size={15} /> خروج از حساب</button>
            </div>
          </details>
        </div>
      </header>
      <main className="hy-site-main relative mx-auto grid w-full max-w-[1440px] min-w-0 content-start gap-[18px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        {page !== "home" && (teacher || page !== "dashboard") && (
          <header className="mb-1 flex items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <small className="text-xs text-slate-500">هدهد / {roleLabel}</small>
              <h1 className="mt-1 text-2xl font-bold text-[#17305E]">{currentTitle}</h1>
            </div>
          </header>
        )}
        {feedback}
        {(me.role === "super_admin" || me.role === "secretary") && page === "access" && (
          <AccessConsole me={me} onLogout={logout} />
        )}
        {me.role === "super_admin" && page === "admin-overview" && (
          <AdminSystemOverviewScreen />
        )}
        {page === "courses" && (
          <CoursesScreen
            teacher={teacher}
            courses={courses}
            enrollments={enrollments}
            assignments={assignments}
            students={students}
            refresh={() => refresh()}
            openCourse={(courseId) => navigatePage("student-course", courseId)}
          />
        )}
        {page === "student-course" && !teacher && (
          <StudentCourseScreen
            courseId={courseFromSearch(window.location.search)}
            data={studentDashboard}
            assignments={assignments}
            open={open}
            showReport={showReport}
            setPage={navigatePage}
          />
        )}
        {teacher && page === "classes" && (
          <ClassGroupsScreen
            courses={courses}
            enrollments={enrollments}
            students={students}
            questions={questions}
            assignments={assignments}
            refresh={() => refresh()}
            showReport={showReport}
          />
        )}
        {(page === "learning" || page === "student-progress") && (
          <LearningDashboard me={me} students={students} focus="progress" />
        )}
        {page === "student-mistakes" && !teacher && (
          <LearningDashboard me={me} students={students} focus="mistakes" />
        )}
        {((page === "dashboard" && teacher) ||
          (page === "courses" && !teacher)) &&
          (teacher ? (
            <OverviewScreen
              me={me}
              teacher={true}
              assignments={assignments}
              students={students}
              setPage={navigatePage}
            />
          ) : (
            <StudentOverview
              me={me}
              data={studentDashboard}
              assignments={assignments}
              busy={busy}
              setPage={navigatePage}
              open={open}
              showReport={showReport}
              invitationToken={token}
              onJoined={async () => {
                setToken("");
                const url = new URL(window.location.href);
                url.searchParams.delete("invite");
                window.history.replaceState(
                  window.history.state,
                  "",
                  url.pathname + url.search + url.hash,
                );
                await refresh();
              }}
            />
          ))}
        {page === "students" && teacher && (
          <StudentsScreen
            students={students}
            courses={courses}
            invitePhone={invitePhone}
            inviteToken={inviteToken}
            busy={busy}
            run={run}
            refresh={refresh}
            setInvitePhone={setInvitePhone}
            setInviteToken={setInviteToken}
          />
        )}
        {page === "home" && <PublicQuestionBank home signedIn />}
        {teacher && page === "public-bank" && <PublicQuestionBank />}
        {page === "settings" && teacher && <AiSettingsScreen />}
        {page === "exam-import" && teacher && (
          <ExamImportScreen nodes={nodes} onApproved={refresh} currentUserId={me._id} superAdmin={me.role === "super_admin"} />
        )}
        {["content", "content-new", "resources"].includes(page) && teacher && (
          <ContentScreen
            currentUserId={me._id}
            superAdmin={me.role === "super_admin"}
            key={page}
            view={
              page === "resources"
                ? "resources"
                : page === "content-new"
                  ? "add"
                  : "bank"
            }
            setNotice={setNotice}
            nodes={nodes}
            questions={questions}
            courses={courses}
            busy={busy}
            run={run}
            refresh={refresh}
            skillIds={skillIds}
            setSkillIds={setSkillIds}
            mathMode={mathMode}
            setMathMode={setMathMode}
            nodeTitle={nodeTitle}
            setNodeTitle={setNodeTitle}
            nodeKind={nodeKind}
            setNodeKind={setNodeKind}
            parent={parent}
            setParent={setParent}
            topic={topic}
            setTopic={setTopic}
            statement={statement}
            setStatement={setStatement}
            qtype={qtype}
            setQtype={setQtype}
            reference={reference}
            setReference={setReference}
            hints={hints}
            setHints={setHints}
            options={options}
            setOptions={setOptions}
            mathVariables={mathVariables}
            setMathVariables={setMathVariables}
            rubric={rubric}
            setRubric={setRubric}
            hintAlternatives={hintAlternatives}
            setHintAlternatives={setHintAlternatives}
            absoluteTolerance={absoluteTolerance}
            setAbsoluteTolerance={setAbsoluteTolerance}
            relativeTolerance={relativeTolerance}
            setRelativeTolerance={setRelativeTolerance}
          />
        )}
        {(page === "missions" || page === "student-missions") && (
          <MissionsScreen
            teacher={teacher}
            courses={courses}
            enrollments={enrollments}
            students={students}
            questions={questions}
            assignments={assignments}
            drafts={drafts}
            missionTitle={missionTitle}
            student={student}
            selected={selected}
            maxHints={maxHints}
            maxAttempts={maxAttempts}
            independent={independent}
            maxHintLevel={maxHintLevel}
            allowFullSolution={allowFullSolution}
            busy={busy}
            run={run}
            refresh={refresh}
            setMissionTitle={setMissionTitle}
            setStudent={setStudent}
            setSelected={setSelected}
            setMaxHints={setMaxHints}
            setMaxAttempts={setMaxAttempts}
            setIndependent={setIndependent}
            setMaxHintLevel={setMaxHintLevel}
            setAllowFullSolution={setAllowFullSolution}
            setNotice={setNotice}
            showReport={showReport}
            open={open}
          />
        )}
        {!teacher &&
          [
            "dashboard",
            "student-practice",
            "student-search",
            "public-bank",
          ].includes(page) && <PublicQuestionBank home signedIn />}
        {page === "practice" && active?.questions && (
          <PracticeScreen
            active={active}
            qi={qi}
            answer={answer}
            me={me}
            busy={busy}
            setAnswer={setAnswer}
            setQi={setQi}
            run={run}
            reloadActive={reloadActive}
            setNotice={setNotice}
            setActive={setActive}
            setReport={setReport}
            refresh={refresh}
            setPage={navigatePage}
          />
        )}
        {page === "report" && report && active && (
          <MissionReport
            active={active}
            report={report}
            teacher={teacher}
            busy={busy}
            onReview={(id, result, note) =>
              run(async () => {
                await api("/evaluations/" + id + "/review", { result, note });
                setReport(await api("/assignments/" + active._id + "/report"));
              })
            }
          />
        )}
        <footer className="text-xs leading-loose text-slate-500 p-5 text-center">
          هدهد · تمرین و تحلیل یادگیری تحت هدایت معلم · نسخه توسعه
        </footer>
      </main>
      <MobileBottomNav role={me.role} page={page} onNavigate={navigatePage} />
    </div>
  );
}
