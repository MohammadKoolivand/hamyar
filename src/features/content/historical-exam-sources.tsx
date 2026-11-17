"use client";

import { useMemo, useState } from "react";
import { historicalExamAssets, type HistoricalExamAsset } from "@/lib/historical-exam-sources";

const groupLabels: Record<string, string> = {
  math: "ریاضی", experimental: "تجربی", humanities: "انسانی",
  art: "هنر", languages: "زبان",
};

export function historicalExamLabel(asset: HistoricalExamAsset): string {
  const match = /^konkur-(\d{4})-(first|second|annual)-([a-z]+)$/.exec(asset.examId);
  if (match) {
    const [, year, sitting, group] = match;
    const session = sitting === "first" ? "نوبت اول" : sitting === "second" ? "نوبت دوم" : "سالانه";
    return `کنکور ${groupLabels[group] ?? group} ${year} ـ ${session}`;
  }
  if (asset.examId.startsWith("final-")) return `امتحان نهایی ${asset.subject} ـ خرداد ۱۴۰۴`;
  return asset.examId;
}
export function HistoricalExamSources({
  onChoose,
}: {
  onChoose?: (asset: HistoricalExamAsset) => void;
}) {
  const [year, setYear] = useState("");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const years = useMemo(() =>
    [...new Set(historicalExamAssets.map((asset) => asset.examId.match(/-(\d{4})-/)?.[1]).filter((year): year is string => Boolean(year)))].sort().reverse(), []);
  const filtered = useMemo(() => historicalExamAssets.filter((asset) => {
    const text = `${historicalExamLabel(asset)} ${asset.subject} ${asset.booklet}`;
    return (!year || asset.examId.includes(`-${year}-`)) &&
      (!kind || (kind === "final" ? asset.examId.startsWith("final-") : asset.examId.startsWith("konkur-"))) &&
      (!query.trim() || text.includes(query.trim()));
  }), [year, kind, query]);
  const verifiedPairCount = historicalExamAssets.filter((a) =>
    Boolean(a.questionUrl && a.answerUrl)).length;
  return (
    <section aria-label="آرشیو منابع آزمون‌های سال‌های گذشته" dir="rtl" className="glass-panel grid gap-4 p-4 sm:p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-[#17305E]">آرشیو دفترچه و کلید آزمون‌ها</h3>
        <p className="text-sm leading-7 text-slate-600">
          {verifiedPairCount.toLocaleString("fa-IR")} ردیف دارای نشانی سؤال و کلید و
          {historicalExamAssets.length - verifiedPairCount} ردیف دارای ارجاع کلید بدون فایل سؤال.
          این‌ها منابع بیرونی‌اند؛ هنوز OCR، بازبینی و تأیید ورود به بانک انجام نشده است.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">سال
          <select aria-label="سال منابع" className="glass-field min-h-11 p-2" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">همه سال‌ها</option>
            {years.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">نوع
          <select aria-label="نوع منابع" className="glass-field min-h-11 p-2" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">همه آزمون‌ها</option>
            <option value="konkur">کنکور</option>
            <option value="final">امتحان نهایی</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">جست‌وجوی درس یا دفترچه
          <input className="glass-field min-h-11 p-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً زیست‌شناسی" />
        </label>
      </div>
      <p className="text-xs text-slate-500" role="status">{filtered.length.toLocaleString("fa-IR")} ردیف مطابق فیلترها</p>
      <div className="grid max-h-[32rem] gap-3 overflow-y-auto">
        {filtered.map((asset) => (
          <article key={asset.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <h4 className="font-semibold text-slate-800">{historicalExamLabel(asset)}</h4>
              <p className="mt-1 text-xs text-slate-600">{asset.subject} · {asset.booklet}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {asset.questionUrl
                ? <a className="text-blue-700 underline" target="_blank" rel="noopener noreferrer" href={asset.questionUrl}>PDF سؤال</a>
                : <span className="text-slate-500">PDF سؤال: پیدا نشده</span>}
              {asset.answerUrl
                ? <a className="text-blue-700 underline" target="_blank" rel="noopener noreferrer" href={asset.answerUrl}>PDF کلید</a>
                : <span className="text-slate-500">PDF کلید: پیدا نشده</span>}
              {asset.sourceUrl && <a className="text-slate-600 underline" target="_blank" rel="noopener noreferrer" href={asset.sourceUrl}>صفحه منبع</a>}
            </div>
            <p className="text-xs leading-6 text-amber-800">
              {asset.verification === "official_key_url_reported_not_accessible"
                ? "آدرس کلید در خبر رسمی نقل شده، اما PDF از این محیط قابل دریافت و تأیید نبوده است."
                : asset.warning.includes("watermarked") ? "پاسخنامه دارای نشان غیرقابل استناد است؛ تأیید انسانی ضروری است."
                : "پیش از استفاده، صحت کلید، حقوق استفاده و مطابقت فایل با نوبت آزمون بررسی شود."}
            </p>
            {onChoose && <button type="button" onClick={() => onChoose(asset)}
              className="w-fit min-h-10 rounded-lg border border-indigo-300 px-3 text-sm text-indigo-800 hover:bg-indigo-50">
              انتخاب مشخصات برای ثبت آزمون
            </button>}
          </article>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-500">در این فیلتر منبعی ثبت نشده است.</p>}
      </div>
      <p className="text-xs leading-6 text-slate-500">
        انتخاب آزمون فقط فرم ثبت را تکمیل می‌کند. برای پردازش باید PDF مجاز را دستی دانلود و بارگذاری کنید؛
        هیچ فایل بیرونی خودکار وارد بانک سؤال یا منتشر نمی‌شود.
      </p>
    </section>
  );
}
