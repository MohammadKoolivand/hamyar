"use client";
import { clsx } from "clsx";

import React, { useState, useEffect, type FormEvent } from "react";
import {
  BookOpen,
  Sparkles,
  LayoutDashboard,
  Users,
  Library,
  Target,
  LogOut,
  GraduationCap,
  BarChart3,
  BookOpenCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import type { User, Node, Question, Assignment, Report, Course, Enrollment } from "@/lib/types";
import { api } from "@/lib/api";

import { AuthScreen } from "@/features/auth/auth-screen";
import { PracticeScreen } from "@/features/practice/practice-screen";
import { MissionReport } from "@/features/analytics/mission-report";
import { OverviewScreen } from "@/features/dashboard/dashboard-screen";
import { StudentsScreen } from "@/features/students/students-screen";
import { ContentScreen } from "@/features/content/content-screen";
import { MissionsScreen } from "@/features/missions/missions-screen";
import { ParentDashboard } from "@/features/analytics/parent-dashboard";
import { LearningDashboard } from "@/features/analytics/learning-dashboard";
import { CoursesScreen } from "@/features/courses/courses-screen";
export default function HamyarApp() {
  const [me, setMe] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState("dashboard");
  const [courses, setCourses] = useState<Course[]>([]),
    [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<User[]>([]),
    [nodes, setNodes] = useState<Node[]>([]),
    [questions, setQuestions] = useState<Question[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [drafts, setDrafts] = useState<
      { _id: string; title: string; state: string }[]
    >([]),
    [active, setActive] = useState<Assignment | null>(null),
    [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [token, setToken] = useState("");
  const [inviteEmail, setInviteEmail] = useState(""),
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
    const [nextAssignments, nextCourses, nextEnrollments] = await Promise.all([
      api<Assignment[]>("/assignments"),
      api<Course[]>("/courses"),
      api<Enrollment[]>("/enrollments"),
    ]);
    setAssignments(nextAssignments);
    setCourses(nextCourses);
    setEnrollments(nextEnrollments);
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
  useEffect(() => {
    api<User>("/auth/me")
      .then(async (u) => {
        setMe(u);
        await refresh(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    const invitation = new URLSearchParams(window.location.search).get(
      "invite",
    );
    if (invitation) {
      setToken(invitation);
      setMode("accept");
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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
  async function auth(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      if (mode !== "login") {
        if (mode === "accept") {
          await api("/invitations/accept", { name, email, password, token });
          setToken("");
          const url = new URL(window.location.href);
          url.searchParams.delete("invite");
          window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
          setNotice("دعوت پذیرفته شد. اکنون با همان حساب وارد شوید.");
        } else {
          await api("/auth/register", {
            name,
            email,
            password,
            role: mode === "register-student" ? "student" : "teacher",
          });
          setNotice("حساب ساخته شد. اکنون وارد شوید.");
        }
        setMode("login");
        return;
      }
      const u = await api<User>("/auth/login", { email, password });
      setMe(u);
      setPassword("");
      await refresh(u);
    });
  }
  async function open(a: Assignment) {
    await run(async () => {
      const detail = await api<Assignment>("/assignments/" + a._id);
      setActive(detail);
      setReport(null);
      setQi(0);
      setAnswer(
        localStorage.getItem(
          "draft:" + me!._id + ":" + a._id + ":" + detail.questions![0]._id,
        ) ?? "",
      );
      setPage("practice");
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
      setPage("report");
    });
  }
  if (loading)
    return (
      <div
        role="status"
        className="mx-auto my-[7vh] max-w-[1020px] glass-note p-3.5 leading-[1.9]"
      >
        در حال اتصال به همیار…
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
        <div
          role="status"
          className="glass-note p-3.5 leading-[1.9]"
        >
          {notice}
        </div>
      )}
    </>
  );
  if (!me)
    return (
      <AuthScreen
        mode={mode}
        name={name}
        email={email}
        password={password}
        token={token}
        busy={busy}
        feedback={feedback}
        auth={auth}
        setMode={setMode}
        setName={setName}
        setEmail={setEmail}
        setPassword={setPassword}
        setToken={setToken}
      />
    );
  if (me.role === "parent")
    return <ParentDashboard me={me} onLogout={logout} />;
  const teacher = me.role === "teacher";
  const nav = teacher
    ? ([
        ["dashboard", "نمای کلی", LayoutDashboard],
        ["students", "دانش‌آموزان", Users],
        ["courses", "درس‌های من", BookOpenCheck],
        ["content", "بانک سؤال و محتوا", Library],
        ["missions", "مأموریت‌ها", Target],
        ["learning", "یادگیری و مرور", BarChart3],
      ] as const)
    : ([
        ["dashboard", "مسیر یادگیری من", LayoutDashboard],
        ["missions", "مأموریت‌های من", Target],
        ["courses", "درس‌های من", BookOpenCheck],
        ["learning", "یادگیری و مرور", BarChart3],
      ] as const);
  return (
    <div className="min-h-screen min-[651px]:grid min-[651px]:grid-cols-[180px_minmax(0,1fr)] min-[951px]:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="glass-sidebar max-w-96 mx-3 my-3 flex flex-col gap-7 px-4 py-6 min-[651px]:sticky min-[651px]:top-4 min-[651px]:max-h-[calc(100dvh-2rem)] min-[651px]:overflow-y-auto min-[951px]:mx-4 min-[951px]:my-4 min-[951px]:px-6 min-[951px]:py-7 max-[650px]:gap-3 max-[650px]:p-4 max-[650px]:[&_nav]:flex max-[650px]:[&_nav]:overflow-x-auto max-[650px]:[&_footer]:hidden">
        <div className="flex items-center gap-3 text-[23px] font-bold text-[#233b8f]">
          <span className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-[#233b8f] text-white">
            <BookOpen />
          </span>
          همیار
        </div>
        <small className="text-xs leading-loose text-slate-500">
          {teacher ? "فضای کار معلم" : "فضای تمرین دانش‌آموز"}
        </small>
        <nav className="grid gap-[18px]">
          {nav.map(([key, title, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setPage(key);
                setError("");
              }}
              className={clsx(
                "flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 p-3.5 text-right motion-reduce:transition-none max-[650px]:whitespace-nowrap",
                page === key
                  ? "bg-[#233b8f0d] text-[#233b8f] font-bold"
                  : "text-slate-500",
              )}
            >
              <Icon size={19} />
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
              همیار همراهی می‌کند.
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
      <main className="relative w-full min-w-0 px-8 py-7 max-[950px]:p-6 max-[650px]:p-[18px] grid gap-[18px]">
        <header className="glass-header mb-6 flex items-center justify-between gap-3 p-4 sm:p-5 max-[650px]:mb-[22px] max-[650px]:[&_h1]:text-[22px]">
          <div>
            <small className="text-xs leading-loose text-slate-500">
              همیار / {teacher ? "پنل معلم" : "یادگیری"}
            </small>
            <h1 className="text-[28px] font-bold">
              {nav.find((n) => n[0] === page)?.[1] ??
                (page === "report" ? "گزارش عملکرد" : "محیط تمرین")}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-[#e8edf9] text-[#233b8f]">
              <GraduationCap />
            </span>
            <div>
              <h3 className="text-base font-bold">{me.name}</h3>
              <small className="text-xs leading-loose text-slate-500">
                {teacher ? "معلم" : "دانش‌آموز"}
              </small>
            </div>
          </div>
        </header>
        {feedback}
        {page === "courses" && (
          <CoursesScreen
            teacher={teacher}
            courses={courses}
            enrollments={enrollments}
            assignments={assignments}
            students={students}
            refresh={() => refresh()}
          />
        )}
        {page === "learning" && (
          <LearningDashboard me={me} students={students} />
        )}
        {page === "dashboard" && (
          <OverviewScreen
            me={me}
            teacher={teacher}
            assignments={assignments}
            students={students}
            setPage={setPage}
            invitationToken={token}
            onJoined={async () => {
              setToken("");
              const url = new URL(window.location.href);
              url.searchParams.delete("invite");
              window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
              await refresh();
            }}
          />
        )}
        {page === "students" && teacher && (
          <StudentsScreen
            students={students}
            courses={courses}
            inviteEmail={inviteEmail}
            inviteToken={inviteToken}
            busy={busy}
            run={run}
            refresh={refresh}
            setInviteEmail={setInviteEmail}
            setInviteToken={setInviteToken}
          />
        )}
        {page === "content" && teacher && (
          <ContentScreen
            setNotice={setNotice}
            nodes={nodes}
            questions={questions}
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
        {page === "missions" && (
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
            setPage={setPage}
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
          همیار · تمرین و تحلیل یادگیری تحت هدایت معلم · نسخه توسعه
        </footer>
      </main>
    </div>
  );
}
