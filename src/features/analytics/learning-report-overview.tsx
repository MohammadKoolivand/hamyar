"use client";

import { useMemo, useState } from "react";
import { AppLink as Link } from "@/components/app-link";
import {
  filterRecentMissions,
  learningNextStep,
  missionSuccessRate,
  type MissionResultFilter,
  type RecentLearningMission,
} from "./learning-report-model";

const faNumber = (value: number) => value.toLocaleString("fa-IR");
const rate = (value: number | null) => value === null ? "شواهد کافی نیست" : `${faNumber(Math.round(value * 100))}٪`;

export function LearningReportOverview({
  missions,
  independentSuccessRate,
  eligibleFirstAttempts,
  hintUsageRate,
  skills,
  canOpenReports,
}: {
  missions: RecentLearningMission[];
  independentSuccessRate: number | null;
  eligibleFirstAttempts: number;
  hintUsageRate: number | null;
  skills: { status: string; incorrect: number; title: string }[];
  canOpenReports: boolean;
}) {
  const [filter, setFilter] = useState<MissionResultFilter>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterRecentMissions(missions, filter, query), [missions, filter, query]);
  const needsReview = skills.filter((skill) => ["needs_practice", "needs_review"].includes(skill.status)).length;
  return (
    <section aria-labelledby="learning-report-title" className="grid gap-5">
      <div className="grid gap-4 border-b border-slate-200 pb-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold text-[#3655A0]">نتایج و گزارش یادگیری</p>
          <h2 id="learning-report-title" className="mt-1 text-xl font-bold text-[#17305E]">مسیر پیشرفت من</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">این گزارش از تمرین‌های قابل‌نمایش و پاسخ‌های ثبت‌شده ساخته می‌شود؛ پاسخ با راهنما از حل مستقل جداست.</p>
        </div>
        {canOpenReports && <Link href="/homeworks" className="text-sm font-semibold text-[#233B8F] underline-offset-4 hover:underline">رفتن به مأموریت‌ها ←</Link>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [rate(independentSuccessRate), "موفقیت مستقل در اولین تلاش", `${faNumber(eligibleFirstAttempts)} تلاش قابل ارزیابی`],
          [rate(hintUsageRate), "میزان استفاده از راهنما", "بر پایه سؤال‌های اختصاص‌داده‌شده"],
          [faNumber(needsReview), "مهارت نیازمند مرور", "بر اساس شواهد موجود"],
        ].map(([value, title, note]) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">{title}</p>
            <strong className="mt-2 block text-xl text-[#17305E]">{value}</strong>
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
        <h3 className="text-sm font-bold text-[#17305E]">گام بعدی پیشنهادی</h3>
        <p className="mt-2 text-sm leading-7 text-slate-700">{learningNextStep(skills)}</p>
      </div>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-[#17305E]">روند تمرین‌های اخیر</h3>
          <span className="text-xs text-slate-500">{faNumber(visible.length)} نتیجه از {faNumber(missions.length)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-1 text-xs text-slate-600">جست‌وجوی نام آزمون
            <input className="glass-field min-h-11 px-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام تمرین یا آزمون" />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">وضعیت نتیجه
            <select className="glass-field min-h-11 px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value as MissionResultFilter)}>
              <option value="all">همه نتایج</option>
              <option value="needs-review">نیازمند مرور</option>
              <option value="finished">ثبت‌شده / تکمیل‌شده</option>
            </select>
          </label>
        </div>
        {!missions.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm leading-7 text-slate-600">هنوز تمرین دارای نتیجه‌ی قابل‌نمایش وجود ندارد. پس از انجام تمرین، روند یادگیری اینجا نمایش داده می‌شود.</p>
        ) : !visible.length ? (
          <p role="status" className="rounded-xl border border-slate-200 p-5 text-sm text-slate-600">با این جست‌وجو یا فیلتر نتیجه‌ای پیدا نشد.</p>
        ) : (
          <div className="grid gap-2">
            {visible.map((mission) => {
              const success = missionSuccessRate(mission);
              const content = (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#17305E]">{mission.title}</h4>
                    <span className="text-xs text-slate-600">{rate(success)} پاسخ صحیح ارزیابی‌شده</span>
                  </div>
                  <div role="img" aria-label={`سهم پاسخ‌های صحیح ارزیابی‌شده: ${rate(success)}`} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    {success !== null && <div className="h-full rounded-full bg-emerald-500" style={{ width: `${success * 100}%` }} />}
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{faNumber(mission.answered)} از {faNumber(mission.total)} پاسخ · {faNumber(mission.independent)} صحیح مستقل · {faNumber(mission.assisted)} با راهنما · {faNumber(mission.incorrect)} نادرست{(mission.pending ?? 0) > 0 ? ` · ${faNumber(mission.pending ?? 0)} در انتظار بررسی` : ""}</p>
                </>
              );
              return canOpenReports ? (
                <Link key={mission.assignmentId} href={`/report?assignment=${encodeURIComponent(mission.assignmentId)}`} className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{content}<span className="mt-2 block text-xs font-semibold text-[#233B8F]">مشاهده‌ی گزارش سؤال‌به‌سؤال ←</span></Link>
              ) : <article key={mission.assignmentId} className="rounded-xl border border-slate-200 bg-white p-4">{content}</article>;
            })}
          </div>
        )}
        <p className="text-xs leading-6 text-slate-500">نمودار هر تمرین نسبت پاسخ‌های صحیح به پاسخ‌های دارای ارزیابی مشخص را نشان می‌دهد؛ سؤال‌های نزده و در انتظار بررسی در مخرج این نسبت نیستند. مقایسه‌ی تمرین‌ها به‌تنهایی نشانه‌ی تغییر قطعی سطح یادگیری نیست.</p>
      </div>
    </section>
  );
}
