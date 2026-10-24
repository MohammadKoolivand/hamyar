"use client";
import { useEffect, useState } from "react";
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
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [data.answered, "سؤال پاسخ‌داده‌شده"],
              [data.independent, "صحیح بدون کمک"],
              [data.assisted, "صحیح با کمک"],
              [data.pending, "نیازمند بررسی معلم"],
            ].map(([n, title]) => (
              <div
                key={title}
                className="glass-card p-5"
              >
                <p className="text-xs text-slate-500">{title}</p>
                <strong className="mt-2 block text-2xl text-[#233B8F]">
                  {number(Number(n))}
                </strong>
              </div>
            ))}
          </section>
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
            {data.skills.map((skill) => (
              <div
                key={skill.skillId}
                className="grid gap-3 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold">{skill.title}</h3>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">
                    {labels[skill.status] ?? skill.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {number(skill.supportingAttempts)} تلاش قابل ارزیابی،{" "}
                  {number(skill.distinctQuestions)} سؤال متفاوت،{" "}
                  {number(skill.independentCorrect)} صحیح مستقل در اولین تلاش و{" "}
                  {number(skill.assistedCorrect)} صحیح با کمک
                </p>
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
            ))}
          </section>
          <section className="grid gap-3 glass-panel p-6">
            <h2 className="text-lg font-bold">دفترچه اشتباهات</h2>
            {!data.mistakes.length && (
              <p className="text-sm text-slate-500">
                هنوز خطای قابل ارزیابی ثبت نشده است.
              </p>
            )}
            {data.mistakes.map((item) => (
              <article
                key={item._id}
                className="grid gap-2 rounded-2xl border border-slate-200 p-4"
              >
                <h3 className="font-medium">{item.statement}</h3>
                {item.sourceAnswer && (
                  <p className="whitespace-pre-wrap text-sm text-slate-600">
                    پاسخ ثبت‌شده: {item.sourceAnswer}
                  </p>
                )}
                <p className="text-sm text-[#233B8F]">
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
            ))}
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
            {data.recommendations.map((r) => (
              <div
                className="grid gap-2 glass-note p-4 text-sm text-[#233B8F]"
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
            ))}
          </section>
          {me.role === "teacher" && (
            <section className="grid gap-3 glass-panel p-6">
              <h2 className="text-lg font-bold">مقایسه مأموریت‌ها</h2>
              <p className="text-xs text-slate-500">
                تفاوت موضوع و سختی سؤال‌ها می‌تواند مقایسه را محدود کند؛ این
                جدول ادعای پیشرفت قطعی ندارد.
              </p>
              {data.trends?.map((t) => (
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
              ))}
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
