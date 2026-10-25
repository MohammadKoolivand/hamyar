"use client";
import { PagedList } from "@/components/ui/paged-list";
import { useEffect, useState } from "react";
import { AppLink as Link } from "@/components/app-link";
import { MathText } from "@/components/question-presentation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";
interface Skill {
  skillId: string;
  title: string;
  status: string;
  derivedStatus?: string;
  overrideReason?: string;
  supportingAttempts: number;
  independentFirstAttempts: number;
  independentCorrect: number;
  assistedCorrect: number;
  incorrect: number;
  distinctQuestions: number;
  lastPractice: string | null;
  evidenceIds: string[];
  overrideHistory?: { reason: string; createdAt: string }[];
}
interface Progress {
  role: string;
  assignedQuestions: number;
  recentMissions?: {
    assignmentId: string;
    title: string;
    state: string;
    total: number;
    answered: number;
    incorrect: number;
    independent: number;
    assisted: number;
  }[];
  answered: number;
  independent: number;
  assisted: number;
  incorrect: number;
  pending: number;
  eligibleFirstAttempts: number;
  independentSuccessRate: number | null;
  hintUsageRate: number | null;
  skills: Skill[];
  mistakes: {
    _id: string;
    status: string;
    statement: string;
    sourceAnswer?: string | null;
    sourceAttemptId: string;
    verificationStatus: string;
    improvementEvidenceIds: string[];
  }[];
  recommendations: {
    skillId: string;
    observation: { attempts: number; independent: number; errors: number };
    interpretation: string;
    action: string;
    evidenceIds: string[];
  }[];
  evidence?: {
    _id: string;
    answer: string | null;
    statement: string | null;
    result: string;
    hintsUsed: number;
    method: string;
    assignmentId: string;
  }[];
  trends?: {
    assignmentId: string;
    title: string;
    answered: number;
    independent: number;
    assisted: number;
    independentSuccessRate: number | null;
  }[];
}
const labels: Record<string, string> = {
  not_started: "شروع نشده",
  insufficient_evidence: "شواهد ناکافی",
  needs_practice: "نیازمند تمرین",
  developing: "در حال پیشرفت",
  proficient: "شواهد کافی از حل مستقل",
  needs_review: "نیازمند مرور",
  improvement_observed: "بهبود مشاهده شده",
  resolved: "بهبود با شواهد مستقل",
  corrected_by_review: "ارزیابی اولیه توسط معلم اصلاح شد",
};
const number = (n: number) => n.toLocaleString("fa-IR"),
  percent = (n: number | null) =>
    n === null ? "شواهد ناکافی" : number(Math.round(n * 100)) + "٪";
