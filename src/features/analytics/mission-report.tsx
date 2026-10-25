"use client";
import { PagedList } from "@/components/ui/paged-list";
import { useState } from "react";
import { CheckCircle2, XCircle, CircleHelp, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  QuestionPresentation,
  MathText,
} from "@/components/question-presentation";
import { fa, stateLabel } from "@/lib/presentation";
import type { Assignment, Report, ReportQuestion } from "@/lib/types";
const tone = (result: string) =>
  result === "correct"
    ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
    : ["incorrect", "partially_correct"].includes(result)
      ? "border-rose-200 bg-rose-50/60 text-rose-900"
      : result === "unanswered"
        ? "border-amber-200 bg-amber-50/70 text-amber-900"
        : "border-violet-200 bg-violet-50/60 text-violet-900";
const resultLabel = (result: string) =>
  result === "unanswered"
    ? "نزده"
    : (stateLabel[result] ?? "نیازمند بررسی معلم");
export function MissionReport({
  active,
  report,
  teacher,
  busy,
  onReview,
}: {
  active: Assignment;
  report: Report;
  teacher: boolean;
  busy: boolean;
  onReview: (id: string, result: string, note: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [targetPage, setTargetPage] = useState({ page: 1, token: 0 });
  const questions: ReportQuestion[] =
    report.questions ??
    (active.questions ?? []).map((q, index) => {
      const history = report.evidence
        .filter((t) => t.questionVersionId === q._id)
        .sort((a, b) => a.sequence - b.sequence);
      const last = history.at(-1);
      return {
        ...q,
        number: index + 1,
        visuals: q.visuals ?? [],
        answer: last?.answer ?? null,
        result: last
          ? (last.evaluation?.result ?? "pending_review")
          : "unanswered",
        hintsUsed: last?.hintsUsed ?? 0,
        attempts: history.length,
        topic: "",
        difficulty: q.difficulty ?? null,
        analysis: "",
      };
    });
  const correct = questions.filter((q) => q.result === "correct").length;
  const incorrect = questions.filter((q) =>
    ["incorrect", "partially_correct"].includes(q.result),
  ).length;
  const unanswered = questions.filter((q) => q.result === "unanswered").length;
  const pending = questions.length - correct - incorrect - unanswered;
  const percent = questions.length
    ? Math.round((correct / questions.length) * 100)
    : 0;
  const visible = questions.filter(
    (q) =>
      filter === "all" ||
      (filter === "incorrect"
        ? ["incorrect", "partially_correct"].includes(q.result)
        : filter === "pending"
          ? ![
              "correct",
              "incorrect",
              "partially_correct",
              "unanswered",
            ].includes(q.result)
          : q.result === filter),
  );
  return (
    <div className="grid gap-5">
      <section className="glass-panel grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
        <div>
          <p className="text-sm text-slate-500">
            گزارش عملکرد · {fa(report.answered)} از {fa(report.total)} پاسخ
            ثبت‌شده
          </p>
          <h2 className="mt-2 text-2xl font-bold">{active.title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {fa(report.independent)} پاسخ صحیح مستقل و {fa(report.assisted)}{" "}
            پاسخ صحیح با راهنما. نتیجه‌های نیازمند بررسی جدا محاسبه شده‌اند.
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-center">
          <strong className="text-3xl text-[#233B8F]">{fa(percent)}٪</strong>
          <p className="mt-2 text-xs text-slate-600">پاسخ صحیح از کل سؤال‌ها</p>
        </div>
        <div
          className="flex h-3 overflow-hidden rounded-full bg-slate-100 sm:col-span-2"
          aria-label="توزیع نتیجه سؤال‌ها"
        >
          {[
            [correct, "bg-emerald-400"],
            [incorrect, "bg-rose-400"],
            [unanswered, "bg-amber-400"],
            [pending, "bg-violet-400"],
          ].map(([n, color], i) => (
            <span
              key={i}
              className={String(color)}
              style={{ flexGrow: Number(n) }}
            />
          ))}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [correct, "صحیح", "correct", CheckCircle2],
          [incorrect, "نادرست / ناقص", "incorrect", XCircle],
          [unanswered, "نزده", "unanswered", MinusCircle],
          [pending, "نیازمند بررسی", "pending_review", CircleHelp],
        ].map(([n, title, result, Icon]) => {
          const Symbol = Icon as typeof CheckCircle2;
          return (
            <div
              key={String(title)}
              className={`flex items-center justify-between rounded-2xl border p-4 ${tone(String(result))}`}
            >
              <div>
                <p className="text-xs">{String(title)}</p>
                <strong className="mt-2 block text-2xl">{fa(Number(n))}</strong>
              </div>
              <Symbol size={26} />
            </div>
          );
        })}
      </div>
      <section className="glass-panel grid gap-4 p-5">
        <h2 className="text-lg font-bold">تحلیل و اولویت مرور</h2>
        <p className="text-sm leading-7">{report.recommendation}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {report.topics?.map((topic) => (
            <div
              key={topic.title}
              className={`rounded-xl border p-4 ${topic.incorrect || topic.unanswered ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/40"}`}
            >
              <h3 className="font-medium">{topic.title}</h3>
              <p className="mt-2 text-xs leading-6">
                از {fa(topic.total)} سؤال: {fa(topic.correct)} صحیح،{" "}
                {fa(topic.incorrect)} نادرست، {fa(topic.unanswered)} نزده
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs leading-6 text-slate-500">
          موفقیت مستقل در اولین تلاش:{" "}
          {report.independentSuccessRate === null
            ? "داده کافی نداریم"
            : `${fa(Math.round(report.independentSuccessRate * 100))}٪ از ${fa(report.eligibleFirstAttempts)} تلاش قابل ارزیابی`}
          . این تحلیل از پاسخ‌های ثبت‌شده محاسبه شده؛ علت خطای مفهومی را از
          انتخاب گزینه حدس نمی‌زنیم.
        </p>
      </section>
      {teacher && !!report.hintFeedback?.length && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-bold">راهنماهای گزارش‌شده برای بررسی</h2>
          {report.hintFeedback.map((item) => (
            <p key={item._id} className="mt-2 text-sm">
              {item.reason}
            </p>
          ))}
        </section>
      )}
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">بررسی سؤال‌به‌سؤال</h2>
          <Field title="فیلتر نتیجه">
            <select
              className="glass-field min-h-11 p-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {[
                ["all", "همه"],
                ["correct", "صحیح"],
                ["incorrect", "نادرست"],
                ["unanswered", "نزده"],
                ["pending", "نیازمند بررسی"],
              ].map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <nav aria-label="نقشه نتیجه سؤال‌ها" className="flex flex-wrap gap-2">
          {questions.map((q) => (
            <a
              key={q._id}
              href={`#report-question-${q._id}`}
              title={`سؤال ${fa(q.number)}: ${resultLabel(q.result)}`}
              onClick={(event) => {
                event.preventDefault();
                setFilter("all");
                setTargetPage((old) => ({
                  page: Math.floor((q.number - 1) / 10) + 1,
                  token: old.token + 1,
                }));
                requestAnimationFrame(() =>
                  document
                    .getElementById(`report-question-${q._id}`)
                    ?.scrollIntoView({ block: "start" }),
                );
              }}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-bold ${tone(q.result)}`}
            >
              {fa(q.number)}
            </a>
          ))}
        </nav>
        {!visible.length && (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-500">
            سؤالی با این وضعیت وجود ندارد.
          </p>
        )}
        <PagedList
          key={`${filter}-${targetPage.token}`}
          initialPage={filter === "all" ? targetPage.page : 1}
          items={visible}
          label="گزارش سؤال‌ها"
        >
          {(q) => (
            <article
              id={`report-question-${q._id}`}
              key={q._id}
              className="scroll-mt-6 rounded-3xl border border-blue-200/70 bg-gradient-to-bl from-white/85 via-blue-50/65 to-cyan-50/45 p-4 text-[#233B8F] shadow-[0_8px_30px_rgba(35,59,143,0.05),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold">سؤال {fa(q.number)}</h3>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${tone(q.result)}`}
                  >
                    {resultLabel(q.result)}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {q.topic} · {fa(q.attempts)} تلاش · {fa(q.hintsUsed)} راهنما
                </span>
              </div>
              <div className="rounded-xl bg-white/80 p-3 text-slate-800">
                <QuestionPresentation
                  statement={q.statement}
                  visuals={q.visuals}
                />
              </div>
              {q.type === "choice" ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.options.map((option, index) => {
                    const selected = option === q.answer,
                      right = option === q.reference;
                    return (
                      <div
                        key={index}
                        className={`rounded-xl border p-3 text-sm leading-7 ${right || (selected && q.result === "correct") ? "border-emerald-400 bg-emerald-100/80 text-emerald-950" : selected ? (q.result === "pending_review" ? "border-violet-300 bg-violet-100/80 text-violet-950" : "border-rose-400 bg-rose-100/80 text-rose-950") : "border-slate-200 bg-white/70 text-slate-600"}`}
                      >
                        <span className="font-bold">{fa(index + 1)}. </span>
                        <MathText text={option} />
                        <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                          {selected && <span>انتخاب شما</span>}
                          {right && <span>✓ پاسخ صحیح</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/70 p-3">
                    <p className="mb-2 text-xs">پاسخ شما</p>
                    <MathText text={q.answer ?? "بدون پاسخ"} />
                  </div>
                  {q.reference !== undefined && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                      <p className="mb-2 text-xs">پاسخ مرجع</p>
                      <MathText text={q.reference} />
                    </div>
                  )}
                </div>
              )}
              {q.result === "unanswered" && (
                <p className="mt-3 text-sm font-medium">
                  این سؤال را پاسخ نداده‌اید.
                </p>
              )}
              {q.reference === undefined && (
                <p className="mt-3 text-xs">
                  پاسخ مرجع پس از پایان تمرین نمایش داده می‌شود.
                </p>
              )}
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {q.analysis}
              </p>
              {teacher && (
                <details className="mt-4 rounded-xl bg-white/60 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    تاریخچه تلاش‌ها و بازبینی معلم
                  </summary>
                  {report.evidence
                    .filter((t) => t.questionVersionId === q._id)
                    .map((t) => (
                      <div
                        className="mt-4 grid gap-3 border-t border-slate-200 pt-3"
                        key={t._id}
                      >
                        <p className="text-sm">
                          تلاش {fa(t.sequence)}: <MathText text={t.answer} /> ·{" "}
                          {stateLabel[t.evaluation?.result ?? ""]}
                        </p>
                        {t.evaluation?.reviews?.map((review, i) => (
                          <p key={i} className="text-xs">
                            {review.note} · {stateLabel[review.previousResult]}{" "}
                            ← {stateLabel[review.result]}
                          </p>
                        ))}
                        {t.evaluation && (
                          <Review
                            disabled={busy}
                            submit={(result, note) =>
                              onReview(t.evaluation!._id, result, note)
                            }
                          />
                        )}
                      </div>
                    ))}
                </details>
              )}
            </article>
          )}
        </PagedList>
      </section>
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
            className="w-full min-h-[46px] glass-field p-3"
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
            className="w-full min-h-[46px] glass-field p-3"
          />
        </Field>
        <Button variant="outline" disabled={disabled}>
          ثبت بازبینی
        </Button>
      </div>
    </form>
  );
}
