"use client";
import { AccessConsole } from "@/features/access/access-console";
import { clsx } from "clsx";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Library,
  Target,
  LogOut,
  BarChart3,
  BookOpenCheck,
  FileUp,
  UsersRound,
  Settings,
  Search,
  ClipboardCheck,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/button";
import { Brand } from "./ui/brand";
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
import {
  StudentPracticeHub,
  StudentSearchScreen,
} from "@/features/dashboard/student-navigation-screens";
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
    if (!u || ["parent", "super_admin", "secretary"].includes(u.role)) return;
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
    if (u.role === "teacher") {
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
    if (currentUser?.role === "student") {
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
    // Local npm run dev only: request a real, cookie-backed demo session.
    // The server rejects this endpoint on staging/production or remote databases.
    const sessionCheck = api<User>("/auth/me").catch(async (error) => {
      if (process.env.NODE_ENV !== "development") throw error;
      return api<User>("/auth/dev-login", {});
    });
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
        className="mx-auto my-[7vh] max-w-[1020px] glass-note p-3.5 leading-[1.9]"
      >
        در حال اتصال به هدهد…
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
  if (!me) return <AuthScreen />;
  if (me.role === "super_admin" || me.role === "secretary")
    return <AccessConsole me={me} onLogout={logout} />;
  if (me.role === "parent")
    return <ParentDashboard me={me} onLogout={logout} />;
  const teacher = me.role === "teacher";
  const nav = teacher
    ? ([
        ["dashboard", "نمای کلی", LayoutDashboard],
        ["students", "دانش‌آموزان", Users],
        ["courses", "درس‌های من", BookOpenCheck],
        ["classes", "کلاس‌های گروهی", UsersRound],
        ["content", "بانک سؤال و محتوا", Library],
        ["exam-import", "ورود آزمون", FileUp],
        ["resources", "منابع آموزشی", BookOpenCheck],
        ["missions", "مأموریت‌ها", Target],
        ["learning", "یادگیری و مرور", BarChart3],
        ["settings", "تنظیمات", Settings],
      ] as const)
    : ([
        ["dashboard", "خانه", LayoutDashboard],
        ["courses", "درس‌های من", BookOpenCheck],
        ["student-practice", "تمرین و آزمون", ClipboardCheck],
        ["student-missions", "مأموریت‌های معلم", Target],
        ["student-mistakes", "مرور اشتباهات", RotateCcw],
        ["student-progress", "پیشرفت من", BarChart3],
        ["student-search", "جست‌وجو", Search],
      ] as const);
  const currentTitle =
    nav.find((n) => n[0] === page)?.[1] ??
    (page === "exam-import"
      ? "ورود آزمون"
      : page === "content-new"
        ? "افزودن سؤال"
        : page === "report"
          ? "گزارش عملکرد"
          : page === "student-course"
            ? "صفحه درس"
            : "محیط تمرین");
  return (
    <div
      className={clsx(
        "min-h-screen",
        !teacher && "hy-student-site",
        teacher &&
          "min-[651px]:grid min-[651px]:grid-cols-[max-content_minmax(0,1fr)]",
      )}
    >
      {teacher ? (
        <aside className="glass-sidebar min-w-0 min-[651px]:w-max min-[651px]:min-w-max mx-3 my-3 flex flex-col gap-6 px-4 py-6 min-[651px]:sticky min-[651px]:top-4 min-[651px]:max-h-[calc(100dvh-2rem)] min-[651px]:overflow-y-auto min-[951px]:mx-4 min-[951px]:my-4 min-[951px]:py-7 max-[650px]:gap-3 max-[650px]:p-4 max-[650px]:[&_nav]:flex max-[650px]:[&_nav]:overflow-x-auto max-[650px]:[&_footer]:hidden">
          <Brand showTagline />
          <small className="text-xs leading-loose text-slate-500">
            {teacher ? "فضای کار معلم" : "فضای تمرین دانش‌آموز"}
          </small>
          <nav className="grid gap-2 min-[651px]:[&_button]:whitespace-nowrap">
            {nav.map(([key, title, Icon]) => (
              <button
                key={key}
                onClick={() => navigatePage(key)}
                data-active={page === key}
                className={clsx(
                  "hy-navigation-item flex w-full cursor-pointer items-center gap-3 rounded-[15px] p-2.5 text-right motion-reduce:transition-none max-[650px]:whitespace-nowrap",
                  page === key && "font-bold",
                )}
              >
                <span
                  className="hy-icon-container !size-9 !rounded-xl"
                  data-tone={
                    key === "missions"
                      ? "gold"
                      : key === "students"
                        ? "teal"
                        : key === "learning"
                          ? "purple"
                          : "blue"
                  }
                >
                  <Icon size={18} aria-hidden />
                </span>
                {title}
              </button>
            ))}
          </nav>
          <footer className="grid gap-[18px] mt-auto">
            <div className="glass-note p-3.5 leading-[1.9]">
              <Sparkles size={18} />
              <small className="text-xs leading-loose text-slate-500">
                معلم آموزش می‌دهد،
                <br />
                هدهد راهنمایی می‌کند.
              </small>
            </div>
          </footer>
          <Button
            variant="outline"
            onClick={() =>
              run(async () => {
                await logout();
              })
            }
          >
            <LogOut size={16} />
            خروج
          </Button>
        </aside>
      ) : (
        <header className="hy-student-site-header sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-5 py-3 md:flex-nowrap lg:px-8">
            <button
              type="button"
              onClick={() => navigatePage("dashboard")}
              className="shrink-0 cursor-pointer"
              aria-label="رفتن به خانه هدهد"
            >
              <Brand />
            </button>
            <nav className="order-3 flex w-full gap-1 overflow-x-auto border-t border-slate-100 pt-2 md:order-none md:w-auto md:flex-1 md:border-0 md:pt-0">
              {nav.slice(0, 5).map(([key, title, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => navigatePage(key)}
                  data-active={page === key}
                  className="hy-student-nav-link flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600"
                >
                  <Icon size={17} aria-hidden />
                  {title}
                </button>
              ))}
            </nav>
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="hidden cursor-pointer rounded-xl px-3 py-2 text-right sm:block"
                onClick={() => navigatePage("student-progress")}
              >
                <span className="block text-sm font-bold">{me.name}</span>
                <span className="block text-xs text-slate-500">دانش‌آموز</span>
              </button>
              <Button
                variant="outline"
                aria-label="خروج"
                onClick={() =>
                  run(async () => {
                    await logout();
                  })
                }
              >
                <LogOut size={16} aria-hidden />
                <span className="hidden sm:inline">خروج</span>
              </Button>
            </div>
          </div>
        </header>
      )}
      <main
        className={clsx(
          "relative grid w-full min-w-0 content-start gap-[18px]",
          teacher
            ? "px-8 py-7 max-[950px]:p-6 max-[650px]:p-[18px]"
            : "mx-auto max-w-[1440px] px-5 py-6 lg:px-8 lg:py-9",
        )}
      >
        {teacher ? (
          <header className="glass-header mb-2 flex h-fit self-start items-center justify-between gap-3 px-4 py-2 sm:px-5 sm:py-2.5 max-[650px]:mb-2 max-[650px]:[&_h1]:text-[22px]">
            <div>
              <small className="text-xs leading-loose text-slate-500">
                هدهد / {teacher ? "پنل معلم" : "یادگیری"}
              </small>
              <h1 className="text-[28px] font-bold text-[#17305E]">
                {currentTitle}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="hy-icon-container !size-[46px]"
                data-tone="purple"
              >
                <img
                  src="/app-icon.svg"
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain"
                />
              </span>
              <div>
                <h3 className="text-base font-bold">{me.name}</h3>
                <small className="text-xs leading-loose text-slate-500">
                  {teacher ? "معلم" : "دانش‌آموز"}
                </small>
              </div>
            </div>
          </header>
        ) : page !== "dashboard" ? (
          <header className="flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <small className="text-xs text-slate-500">هدهد / یادگیری</small>
              <h1 className="mt-1 text-2xl font-bold text-[#17305E]">
                {currentTitle}
              </h1>
            </div>
          </header>
        ) : null}
        {feedback}
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
        {page === "dashboard" &&
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
        {page === "settings" && teacher && <AiSettingsScreen />}
        {page === "exam-import" && teacher && (
          <ExamImportScreen nodes={nodes} onApproved={refresh} />
        )}
        {["content", "content-new", "resources"].includes(page) && teacher && (
          <ContentScreen
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
        {page === "student-practice" && !teacher && (
          <StudentPracticeHub
            assignments={assignments}
            courses={courses}
            nodes={studentDashboard?.content?.nodes ?? []}
            busy={busy}
            open={open}
            showReport={showReport}
            setPage={navigatePage}
          />
        )}
        {page === "student-search" && !teacher && (
          <StudentSearchScreen
            assignments={assignments}
            courses={courses}
            nodes={studentDashboard?.content?.nodes ?? []}
            contentItems={studentDashboard?.content?.items ?? []}
            busy={busy}
            open={open}
            showReport={showReport}
            setPage={navigatePage}
          />
        )}
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
    </div>
  );
}
