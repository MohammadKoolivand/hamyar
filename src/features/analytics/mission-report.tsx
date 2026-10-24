"use client";
import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { fa, stateLabel } from "@/lib/presentation";
import type { Assignment, Report } from "@/lib/types";
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
  return (
    <>
      <section className="glass-hero flex items-center justify-between gap-6 p-8 [&_p]:mt-3 [&_p]:leading-loose max-[650px]:p-6 max-[650px]:[&_svg]:hidden">
        <div>
          <small className="text-xs leading-loose text-slate-500">
            گزارش مبتنی بر پاسخ‌های ثبت‌شده
          </small>
          <h2 className="font-bold mt-3 text-[25px]">{active.title}</h2>
          <p>
            از {fa(report.total)} سؤال، {fa(report.independent)} سؤال بدون
            راهنمایی و {fa(report.assisted)} سؤال با راهنمایی درست حل شده است.
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
            className="glass-stat p-[22px] [&_strong]:mt-2.5 [&_strong]:block [&_strong]:text-[28px] [&_strong]:text-[#1f3f97] max-[650px]:p-4"
          >
            <small className="text-xs leading-loose text-slate-500">{t}</small>
            <strong>{fa(Number(v))}</strong>
          </div>
        ))}
      </div>
      <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
        <h2 className="text-[19px] font-bold">استقلال در اولین تلاش</h2>
        <p>
          {report.independentSuccessRate === null
            ? "هنوز شواهد ارزیابی‌شده کافی نداریم."
            : `${fa(Math.round(report.independentSuccessRate * 100))}٪ از ${fa(report.eligibleFirstAttempts)} اولین تلاشِ قابل ارزیابی، مستقل و صحیح بوده است.`}
        </p>
        <small className="text-xs leading-loose text-slate-500">
          تعداد کم سؤال، نشانه قطعی تسلط نیست. پاسخ صحیح در تلاش‌های بعدی جدا از
          این شاخص محاسبه می‌شود.
        </small>
        <div className="glass-note p-3.5 leading-[1.9]">
          <h3 className="text-base font-bold">
            {teacher ? "پیشنهاد برای جلسه بعد" : "گام بعدی پیشنهادی"}
          </h3>
          <p>{report.recommendation}</p>
          <small className="text-xs leading-loose text-slate-500">
            پیشنهاد قاعده‌محور؛ مبتنی بر شواهد زیر، بدون تشخیص قطعی نوع خطا
          </small>
        </div>
      </section>
      <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
        <h2 className="text-[19px] font-bold">
          {teacher ? "شواهد تلاش‌ها و بازبینی" : "نتیجه سؤال‌ها"}
        </h2>
        {teacher &&
          report.hintFeedback?.map((item) => (
            <div
              className="rounded-xl bg-amber-50 p-3 text-amber-900"
              key={item._id}
            >
              گزارش راهنما: {item.reason}
            </div>
          ))}
        {report.evidence.map((t) => (
          <div
            key={t._id}
            className="grid gap-3 rounded-2xl border border-slate-200 p-[18px] text-[13px] leading-loose"
          >
            <h3 className="text-base font-bold">
              {
                active.questions?.find((q) => q._id === t.questionVersionId)
                  ?.statement
              }
            </h3>
            <p className="whitespace-pre-wrap">پاسخ: {t.answer}</p>
            <p>
              {stateLabel[t.evaluation?.result ?? ""] ?? "در انتظار ارزیابی"} ·
              تلاش {fa(t.sequence)} · {fa(t.hintsUsed)} راهنمایی
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
                        className="glass-note p-3.5 leading-[1.9]"
                      >
                        <p>{review.note}</p>
                        <small className="text-xs leading-loose text-slate-500">
                          {stateLabel[review.previousResult]} ←{" "}
                          {stateLabel[review.result]} ·{" "}
                          {new Date(review.createdAt).toLocaleString("fa-IR")}
                        </small>
                      </div>
                    ))}
                  </details>
                )}
                {t.evaluation && (
                  <Review
                    disabled={busy}
                    submit={(result, note) =>
                      onReview(t.evaluation!._id, result, note)
                    }
                  />
                )}
              </>
            )}
          </div>
        ))}
      </section>
    </>
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