export function LearningDashboard({
  me,
  students,
  subjectId,
}: {
  me: User;
  students: User[];
  subjectId?: string;
}) {
  const [skillFilter, setSkillFilter] = useState("all");
  const [skillTarget, setSkillTarget] = useState(0);
  const [sid, setSid] = useState(
      subjectId ?? (me.role === "student" ? me._id : (students[0]?._id ?? "")),
    ),
    [data, setData] = useState<Progress | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    if (!sid) return;
    setData(null);
    setError("");
    api<Progress>("/students/" + sid + "/progress")
      .then((result) => {
        if (current) setData(result);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [sid, revision]);
  useEffect(() => {
    if (me.role === "teacher" && !sid && students[0]) setSid(students[0]._id);
  }, [me.role, sid, students]);
  async function override(skillId: string, status: string, reason: string) {
    setBusy(true);
    setError("");
    try {
      await api("/students/" + sid + "/mastery/" + skillId + "/override", {
        status,
        reason,
      });
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      {me.role === "teacher" && (
        <label className="grid gap-2 text-sm text-slate-600">
          دانش‌آموز برای تحلیل
          <select
            className="min-h-11 glass-field p-3"
            value={sid}
            onChange={(e) => setSid(e.target.value)}
          >
            <option value="">انتخاب دانش‌آموز</option>
            {students.map((s) => (
              <option value={s._id} key={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">
          {error}
        </p>
      )}
      {!sid ? (
        <p className="p-6 text-slate-500">
          ابتدا دانش‌آموز را دعوت و یک مأموریت منتشر کنید.
        </p>
      ) : !data ? (
        <p role="status" className="p-6 text-slate-500">
          در حال خواندن شواهد ثبت‌شده…
        </p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                data.independent,
                "صحیح بدون کمک",
                "border-emerald-200 bg-emerald-50/80 text-emerald-900",
              ],
              [
                data.assisted,
                "صحیح با راهنما",
                "border-teal-200 bg-teal-50/80 text-teal-900",
              ],
              [
                data.incorrect,
                "نیازمند اصلاح",
                "border-rose-200 bg-rose-50/80 text-rose-900",
              ],
              [
                Math.max(0, data.assignedQuestions - data.answered),
                "سؤال بدون پاسخ",
                "border-amber-200 bg-amber-50/80 text-amber-900",
              ],
              [
                data.pending,
                "در انتظار بررسی",
                "border-violet-200 bg-violet-50/80 text-violet-900",
              ],
              [
                data.answered,
                "سؤال پاسخ‌داده‌شده",
                "border-blue-200 bg-blue-50/80 text-blue-900",
              ],
            ].map(([n, title, color]) => (
              <div
                key={String(title)}
                className={`rounded-2xl border p-5 ${color}`}
              >
                <p className="text-xs">{title}</p>
                <strong className="mt-2 block text-3xl">
                  {number(Number(n))}
                </strong>
              </div>
            ))}
          </section>
          <section className="glass-panel grid gap-4 p-6 lg:grid-cols-2">
            <div>
              <h2 className="text-lg font-bold">در یک نگاه</h2>
              <p className="mt-3 text-sm leading-7">
                موفقیت مستقل در اولین تلاش:{" "}
                <strong>{percent(data.independentSuccessRate)}</strong> · از{" "}
                {number(data.eligibleFirstAttempts)} تلاش قابل ارزیابی
              </p>
              <p className="mt-2 text-sm leading-7">
                {number(
                  data.skills.filter((s) =>
                    ["needs_practice", "needs_review"].includes(s.status),
                  ).length,
                )}{" "}
                مهارت نیازمند تمرین و{" "}
                {number(
                  data.skills.filter((s) => s.status === "proficient").length,
                )}{" "}
                مهارت با شواهد کافی از حل مستقل.
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                صحیح با راهنما نشانهٔ موفقیت با کمک است؛ با حل مستقل یکی نیست.
                دادهٔ کم به معنی ضعف قطعی نیست.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <h3 className="font-bold text-amber-900">از کجا شروع کنم؟</h3>
              {data.skills.length ? (
                <ol className="mt-3 grid gap-2">
                  {[...data.skills]
                    .sort((a, b) => b.incorrect - a.incorrect)
                    .slice(0, 3)
                    .map((skill, i) => (
                      <li key={skill.skillId} className="text-sm leading-7">
                        <a
                          href={`#skill-${skill.skillId}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setSkillFilter("all");
                            setSkillTarget((old) => old + 1);
                            requestAnimationFrame(() =>
                              document
                                .getElementById(`skill-${skill.skillId}`)
                                ?.scrollIntoView({ block: "start" }),
                            );
                          }}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {number(i + 1)}. {skill.title}
                        </a>
                        <p className="text-xs text-slate-600">
                          {skill.incorrect
                            ? `${number(skill.incorrect)} تلاش نادرست؛ مرور روش و سپس یک سؤال تازه بدون کمک`
                            : skill.status === "proficient"
                              ? "مرور فاصله‌دار برای بررسی پایداری یادگیری"
                              : "یک سؤال تازه بدون کمک برای تکمیل شواهد"}
                        </p>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm">
                  برای پیشنهاد دقیق‌تر، ابتدا یک تمرین دارای مهارت مشخص انجام
                  دهید.
                </p>
              )}
            </div>
          </section>
          {me.role !== "parent" && !!data.recentMissions?.length && (
            <section className="glass-panel grid gap-3 p-6">
              <h2 className="text-lg font-bold">
                تمرین‌های اخیر و نتیجه واقعی
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <PagedList items={data.recentMissions} label="تمرین‌های اخیر">
                  {(m) => (
                    <Link
                      key={m.assignmentId}
                      href={`/report?assignment=${m.assignmentId}`}
                      className={`rounded-xl border p-4 transition-colors hover:border-blue-400 ${m.incorrect ? "border-rose-200 bg-rose-50/50" : m.independent + m.assisted > 0 ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white/60"}`}
                    >
                      <h3 className="text-sm font-bold">{m.title}</h3>
                      <p className="mt-2 text-xs leading-6">
                        {number(m.answered)} از {number(m.total)} پاسخ ·{" "}
                        {number(m.independent + m.assisted)} صحیح ·{" "}
                        {number(m.incorrect)} نادرست ·{" "}
                        {number(Math.max(0, m.total - m.answered))} نزده
                      </p>
                      <span className="mt-2 block text-xs font-medium text-[#233B8F]">
                        بررسی سؤال‌ها و پاسخ‌ها ←
                      </span>
                    </Link>
                  )}
                </PagedList>
              </div>
            </section>
          )}
          <section className="grid gap-3 glass-panel p-6">
            <h2 className="text-lg font-bold">مهارت‌ها و شواهد یادگیری</h2>
            <p className="text-sm text-slate-600">
              موفقیت مستقل در اولین تلاش: {percent(data.independentSuccessRate)}{" "}
              از {number(data.eligibleFirstAttempts)} اولین تلاش قابل ارزیابی ·
              استفاده از راهنما: {percent(data.hintUsageRate)}
            </p>
            <p className="text-xs leading-loose text-slate-500">
              این وضعیت‌ها قواعد قابل بررسی‌اند، نه قضاوت درباره توانایی شما.
              کمک گرفتن به‌تنهایی نشانه تسلط یا رفع اشتباه نیست.
            </p>
            {!data.skills.length && (
              <p className="text-sm text-slate-500">
                هنوز سؤال مهارت‌دار با شواهد ثبت‌شده نداریم؛ معلم می‌تواند به
                سؤال‌ها مهارت متصل کند.
              </p>
            )}
            <label className="grid gap-2 text-xs text-slate-500">
              نمایش مهارت‌ها
              <select
                className="glass-field min-h-11 p-2 text-sm"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
              >
                <option value="all">همه مهارت‌ها</option>
                <option value="practice">نیازمند تمرین / مرور</option>
                <option value="strong">حل مستقل موفق</option>
                <option value="unknown">شواهد ناکافی</option>
              </select>
            </label>
            <PagedList
              key={`${skillFilter}-${skillTarget}`}
              items={[...data.skills]
                .filter(
                  (skill) =>
                    skillFilter === "all" ||
                    (skillFilter === "practice"
                      ? ["needs_practice", "needs_review"].includes(
                          skill.status,
                        )
                      : skillFilter === "strong"
                        ? skill.independentCorrect > 0
                        : ["not_started", "insufficient_evidence"].includes(
                            skill.status,
                          )),
                )
                .sort((a, b) => b.incorrect - a.incorrect)}
              label="مهارت‌ها"
            >
              {(skill) => (
                <div
                  key={skill.skillId}
                  id={`skill-${skill.skillId}`}
                  className={`grid scroll-mt-6 gap-3 rounded-2xl border p-4 ${["needs_practice", "needs_review"].includes(skill.status) ? "border-rose-200 bg-rose-50/50" : skill.status === "proficient" ? "border-emerald-200 bg-emerald-50/50" : skill.status === "developing" ? "border-blue-200 bg-blue-50/50" : "border-amber-200 bg-amber-50/40"}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-bold">{skill.title}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${["needs_practice", "needs_review"].includes(skill.status) ? "bg-rose-100 text-rose-800" : skill.status === "proficient" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      {labels[skill.status] ?? skill.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {number(skill.supportingAttempts)} تلاش قابل ارزیابی،{" "}
                    {number(skill.distinctQuestions)} سؤال متفاوت،{" "}
                    {number(skill.independentCorrect)} صحیح مستقل در اولین تلاش
                    و {number(skill.assistedCorrect)} صحیح با کمک
                  </p>
                  <div className="grid gap-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>صحیح مستقل در اولین تلاش</span>
                      <strong>
                        {number(skill.independentCorrect)} از{" "}
                        {number(skill.independentFirstAttempts)}
                      </strong>
                    </div>
                    <progress
                      aria-label={`نسبت موفقیت مستقل ${skill.title}`}
                      max={Math.max(1, skill.independentFirstAttempts)}
                      value={skill.independentCorrect}
                      className="h-2 w-full accent-emerald-500"
                    />
                    <p className="text-xs leading-6 text-slate-500">
                      {number(skill.incorrect)} تلاش نادرست ثبت شده ·{" "}
                      {number(skill.distinctQuestions)} سؤال متفاوت.{" "}
                      {skill.incorrect
                        ? "گام بعد: مرور روش حل و یک سؤال مشابه بدون کمک."
                        : "گام بعد: تمرین مستقل تازه برای تکمیل شواهد."}
                    </p>
                  </div>
                  {skill.lastPractice && (
                    <small className="text-slate-500">
                      آخرین تمرین:{" "}
                      {new Date(skill.lastPractice).toLocaleDateString("fa-IR")}
                    </small>
                  )}
                  {skill.derivedStatus && (
                    <p className="text-sm text-amber-800">
                      تصمیم معلم: {skill.overrideReason} · وضعیت محاسبه‌شده:{" "}
                      {labels[skill.derivedStatus]}
                    </p>
                  )}
                  {me.role === "teacher" && (
                    <>
                      <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer">
                          شناسه شواهد پشتیبان
                        </summary>
                        {skill.evidenceIds.map((id) => (
                          <p key={id} className="break-all font-mono" dir="ltr">
                            {id}
                          </p>
                        ))}
                      </details>
                      <MasteryReview
                        busy={busy}
                        submit={(status, reason) =>
                          override(skill.skillId, status, reason)
                        }
                      />
                      {skill.overrideHistory?.map((h, i) => (
                        <p key={i} className="text-xs text-slate-500">
                          {h.reason} ·{" "}
                          {new Date(h.createdAt).toLocaleString("fa-IR")}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              )}
            </PagedList>
          </section>
          <section className="grid gap-3 glass-panel p-6">
            <h2 className="text-lg font-bold">دفترچه اشتباهات</h2>
            {!data.mistakes.length && (
              <p className="text-sm text-slate-500">
                هنوز خطای قابل ارزیابی ثبت نشده است.
              </p>
            )}
            <PagedList items={data.mistakes} label="اشتباه‌ها">
              {(item) => (
                <article
                  key={item._id}
                  className={`grid gap-2 rounded-2xl border p-4 ${["resolved", "corrected_by_review"].includes(item.status) ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/40"}`}
                >
                  <h3 className="font-medium">
                    <MathText text={item.statement} />
                  </h3>
                  {item.sourceAnswer && (
                    <p className="whitespace-pre-wrap text-sm text-slate-600">
                      پاسخ ثبت‌شده: {item.sourceAnswer}
                    </p>
                  )}
                  <p className="text-sm text-[#1F3F97]">
                    {labels[item.status] ?? item.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    {number(item.improvementEvidenceIds.length)} شاهد مستقل برای
                    پیگیری · نوع خطا بدون بررسی کافی حدس زده نمی‌شود.
                  </p>
                  {me.role === "teacher" && (
                    <p
                      className="break-all font-mono text-xs text-slate-500"
                      dir="ltr"
                    >
                      Source: {item.sourceAttemptId}
                    </p>
                  )}
                </article>
              )}
            </PagedList>
          </section>
          <section className="grid gap-3 glass-panel p-6">
            <h2 className="text-lg font-bold">
              {me.role === "teacher" ? "پیشنهاد جلسه بعد" : "گام بعدی پیشنهادی"}
            </h2>
            {!data.recommendations.length && (
              <p className="text-sm text-slate-500">
                برای پیشنهاد آموزشی، شواهد مهارت‌دار بیشتری لازم است.
              </p>
            )}
            <PagedList items={data.recommendations} label="پیشنهادهای مرور">
              {(r) => (
                <div
                  className="grid gap-2 glass-note p-4 text-sm text-[#1F3F97]"
                  key={r.skillId}
                >
                  <p>
                    مشاهده: {number(r.observation.attempts)} تلاش و{" "}
                    {number(r.observation.errors)} پاسخ نیازمند اصلاح.
                  </p>
                  <p>
                    برداشت محدود:{" "}
                    {r.interpretation === "insufficient_evidence"
                      ? "برای نتیجه‌گیری هنوز شواهد کافی نداریم."
                      : r.interpretation === "repeated_observed_errors"
                        ? "در این مهارت چند پاسخ نیازمند اصلاح مشاهده شده است."
                        : "تمرین ثبت‌شده قابل مرور است."}
                  </p>
                  <p>
                    اقدام پیشنهادی:{" "}
                    {r.action === "independent_check"
                      ? "یک سنجش کوتاه بدون کمک با تأیید معلم."
                      : r.action === "review_skill"
                        ? "مرور این مهارت در جلسه بعد و انتخاب سه تمرین معتبر توسط معلم."
                        : "یک تمرین پیگیری بدون کمک با تأیید معلم."}
                  </p>
                </div>
              )}
            </PagedList>
          </section>
          {me.role === "teacher" && (
            <section className="grid gap-3 glass-panel p-6">
              <h2 className="text-lg font-bold">مقایسه مأموریت‌ها</h2>
              <p className="text-xs text-slate-500">
                تفاوت موضوع و سختی سؤال‌ها می‌تواند مقایسه را محدود کند؛ این
                جدول ادعای پیشرفت قطعی ندارد.
              </p>
              <PagedList items={data.trends ?? []} label="روند یادگیری">
                {(t) => (
                  <div
                    className="flex flex-wrap gap-3 rounded-xl border border-slate-200 p-3 text-sm"
                    key={t.assignmentId}
                  >
                    <strong>{t.title}</strong>
                    <span>
                      {number(t.answered)} پاسخ · مستقل{" "}
                      {percent(t.independentSuccessRate)}
                    </span>
                  </div>
                )}
              </PagedList>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function MasteryReview({
  busy,
  submit,
}: {
  busy: boolean;
  submit: (status: string, reason: string) => Promise<void>;
}) {
  const [status, setStatus] = useState("needs_review"),
    [reason, setReason] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(status, reason);
      }}
    >
      <label className="grid gap-2 text-xs">
        تصمیم معلم درباره مهارت
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="min-h-11 glass-field p-2"
        >
          {Object.entries(labels)
            .filter(([k]) =>
              [
                "insufficient_evidence",
                "needs_practice",
                "developing",
                "proficient",
                "needs_review",
              ].includes(k),
            )
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
      </label>
      <label className="grid gap-2 text-xs">
        دلیل تصمیم معلم
        <input
          required
          minLength={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-11 glass-field p-2"
        />
      </label>
      <Button disabled={busy}>ثبت تصمیم و تاریخچه</Button>
    </form>
  );
}
