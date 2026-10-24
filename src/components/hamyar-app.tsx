"use client";
import { clsx } from "clsx";

import React, { useState, useEffect, type FormEvent } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  Library,
  Target,
  ArrowLeft,
  LogOut,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  BarChart3,
  Plus,
} from "lucide-react";
import { Button } from "./ui/button";
import type { User, Node, Question, Assignment, Report } from "@/lib/types";
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? "ارتباط با سرور برقرار نشد");
  return data;
}
const fa = (n: number) => n.toLocaleString("fa-IR");
const stateLabel: Record<string, string> = {
  published: "آماده تمرین",
  in_progress: "در حال انجام",
  submitted: "در انتظار بررسی",
  completed: "تکمیل‌شده",
  draft: "پیش‌نویس",
  correct: "صحیح",
  incorrect: "نیازمند اصلاح",
  pending_review: "نیازمند بررسی معلم",
};
function Field({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const fieldId = React.useId();
  return (
    <div className="grid gap-2">
      <label
        htmlFor={fieldId}
        className="flex flex-col gap-2 text-[13px] text-slate-600"
      >
        {title}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
            id: fieldId,
          })
        : children}
    </div>
  );
}
export default function HamyarApp() {
  const [me, setMe] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState("dashboard");
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
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [missionTitle, setMissionTitle] = useState(""),
    [student, setStudent] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [maxHints, setMaxHints] = useState(2),
    [maxAttempts, setMaxAttempts] = useState(3),
    [independent, setIndependent] = useState(false);
  const [qi, setQi] = useState(0),
    [answer, setAnswer] = useState("");
  async function refresh(u = me) {
    if (!u) return;
    setAssignments(await api("/assignments"));
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
  async function auth(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      if (mode !== "login") {
        await api(
          mode === "register" ? "/auth/register" : "/invitations/accept",
          { name, email, password, token },
        );
        setMode("login");
        setNotice("حساب ساخته شد. اکنون وارد شوید.");
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
        className="mx-auto my-[7vh] max-w-[1020px] rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9]"
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
          className="rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9]"
        >
          {notice}
        </div>
      )}
    </>
  );
  if (!me)
    return (
      <main className="mx-auto my-[7vh] max-w-[1020px] p-6">
        <div className="flex items-center gap-3 text-[23px] font-bold text-[#233b8f]">
          <span className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-[#233b8f] text-white">
            <BookOpen />
          </span>
          همیار
        </div>
        <div className="grid items-center gap-11 min-[651px]:grid-cols-2 max-[650px]:gap-[15px]">
          <div className="p-10 leading-[2.5] max-[650px]:p-2 [&_h1]:text-[38px] [&_h1]:leading-[1.7] max-[650px]:[&_h1]:text-[27px]">
            <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
              فضایی برای تمرین آگاهانه
            </span>
            <h1 className="text-[28px] font-bold">
              هر تمرین، یک قدم
              <br />
              به یادگیری مستقل.
            </h1>
            <p className="text-xs leading-loose text-slate-500">
              معلم آموزش می‌دهد، همیار تمرین را همراهی می‌کند.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ShieldCheck color="#19B7AE" />
              <small className="text-xs leading-loose text-slate-500">
                مسیر یادگیری زیر نظر معلم شما
              </small>
            </div>
          </div>
          <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
            <h2 className="text-[19px] font-bold">
              {mode === "login"
                ? "خوش آمدید"
                : mode === "register"
                  ? "شروع همراهی به‌عنوان معلم"
                  : "پذیرش دعوت دانش‌آموز"}
            </h2>
            <p className="text-xs leading-loose text-slate-500">
              برای ادامه مسیر یادگیری وارد حساب خود شوید.
            </p>
            {feedback}
            <form onSubmit={auth} className="grid gap-[18px]">
              {mode !== "login" && (
                <Field title="نام و نام خانوادگی">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  />
                </Field>
              )}
              <Field title="ایمیل">
                <input
                  required
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                />
              </Field>
              <Field title="رمز عبور (حداقل ۱۰ کاراکتر)">
                <input
                  required
                  type="password"
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                />
              </Field>
              {mode === "accept" && (
                <Field title="کد دعوت معلم">
                  <input
                    required
                    dir="ltr"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  />
                </Field>
              )}
              <Button disabled={busy}>
                {mode === "login" ? "ورود به همیار" : "ساخت حساب"}
                <ArrowLeft size={16} />
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setMode(mode === "register" ? "login" : "register")
                }
              >
                {mode === "register" ? "ورود" : "ثبت‌نام معلم"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode(mode === "accept" ? "login" : "accept")}
              >
                {mode === "accept" ? "ورود" : "دعوت دانش‌آموز"}
              </Button>
            </div>
            <small className="text-xs leading-loose text-slate-500">
              نسخه توسعه محلی · همیار آزمایشی با راهنمایی تأییدشده معلم
            </small>
          </section>
        </div>
      </main>
    );
  const teacher = me.role === "teacher";
  const nav = teacher
    ? ([
        ["dashboard", "نمای کلی", LayoutDashboard],
        ["students", "دانش‌آموزان", Users],
        ["content", "بانک سؤال و محتوا", Library],
        ["missions", "مأموریت‌ها", Target],
      ] as const)
    : ([
        ["dashboard", "مسیر یادگیری من", LayoutDashboard],
        ["missions", "مأموریت‌های من", Target],
      ] as const);
  return (
    <div className="min-h-screen min-[651px]:grid min-[651px]:grid-cols-[180px_minmax(0,1fr)] min-[951px]:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-7 border-l border-slate-200 bg-white/55 px-6 py-8 max-[650px]:gap-3 max-[650px]:p-4 max-[650px]:[&_nav]:flex max-[650px]:[&_nav]:overflow-x-auto max-[650px]:[&_footer]:hidden">
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
          <div className="rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9]">
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
              await api("/auth/logout", {});
              Object.keys(localStorage)
                .filter((k) => k.startsWith("draft:" + me._id + ":"))
                .forEach((k) => localStorage.removeItem(k));
              setMe(null);
              setActive(null);
              setReport(null);
              setPage("dashboard");
            })
          }
        >
          <LogOut size={16} />
          خروج
        </Button>
      </aside>
      <main className="w-full min-w-0 max-w-[1300px] px-11 py-8 max-[950px]:p-6 max-[650px]:p-[18px] grid gap-[18px]">
        <header className="mb-9 flex items-center justify-between max-[650px]:mb-[22px] max-[650px]:[&_h1]:text-[22px]">
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
        {page === "dashboard" && (
          <>
            <section className="flex items-center justify-between gap-6 rounded-3xl bg-[linear-gradient(110deg,#233b8f,#304d9d)] p-8 text-white [&_p]:mt-3 [&_p]:leading-loose [&_p]:text-indigo-100 max-[650px]:p-6 max-[650px]:[&_svg]:hidden">
              <div>
                <span className="inline-block rounded-full border border-[#19b7ae33] px-3 py-1.5 text-[11px] bg-white/15 text-white">
                  یادگیری، با شواهد واقعی
                </span>
                <h2 className="font-bold mt-[18px] text-[26px]">
                  سلام {me.name}، خوش آمدید
                </h2>
                <p>
                  {teacher
                    ? "از اولین تمرین تا تصمیم بهتر برای جلسه بعد، همراه شما هستیم."
                    : "با تمرین‌های معلمت شروع کن؛ برای فکرکردن و تلاش‌کردن وقت داری."}
                </p>
                <Button variant="outline" onClick={() => setPage("missions")}>
                  مشاهده مأموریت‌ها
                  <ArrowLeft size={16} />
                </Button>
              </div>
              <BookOpen size={110} strokeWidth={1} />
            </section>
            <div className="grid grid-cols-4 gap-4 max-[950px]:grid-cols-2 max-[650px]:gap-2.5">
              {[
                [assignments.length, "مأموریت تخصیص‌یافته"],
                [
                  assignments.filter((a) => a.state === "completed").length,
                  "مأموریت تکمیل‌شده",
                ],
                [
                  assignments.filter((a) => a.state === "submitted").length,
                  "در انتظار بررسی",
                ],
                [
                  teacher
                    ? students.length
                    : assignments.filter((a) => a.state === "in_progress")
                        .length,
                  teacher ? "دانش‌آموز همراه" : "تمرین در حال انجام",
                ],
              ].map(([value, title]) => (
                <div
                  key={title}
                  className="rounded-[20px] border border-slate-200 bg-white/70 p-[22px] [&_strong]:mt-2.5 [&_strong]:block [&_strong]:text-[28px] [&_strong]:text-[#233b8f] max-[650px]:p-4"
                >
                  <small className="text-xs leading-loose text-slate-500">
                    {title}
                  </small>
                  <strong>{fa(Number(value))}</strong>
                </div>
              ))}
            </div>
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
              <div className="flex flex-wrap items-center gap-3">
                <Target color="#19b7ae" />
                <h2 className="text-[19px] font-bold">گام بعدی شما</h2>
              </div>
              <p className="text-xs leading-loose text-slate-500">
                {teacher
                  ? "ابتدا درس و مبحث را بسازید، سؤال معتبر اضافه کنید و دانش‌آموزتان را دعوت کنید."
                  : "مأموریت‌های منتشرشده معلم در این بخش آماده شروع هستند."}
              </p>
              <Button
                onClick={() => setPage(teacher ? "content" : "missions")}
                className="justify-self-start"
              >
                {teacher ? "آماده‌سازی محتوا" : "شروع تمرین"}
                <ArrowLeft size={16} />
              </Button>
            </section>
          </>
        )}
        {page === "students" && teacher && (
          <div className="grid gap-[22px] min-[951px]:grid-cols-2">
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
              <h2 className="text-[19px] font-bold">دعوت یک همراه جدید</h2>
              <p className="text-xs leading-loose text-slate-500">
                کد ۷۲ ساعت معتبر است. لینک را خودتان در اختیار دانش‌آموز قرار
                دهید.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const d = await api<{ token: string }>("/invitations", {
                      email: inviteEmail,
                    });
                    setInviteToken(d.token);
                  });
                }}
                className="grid gap-[18px]"
              >
                <Field title="ایمیل دانش‌آموز">
                  <input
                    required
                    type="email"
                    dir="ltr"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  />
                </Field>
                <Button disabled={busy}>
                  <Plus size={16} />
                  ایجاد دعوت
                </Button>
              </form>
              {inviteToken && (
                <div className="rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9] grid gap-[18px]">
                  <small className="text-xs leading-loose text-slate-500">
                    لینک دعوت (ارسال ایمیل انجام نمی‌شود)
                  </small>
                  <p className="[direction:ltr] [overflow-wrap:anywhere] font-mono select-all">
                    {location.origin}/?invite={inviteToken}
                  </p>
                  <small className="text-xs leading-loose text-slate-500">
                    کد دعوت
                  </small>
                  <p
                    data-testid="invitation-token"
                    className="[direction:ltr] [overflow-wrap:anywhere] font-mono select-all"
                  >
                    {inviteToken}
                  </p>
                </div>
              )}
            </section>
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
              <h2 className="text-[19px] font-bold">دانش‌آموزان شما</h2>
              {students.map((s) => (
                <div
                  key={s._id}
                  className="grid gap-3 rounded-2xl border border-slate-200 p-[18px]"
                >
                  <h3 className="text-base font-bold">{s.name}</h3>
                  <small
                    dir="ltr"
                    className="text-xs leading-loose text-slate-500"
                  >
                    {s.email}
                  </small>
                </div>
              ))}
              {!students.length && (
                <p className="p-[30px] text-center leading-loose text-slate-500">
                  پس از پذیرش دعوت، دانش‌آموز اینجا ظاهر می‌شود.
                </p>
              )}
              <Button variant="outline" onClick={() => run(() => refresh())}>
                به‌روزرسانی فهرست
              </Button>
            </section>
          </div>
        )}
        {page === "content" && teacher && (
          <div className="grid gap-[22px] min-[951px]:grid-cols-2">
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
              <h2 className="text-[19px] font-bold">ساختار آموزشی شما</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api("/curriculum", {
                      title: nodeTitle,
                      kind: nodeKind,
                      ...(parent ? { parentId: parent } : {}),
                    });
                    setNodeTitle("");
                    await refresh();
                  });
                }}
                className="grid gap-[18px]"
              >
                <Field title="نوع">
                  <select
                    value={nodeKind}
                    onChange={(e) => setNodeKind(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  >
                    {[
                      ["system", "نظام آموزشی"],
                      ["level", "مقطع"],
                      ["grade", "پایه / برنامه"],
                      ["subject", "درس"],
                      ["course", "دوره"],
                      ["chapter", "فصل"],
                      ["topic", "مبحث"],
                      ["skill", "مهارت"],
                      ["objective", "هدف یادگیری"],
                    ].map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field title="عنوان">
                  <input
                    required
                    value={nodeTitle}
                    onChange={(e) => setNodeTitle(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  />
                </Field>
                <Field title="زیرمجموعه (اختیاری)">
                  <select
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  >
                    <option value="">مستقل</option>
                    {nodes.map((n) => (
                      <option key={n._id} value={n._id}>
                        {n.title} ({n.kind})
                      </option>
                    ))}
                  </select>
                </Field>
                <Button disabled={busy}>افزودن به ساختار</Button>
              </form>
              <div className="my-2 h-px bg-slate-200" />
              {nodes.map((n) => (
                <div key={n._id} className="flex flex-wrap items-center gap-3">
                  <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
                    {n.kind}
                  </span>
                  {n.title}
                  <small className="text-xs leading-loose text-slate-500">
                    {nodes.find((p) => p._id === n.parentId)?.title}
                  </small>
                </div>
              ))}
            </section>
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
              <h2 className="text-[19px] font-bold">افزودن سؤال تأییدشده</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api("/questions", {
                      topicId: topic,
                      skillIds,
                      statement,
                      type: qtype,
                      reference,
                      hints: hints.split("\n").filter(Boolean),
                      options: options.split("\n").filter(Boolean),
                    });
                    setStatement("");
                    setReference("");
                    setHints("");
                    setNotice("نسخه ثابت سؤال ذخیره شد.");
                    await refresh();
                  });
                }}
                className="grid gap-[18px]"
              >
                <Field title="مبحث">
                  <select
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  >
                    <option value="">انتخاب مبحث</option>
                    {nodes
                      .filter((n) => n.kind === "topic")
                      .map((n) => (
                        <option key={n._id} value={n._id}>
                          {n.title}
                        </option>
                      ))}
                  </select>
                </Field>
                {nodes.some((n) => n.kind === "skill") && (
                  <fieldset className="grid gap-[18px]">
                    <legend>مهارت‌های مرتبط (اختیاری)</legend>
                    {nodes
                      .filter((n) => n.kind === "skill")
                      .map((n) => (
                        <label
                          key={n._id}
                          className="flex-row items-center flex gap-2 text-[13px] text-slate-600"
                        >
                          <input
                            type="checkbox"
                            checked={skillIds.includes(n._id)}
                            onChange={(e) =>
                              setSkillIds(
                                e.target.checked
                                  ? [...skillIds, n._id]
                                  : skillIds.filter((s) => s !== n._id),
                              )
                            }
                            className="size-5 min-h-5 shrink-0 cursor-pointer accent-[#233b8f]"
                          />
                          {n.title}
                        </label>
                      ))}
                  </fieldset>
                )}
                <Field title="صورت سؤال">
                  <textarea
                    required
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    className="w-full min-h-[100px] resize-y rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  />
                </Field>
                <Field title="روش پاسخ">
                  <select
                    value={qtype}
                    onChange={(e) => setQtype(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  >
                    {[
                      ["numeric", "عددی قطعی"],
                      ["choice", "چندگزینه‌ای"],
                      ["short", "متن کوتاه با تطبیق دقیق"],
                      ["essay", "تشریحی با بررسی معلم"],
                    ].map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                {qtype === "choice" && (
                  <Field title="گزینه‌ها (هر خط یک گزینه)">
                    <textarea
                      required
                      value={options}
                      onChange={(e) => setOptions(e.target.value)}
                      className="w-full min-h-[100px] resize-y rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                    />
                  </Field>
                )}
                <Field title="پاسخ مرجع خصوصی">
                  <textarea
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full min-h-[100px] resize-y rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  />
                </Field>
                <Field title="راهنمایی‌های تأییدشده (هر خط یک راهنما، حداکثر ۳)">
                  <textarea
                    value={hints}
                    onChange={(e) => setHints(e.target.value)}
                    className="w-full min-h-[100px] resize-y rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                  />
                </Field>
                <small className="text-xs leading-loose text-slate-500">
                  با ثبت سؤال، صحت محتوا و عدم افشای پاسخ در راهنمایی‌ها را
                  بررسی کرده‌اید.
                </small>
                <Button disabled={busy || !topic}>تأیید و ذخیره سؤال</Button>
              </form>
            </section>
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px] col-span-full">
              <h2 className="text-[19px] font-bold">
                بانک سؤال خصوصی · {fa(questions.length)} سؤال
              </h2>
              {questions.map((q) => (
                <div
                  key={q._id}
                  className="grid gap-3 rounded-2xl border border-slate-200 p-[18px]"
                >
                  <p>{q.statement}</p>
                  <small className="text-xs leading-loose text-slate-500">
                    {nodes.find((n) => n._id === q.topicId)?.title} · {q.type} ·
                    نسخه ۱
                  </small>
                </div>
              ))}
            </section>
          </div>
        )}
        {page === "missions" && (
          <>
            {teacher && (
              <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
                <h2 className="text-[19px] font-bold">طراحی مأموریت تمرینی</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      await api("/missions", {
                        title: missionTitle,
                        studentId: student,
                        questionVersionIds: selected,
                        policy: { maxHints, maxAttempts, independent },
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
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                      />
                    </Field>
                    <Field title="دانش‌آموز">
                      <select
                        required
                        value={student}
                        onChange={(e) => setStudent(e.target.value)}
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
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
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
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
                        className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
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
                  <h3 className="text-base font-bold">
                    انتخاب سؤال از بانک معتبر
                  </h3>
                  {questions.map((q) => (
                    <label
                      key={q._id}
                      className="flex-row items-center rounded-2xl border border-slate-200 p-[18px] flex gap-2 text-[13px] text-slate-600"
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
                      className="rounded-2xl border border-slate-200 p-[18px] flex flex-wrap items-center gap-3"
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
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
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
                  className="grid gap-3 rounded-2xl border border-slate-200 p-[18px]"
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
                      !["completed", "submitted"].includes(a.state) && (
                        <Button disabled={busy} onClick={() => open(a)}>
                          شروع / ادامه تمرین
                          <ArrowLeft size={16} />
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
        )}
        {page === "practice" &&
          active &&
          active.questions &&
          (() => {
            const q = active.questions[qi],
              p = active.progress[q._id],
              attempts =
                active.attempts?.filter((a) => a.questionVersionId === q._id) ??
                [],
              last = attempts.at(-1),
              ev = active.evaluations?.find((e) => e.attemptId === last?._id);
            return (
              <>
                <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
                      سؤال {fa(qi + 1)} از {fa(active.questions!.length)}
                    </span>
                    <h2 className="text-[19px] font-bold">{active.title}</h2>
                    <small className="text-xs leading-loose text-slate-500">
                      پاسخ‌ها در سرور ثبت می‌شوند
                    </small>
                  </div>
                  <progress
                    aria-label="پیشرفت پاسخ‌گویی مأموریت"
                    value={
                      active.questions!.filter(
                        (q) => active.progress[q._id].attempts > 0,
                      ).length
                    }
                    max={active.questions!.length}
                    className="w-full accent-[#19b7ae]"
                  />
                  <p className="py-6 text-[21px] leading-[2.2]">
                    {q.statement}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        await api("/assignments/" + active._id + "/attempts", {
                          questionId: q._id,
                          answer,
                        });
                        localStorage.removeItem(
                          "draft:" + me._id + ":" + active._id + ":" + q._id,
                        );
                        await reloadActive();
                        setNotice("پاسخ شما ثبت شد.");
                      });
                    }}
                    className="grid gap-[18px]"
                  >
                    <Field title="پاسخ شما">
                      {q.type === "choice" ? (
                        <select
                          required
                          value={answer}
                          onChange={(e) => {
                            setAnswer(e.target.value);
                            localStorage.setItem(
                              "draft:" +
                                me._id +
                                ":" +
                                active._id +
                                ":" +
                                q._id,
                              e.target.value,
                            );
                          }}
                          className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                        >
                          <option value="">انتخاب پاسخ</option>
                          {q.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <textarea
                          required
                          value={answer}
                          onChange={(e) => {
                            setAnswer(e.target.value);
                            localStorage.setItem(
                              "draft:" +
                                me._id +
                                ":" +
                                active._id +
                                ":" +
                                q._id,
                              e.target.value,
                            );
                          }}
                          placeholder="ابتدا خودت تلاش کن…"
                          className="w-full min-h-[100px] resize-y rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
                        />
                      )}
                    </Field>
                    <small className="text-xs leading-loose text-slate-500">
                      تلاش ثبت‌شده: {fa(p.attempts)} از{" "}
                      {fa(active.policy.maxAttempts)} · راهنمایی استفاده‌شده:{" "}
                      {fa(p.hints)} از{" "}
                      {fa(
                        active.policy.independent ? 0 : active.policy.maxHints,
                      )}
                    </small>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        disabled={
                          busy || p.attempts >= active.policy.maxAttempts
                        }
                      >
                        ثبت و بررسی پاسخ
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          busy ||
                          active.policy.independent ||
                          p.hints >= active.policy.maxHints
                        }
                        onClick={() =>
                          run(async () => {
                            await api("/assignments/" + active._id + "/hints", {
                              questionId: q._id,
                            });
                            await reloadActive();
                          })
                        }
                      >
                        <Sparkles size={16} />
                        درخواست راهنمایی
                      </Button>
                    </div>
                  </form>
                  {ev && (
                    <div
                      className={clsx(
                        "rounded-[14px] p-3.5 leading-[1.9]",
                        ev.result === "incorrect"
                          ? "bg-rose-50 text-rose-800"
                          : "bg-indigo-50 text-[#233b8f]",
                      )}
                    >
                      {stateLabel[ev.result]} ·{" "}
                      {last!.hintsUsed ? "با دریافت کمک" : "بدون دریافت کمک"}
                    </div>
                  )}
                  {active.hints
                    ?.filter((h) => h.questionVersionId === q._id)
                    .map((h) => (
                      <div
                        key={h._id}
                        className="rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9]"
                      >
                        {h.text}
                        <br />
                        <small className="text-xs leading-loose text-slate-500">
                          راهنمای تأییدشده معلم · Mock Provider
                        </small>
                      </div>
                    ))}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      disabled={qi === 0}
                      onClick={() => {
                        const next = qi - 1;
                        setQi(next);
                        setAnswer(
                          localStorage.getItem(
                            "draft:" +
                              me._id +
                              ":" +
                              active._id +
                              ":" +
                              active.questions![next]._id,
                          ) ?? "",
                        );
                      }}
                    >
                      سؤال قبلی
                    </Button>
                    <Button
                      variant="outline"
                      disabled={qi === active.questions!.length - 1}
                      onClick={() => {
                        const next = qi + 1;
                        setQi(next);
                        setAnswer(
                          localStorage.getItem(
                            "draft:" +
                              me._id +
                              ":" +
                              active._id +
                              ":" +
                              active.questions![next]._id,
                          ) ?? "",
                        );
                      }}
                    >
                      سؤال بعدی
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api(
                            "/assignments/" + active._id + "/complete",
                            {},
                          );
                          setActive(await api("/assignments/" + active._id));
                          setReport(
                            await api("/assignments/" + active._id + "/report"),
                          );
                          await refresh();
                          setPage("report");
                        })
                      }
                    >
                      پایان مأموریت و دریافت گزارش
                    </Button>
                  </div>
                </section>
                <p className="text-xs leading-loose text-slate-500">
                  پیش‌نویس پاسخ روی همین مرورگر حفظ می‌شود. برای ثبت نهایی،
                  اتصال به سرور لازم است.
                </p>
              </>
            );
          })()}
        {page === "report" && report && active && (
          <>
            <section className="flex items-center justify-between gap-6 rounded-3xl bg-[linear-gradient(110deg,#233b8f,#304d9d)] p-8 text-white [&_p]:mt-3 [&_p]:leading-loose [&_p]:text-indigo-100 max-[650px]:p-6 max-[650px]:[&_svg]:hidden">
              <div>
                <small className="text-xs leading-loose text-indigo-100">
                  گزارش مبتنی بر پاسخ‌های ثبت‌شده
                </small>
                <h2 className="font-bold mt-3 text-[25px]">{active.title}</h2>
                <p>
                  از {fa(report.total)} سؤال، {fa(report.independent)} سؤال بدون
                  راهنمایی و {fa(report.assisted)} سؤال با راهنمایی درست حل شده
                  است.
                </p>
              </div>
              <BarChart3 size={85} />
            </section>
            <div className="grid grid-cols-4 gap-4 max-[950px]:grid-cols-2 max-[650px]:gap-2.5">
              {[
                [report.independent, "صحیح بدون کمک"],
                [report.assisted, "صحیح با کمک"],
                [report.pending, "نیازمند بررسی"],
                [report.hints, "راهنمایی دریافت‌شده"],
              ].map(([v, t]) => (
                <div
                  key={t}
                  className="rounded-[20px] border border-slate-200 bg-white/70 p-[22px] [&_strong]:mt-2.5 [&_strong]:block [&_strong]:text-[28px] [&_strong]:text-[#233b8f] max-[650px]:p-4"
                >
                  <small className="text-xs leading-loose text-slate-500">
                    {t}
                  </small>
                  <strong>{fa(Number(v))}</strong>
                </div>
              ))}
            </div>
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
              <h2 className="text-[19px] font-bold">استقلال در اولین تلاش</h2>
              <p>
                {report.independentSuccessRate === null
                  ? "هنوز شواهد ارزیابی‌شده کافی نداریم."
                  : `${fa(Math.round(report.independentSuccessRate * 100))}٪ از ${fa(report.eligibleFirstAttempts)} اولین تلاشِ قابل ارزیابی، مستقل و صحیح بوده است.`}
              </p>
              <small className="text-xs leading-loose text-slate-500">
                تعداد کم سؤال، نشانه قطعی تسلط نیست. پاسخ صحیح در تلاش‌های بعدی
                جدا از این شاخص محاسبه می‌شود.
              </small>
              <div className="rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9]">
                <h3 className="text-base font-bold">
                  {teacher ? "پیشنهاد برای جلسه بعد" : "گام بعدی پیشنهادی"}
                </h3>
                <p>{report.recommendation}</p>
                <small className="text-xs leading-loose text-slate-500">
                  پیشنهاد قاعده‌محور؛ مبتنی بر شواهد زیر، بدون تشخیص قطعی نوع
                  خطا
                </small>
              </div>
            </section>
            <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
              <h2 className="text-[19px] font-bold">
                {teacher ? "شواهد تلاش‌ها و بازبینی" : "نتیجه سؤال‌ها"}
              </h2>
              {report.evidence.map((t) => (
                <div
                  key={t._id}
                  className="grid gap-3 rounded-2xl border border-slate-200 p-[18px] text-[13px] leading-loose"
                >
                  <h3 className="text-base font-bold">
                    {
                      active.questions?.find(
                        (q) => q._id === t.questionVersionId,
                      )?.statement
                    }
                  </h3>
                  <p className="whitespace-pre-wrap">پاسخ: {t.answer}</p>
                  <p>
                    {stateLabel[t.evaluation?.result ?? ""] ??
                      "در انتظار ارزیابی"}{" "}
                    · تلاش {fa(t.sequence)} · {fa(t.hintsUsed)} راهنمایی
                  </p>
                  {teacher && (
                    <>
                      <small className="[direction:ltr] [overflow-wrap:anywhere] font-mono select-all text-xs leading-loose text-slate-500">
                        Evidence: {t._id}
                      </small>
                      <small className="text-xs leading-loose text-slate-500">
                        روش: {t.evaluation?.method}
                      </small>
                      {!!t.evaluation?.reviews?.length && (
                        <details>
                          <summary>تاریخچه بازبینی معلم</summary>
                          {t.evaluation.reviews.map((review, i) => (
                            <div
                              key={i}
                              className="rounded-[14px] bg-indigo-50 text-[#233b8f] p-3.5 leading-[1.9]"
                            >
                              <p>{review.note}</p>
                              <small className="text-xs leading-loose text-slate-500">
                                {stateLabel[review.previousResult]} ←{" "}
                                {stateLabel[review.result]} ·{" "}
                                {new Date(review.createdAt).toLocaleString(
                                  "fa-IR",
                                )}
                              </small>
                            </div>
                          ))}
                        </details>
                      )}
                      {t.evaluation && (
                        <Review
                          disabled={busy}
                          submit={(result, note) =>
                            run(async () => {
                              await api(
                                "/evaluations/" + t.evaluation!._id + "/review",
                                { result, note },
                              );
                              setReport(
                                await api(
                                  "/assignments/" + active._id + "/report",
                                ),
                              );
                            })
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
        <footer className="text-xs leading-loose text-slate-500 p-5 text-center">
          همیار · تمرین و تحلیل یادگیری تحت هدایت معلم · نسخه توسعه
        </footer>
      </main>
    </div>
  );
}
function Review({
  submit,
  disabled,
}: {
  submit: (result: string, note: string) => void;
  disabled: boolean;
}) {
  const [note, setNote] = useState(""),
    [result, setResult] = useState("correct");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(result, note);
      }}
      className="grid gap-[18px]"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Field title="نتیجه بررسی معلم">
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
          >
            <option value="correct">صحیح</option>
            <option value="incorrect">نادرست</option>
          </select>
        </Field>
        <Field title="توضیح و شواهد اصلاح">
          <input
            required
            minLength={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white/70 p-3 text-[#1f2937] focus:outline-2 focus:outline-offset-2 focus:outline-[#233b8f]"
          />
        </Field>
        <Button variant="outline" disabled={disabled}>
          ثبت بازبینی
        </Button>
      </div>
    </form>
  );
}
