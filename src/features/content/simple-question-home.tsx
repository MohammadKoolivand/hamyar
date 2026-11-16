"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileDown, Search, RotateCcw } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { QuestionPresentation, MathText, QuestionVisualView } from "@/components/question-presentation";
import { api } from "@/lib/api";
import { sourceCategories, sourceCategory, sourceSummary } from "@/lib/question-source";
import type { PublicBankQuestion } from "@/lib/public-bank";
import { printQuestions } from "@/lib/print-questions";

/**
 * Public, single-page MVP. The original login, dashboards, teacher tools,
 * exercises and PDF-library components remain in the repository; only the
 * Next.js route entrypoints are temporarily switched to this public screen.
 */
export default function SimpleQuestionHome() {
  const [questions, setQuestions] = useState<PublicBankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [book, setBook] = useState("");
  const [category, setCategory] = useState("");
  const [track, setTrack] = useState("");
  const [year, setYear] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const printable = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api<PublicBankQuestion[]>("/questions/public")
      .then((rows) => { if (active) setQuestions(rows); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "دریافت سؤال‌ها ممکن نشد.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const options = (key: "grade" | "book") =>
    [...new Set(questions.map((q) => q.taxonomy?.[key] ?? "").filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fa"));
  const years = [...new Set(questions.map((q) => String(q.year ?? q.source?.academicYear ?? "")).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a, "fa"));
  const visible = useMemo(() => questions.filter((q) => {
    const searchable = [q.statement, q.taxonomy?.topic, q.taxonomy?.chapter, q.taxonomy?.book, q.source?.sourceTitle].join(" ");
    return (!search.trim() || searchable.includes(search.trim())) &&
      (!grade || q.taxonomy?.grade === grade) &&
      (!book || q.taxonomy?.book === book) &&
      (!category || sourceCategory(q.source) === category) &&
      (!track || q.source?.group === track || q.source?.track === (track === "mathematics" ? "ریاضی و فیزیک" : "علوم تجربی")) &&
      (!year || String(q.year ?? q.source?.academicYear ?? "") === year) &&
      (!difficulty || q.difficulty === difficulty);
  }), [questions, search, grade, book, category, track, year, difficulty]);

  const chosen = selected.length
    ? visible.filter((q) => selected.includes(q._id))
    : visible;

  async function downloadPdf() {
    if (!printable.current || !chosen.length) return;
    setPrinting(true);
    setError("");
    try {
      await printQuestions(printable.current, "نمونه‌سؤال‌های هدهد");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ساخت خروجی PDF ممکن نشد.");
    } finally {
      setPrinting(false);
    }
  }
  const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-offset-2 focus:border-blue-500";
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-800" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Brand />
          <span className="rounded-full bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
            بانک سؤال رایگان
          </span>
          {/*
            ورود/ثبت‌نام، منوی پنل معلم، داشبوردها و سایر مسیرها
            برای نسخه تک‌صفحه‌ای فعلاً در رابط غیرفعال‌اند؛
            پیاده‌سازی کامل آن‌ها در HamyarApp و فایل‌هایشان باقی مانده است.
          */}
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10">
        <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 text-blue-900">
            <BookOpen size={26} aria-hidden />
            <h1 className="text-2xl font-bold sm:text-3xl">نمونه‌سؤال‌های هدهد</h1>
          </div>
          <p className="mt-3 text-sm leading-8 text-slate-600">
            پایه، درس یا نوع آزمون را انتخاب کن، سؤال‌های دلخواهت را علامت بزن و خروجی PDF بگیر.
            فقط سؤال‌های عمومی و تأییدشده نمایش داده می‌شوند.
          </p>
        </section>

        <section aria-label="فیلتر سؤال‌ها" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2 font-bold">
            <Search size={19} aria-hidden /> پیدا کردن سؤال
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">جست‌وجوی متن یا مبحث
              <input className={fieldClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="مثلاً تابع، هندسه، زیست..." />
            </label>
            <label className="text-sm">پایه
              <select className={fieldClass} value={grade} onChange={(e) => { setGrade(e.target.value); setBook(""); }}>
                <option value="">همه پایه‌ها</option>
                {options("grade").map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">درس
              <select className={fieldClass} value={book} onChange={(e) => setBook(e.target.value)}>
                <option value="">همه درس‌ها</option>
                {[...new Set(questions.filter((q) => !grade || q.taxonomy?.grade === grade).map((q) => q.taxonomy?.book ?? "").filter(Boolean))]
                  .sort((a, b) => a.localeCompare(b, "fa")).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">نوع آزمون
              <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">همه انواع</option>
                {sourceCategories.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
            <label className="text-sm">رشته / گروه کنکور
              <select className={fieldClass} value={track} onChange={(e) => setTrack(e.target.value)}>
                <option value="">همه رشته‌ها</option>
                <option value="mathematics">ریاضی</option>
                <option value="experimental">تجربی</option>
              </select>
            </label>
            <label className="text-sm">سال آزمون
              <select className={fieldClass} value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">همه سال‌ها</option>
                {years.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-sm">درجه سختی
              <select className={fieldClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">همه سطوح</option>
                <option value="easy">آسان</option>
                <option value="medium">متوسط</option>
                <option value="hard">سخت</option>
              </select>
            </label>
          </div>
          <button type="button" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm hover:bg-slate-50"
            onClick={() => { setSearch(""); setGrade(""); setBook(""); setCategory(""); setTrack(""); setYear(""); setDifficulty(""); setSelected([]); }}>
            <RotateCcw size={16} aria-hidden /> پاک کردن فیلترها
          </button>
        </section>

        <section aria-label="نتایج سؤال" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">{visible.length.toLocaleString("fa-IR")} سؤال پیدا شد</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                disabled={!visible.length} onClick={() => setSelected(visible.map((q) => q._id))}>
                انتخاب همه
              </button>
              <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm"
                disabled={!selected.length} onClick={() => setSelected([])}>
                لغو انتخاب
              </button>
              <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={printing || !chosen.length} onClick={() => void downloadPdf()}>
                <FileDown size={18} aria-hidden />
                {printing ? "در حال آماده‌سازی..." : `خروجی PDF (${chosen.length.toLocaleString("fa-IR")})`}
              </button>
            </div>
          </div>
          {loading && <p role="status" className="rounded-2xl bg-white p-5">در حال بارگذاری سؤال‌ها…</p>}
          {error && <p role="alert" className="rounded-2xl bg-rose-50 p-5 text-rose-800">{error}</p>}
          {!loading && !error && !visible.length &&
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              برای این فیلترها هنوز سؤال عمومیِ تأییدشده‌ای ثبت نشده است.
            </p>}
          {visible.map((q, i) => (
            <article key={q._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <label className="mb-3 flex cursor-pointer items-center gap-3 text-sm font-semibold text-blue-900">
                <input type="checkbox" className="size-5" checked={selected.includes(q._id)}
                  onChange={(e) => setSelected((prev) => e.target.checked ? [...new Set([...prev, q._id])] : prev.filter((id) => id !== q._id))} />
                انتخاب سؤال {(i + 1).toLocaleString("fa-IR")}
              </label>
              <QuestionPresentation statement={q.statement} options={q.type === "choice" ? q.options : undefined}
                optionImages={q.optionImages} visuals={q.visuals} visualLayout={q.visualLayout} />
              <p className="mt-3 text-xs text-slate-500">{sourceSummary(q.source)}</p>
            </article>
          ))}
        </section>
        <div className="hidden" aria-hidden="true">
          <div ref={printable} dir="rtl">
            <h1>نمونه‌سؤال‌های هدهد</h1>
            {chosen.map((q, i) => (
              <article key={q._id} className="pdf-question">
                <div className="pdf-question-head">
                  <span className="pdf-number">{(i + 1).toLocaleString("fa-IR")}ـ</span>
                  <div className="pdf-statement"><MathText text={q.statement} /></div>
                  <span className="pdf-source">{sourceSummary(q.source)}</span>
                </div>
                {!!q.options?.length && <ol className="pdf-options">
                  {q.options.map((option, index) => (
                    <li key={index} className="pdf-option">
                      <span>{(index + 1).toLocaleString("fa-IR")})</span>
                      <span className="pdf-option-text">
                        <MathText text={option} />
                        {q.optionImages?.[index] && <QuestionVisualView visual={q.optionImages[index]!} />}
                      </span>
                    </li>
                  ))}
                </ol>}
                {!!q.visuals?.length && <div className="pdf-visuals">
                  {q.visuals.map((visual, index) => <QuestionVisualView key={index} visual={visual} />)}
                </div>}
              </article>
            ))}
          </div>
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
        هدهد · جست‌وجوی رایگان نمونه‌سؤال و خروجی PDF
      </footer>
    </div>
  );
}
