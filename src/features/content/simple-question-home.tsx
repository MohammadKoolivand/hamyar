"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileDown, Search, RotateCcw, X, Layers3, GraduationCap, BookMarked, ListTree, Target, ClipboardList, Gauge, CalendarRange, ArrowDownWideNarrow, ThumbsUp } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { QuestionPresentation, MathText, QuestionVisualView } from "@/components/question-presentation";
import { api } from "@/lib/api";
import { sourceCategories, sourceSummary } from "@/lib/question-source";
import { validExamCoverageId } from "@/lib/exam-catalog";
import { publicQuestionCatalogIds, publicExamEvents, type CatalogPublicQuestion } from "@/lib/exam-catalog-coverage";
import { printQuestions } from "@/lib/print-questions";
import { homeQuestionTaxonomy, homeQuestionYear, initialHomeFilters, matchesHomeQuestion, sortHomeQuestions, type HomeFilterKey, type HomeSort } from "@/lib/home-question-filters";

/**
 * Public, single-page MVP. The original login, dashboards, teacher tools,
 * exercises and PDF-library components remain in the repository; only the
 * Next.js route entrypoints are temporarily switched to this public screen.
 */
export default function SimpleQuestionHome() {
  const [questions, setQuestions] = useState<CatalogPublicQuestion[]>([]);
  const [catalogFilter, setCatalogFilter] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(initialHomeFilters);
  const [sortBy, setSortBy] = useState<HomeSort>("newest");
  const [recommending, setRecommending] = useState("");
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const printable = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedExam = new URLSearchParams(window.location.search).get("exam") ?? "";
    if (selectedExam && validExamCoverageId(selectedExam)) setCatalogFilter(selectedExam);
  }, []);

  useEffect(() => {
    let active = true;
    api<CatalogPublicQuestion[]>("/questions/public")
      .then((rows) => { if (active) setQuestions(rows); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "دریافت سؤال‌ها ممکن نشد.");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const taxonomyOrder: HomeFilterKey[] = ["level", "grade", "book", "chapter", "topic"];
  function setTaxonomy(key: HomeFilterKey, value: string) {
    setFilters((previous) => {
      const next = { ...previous, [key]: value };
      for (const child of taxonomyOrder.slice(taxonomyOrder.indexOf(key) + 1)) next[child] = "";
      return next;
    });
    setSelected([]);
  }
  const taxonomyOptions = (key: HomeFilterKey) => {
    const parents = taxonomyOrder.slice(0, taxonomyOrder.indexOf(key));
    return [...new Set(questions.filter((q) =>
      parents.every((parent) => !filters[parent] || homeQuestionTaxonomy(q, parent) === filters[parent]))
      .map((q) => homeQuestionTaxonomy(q, key)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fa"));
  };
  const years = [...new Set(questions.map(homeQuestionYear).filter((year): year is number => year !== null))]
    .sort((a, b) => a - b);

  const visible = useMemo(() => sortHomeQuestions(questions.filter((q) =>
    matchesHomeQuestion(q, filters) &&
    (!catalogFilter || (catalogFilter.startsWith("event-")
      ? publicExamEvents([q]).some((item) => item.id === catalogFilter)
      : publicQuestionCatalogIds(q).includes(catalogFilter)))
  ), sortBy), [questions, filters, catalogFilter, sortBy]);

  const chosen = selected.length
    ? visible.filter((q) => selected.includes(q._id))
    : visible;

  async function recommendQuestion(questionId: string) {
    setRecommending(questionId);
    setRecommendationMessage("");
    try {
      const response = await api<{ recommendationCount: number }>("/questions/" + questionId + "/recommend", {});
      setQuestions((previous) => previous.map((q) =>
        q._id === questionId ? { ...q, recommendationCount: response.recommendationCount } : q));
      setRecommendationMessage("پیشنهاد شما ثبت شد.");
    } catch (cause) {
      setRecommendationMessage(cause instanceof Error
        ? "برای پیشنهاد سؤال، ابتدا وارد حساب کاربری شوید. " + cause.message
        : "ثبت پیشنهاد انجام نشد.");
    } finally {
      setRecommending("");
    }
  }

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
  const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base leading-6 outline-offset-2 focus:border-blue-500";
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-800" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Brand />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a href="/exam-import"
              className="inline-flex min-h-11 items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100">
              ورود آزمون و OCR (ویژه معلم)
            </a>
          <a href="/exam-catalog"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
            بانک سؤال رایگان
            <BookOpen size={16} aria-hidden />
          </a>
          </div>
          {/*
            ورود/ثبت‌نام، منوی پنل معلم، داشبوردها و سایر مسیرها
            برای نسخه تک‌صفحه‌ای فعلاً در رابط غیرفعال‌اند؛
            پیاده‌سازی کامل آن‌ها در HamyarApp و فایل‌هایشان باقی مانده است.
          */}
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10">
        <section aria-label="فیلتر سؤال‌ها" className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-3 text-blue-900">
            <span className="rounded-2xl bg-blue-50 p-3"><BookOpen size={26} aria-hidden /></span>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">نمونه‌سؤال‌های هدهد</h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                سؤال دلخواهت را با فیلترهای دقیق پیدا کن، مرتب کن و خروجی PDF بگیر.
              </p>
            </div>
          </div>
          <div className="my-6 border-t border-slate-100" />
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
            <Search size={19} className="text-blue-600" aria-hidden /> پیدا کردن سؤال
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <label className="text-base font-semibold text-slate-700">
              <span className="flex items-center gap-2"><Search size={17} className="text-blue-500" aria-hidden /> جست‌وجوی متن</span>
              <input className={fieldClass} value={filters.search}
                onChange={(e) => setFilters((old) => ({ ...old, search: e.target.value }))}
                placeholder="مثلاً تابع، هندسه، زیست..." />
            </label>
            {([
              ["level", "مقطع", "همه مقاطع", Layers3, "text-violet-500"],
              ["grade", "پایه", "همه پایه‌ها", GraduationCap, "text-pink-500"],
              ["book", "درس", "همه درس‌ها", BookMarked, "text-emerald-500"],
              ["chapter", "فصل", "همه فصل‌ها", ListTree, "text-amber-500"],
              ["topic", "مبحث", "همه مباحث", Target, "text-sky-500"],
            ] as const).map(([key, title, placeholder, Icon, iconColor]) => (
              <label key={key} className="text-base font-semibold text-slate-700">
                <span className="flex items-center gap-2"><Icon size={17} className={iconColor} aria-hidden /> {title}</span>
                <select className={fieldClass} value={filters[key]} onChange={(e) => setTaxonomy(key, e.target.value)}>
                  <option value="">{placeholder}</option>
                  {taxonomyOptions(key).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
            <label className="text-base font-semibold text-slate-700">
              <span className="flex items-center gap-2"><ClipboardList size={17} className="text-orange-500" aria-hidden /> نوع سؤال</span>
              <select className={fieldClass} value={filters.category} onChange={(e) => setFilters((old) => ({ ...old, category: e.target.value }))}>
                <option value="">همه انواع</option>
                {sourceCategories.map((item) => <option key={item.id} value={item.id}>{item.id === "konkur" ? "کنکور سراسری" : item.label}</option>)}
                <option value="konkur-azad">کنکور آزاد</option>
              </select>
            </label>
            <label className="text-base font-semibold text-slate-700">
              <span className="flex items-center gap-2"><Gauge size={17} className="text-rose-500" aria-hidden /> درجه سختی</span>
              <select className={fieldClass} value={filters.difficulty} onChange={(e) => setFilters((old) => ({ ...old, difficulty: e.target.value }))}>
                <option value="">همه سطوح</option>
                <option value="easy">آسان</option>
                <option value="medium">متوسط</option>
                <option value="hard">سخت</option>
              </select>
            </label>
            <fieldset className="text-base font-semibold text-slate-700">
              <legend className="flex items-center gap-2"><CalendarRange size={17} className="text-indigo-500" aria-hidden /> بازه سال</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="sr-only" htmlFor="home-year-from">از سال</label>
                <select id="home-year-from" aria-label="از سال" className={fieldClass} value={filters.yearFrom}
                  onChange={(e) => setFilters((old) => ({ ...old, yearFrom: e.target.value }))}>
                  <option value="">از سال</option>
                  {years.map((year) => <option key={year} value={year}>{year.toLocaleString("fa-IR")}</option>)}
                </select>
                <label className="sr-only" htmlFor="home-year-to">تا سال</label>
                <select id="home-year-to" aria-label="تا سال" className={fieldClass} value={filters.yearTo}
                  onChange={(e) => setFilters((old) => ({ ...old, yearTo: e.target.value }))}>
                  <option value="">تا سال</option>
                  {years.map((year) => <option key={year} value={year}>{year.toLocaleString("fa-IR")}</option>)}
                </select>
              </div>
            </fieldset>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">فیلترهای مقطع تا مبحث به‌صورت مرحله‌ای به هم وابسته‌اند.</p>
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm hover:bg-slate-50"
              onClick={() => { setFilters(initialHomeFilters()); setSortBy("newest"); setCatalogFilter(""); setSelected([]); }}>
              <RotateCcw size={16} aria-hidden /> پاک کردن فیلترها
            </button>
          </div>
        </section>

        <section ref={resultsRef} aria-label="نتایج سؤال" className="grid scroll-mt-4 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-base font-semibold">{visible.length.toLocaleString("fa-IR")} سؤال پیدا شد</p>
              <label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                <ArrowDownWideNarrow size={18} className="text-indigo-500" aria-hidden />
                مرتب‌سازی
                <select aria-label="مرتب‌سازی نتایج" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base"
                  value={sortBy} onChange={(e) => setSortBy(e.target.value as HomeSort)}>
                  <option value="newest">جدیدترین</option>
                  <option value="easiest">ساده‌ترین</option>
                  <option value="hardest">سخت‌ترین</option>
                  <option value="recommended">پیشنهاد کاربران</option>
                </select>
              </label>
              {catalogFilter && (
                <button type="button" onClick={() => { setCatalogFilter(""); setSelected([]); }}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs text-blue-900">
                  {catalogFilter.startsWith("event-") ? "آزمون انتخاب‌شده" : "دستهٔ آزمون انتخاب‌شده"}
                  <X size={14} aria-hidden />
                </button>
              )}
            </div>
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
          {recommendationMessage && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{recommendationMessage} {recommendationMessage.includes("وارد حساب") && <a className="underline" href="/login">ورود به حساب</a>}</p>}
          {!loading && !error && !visible.length &&
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              برای این فیلترها هنوز سؤال عمومیِ تأییدشده‌ای ثبت نشده است.
            </p>}
          {visible.map((q, i) => (
            <article key={q._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <label className="mb-3 flex cursor-pointer items-center gap-3 text-base font-semibold text-blue-900">
                <input type="checkbox" className="size-5" checked={selected.includes(q._id)}
                  onChange={(e) => setSelected((prev) => e.target.checked ? [...new Set([...prev, q._id])] : prev.filter((id) => id !== q._id))} />
                انتخاب سؤال {(i + 1).toLocaleString("fa-IR")}
              </label>
              <QuestionPresentation statement={q.statement} options={q.type === "choice" ? q.options : undefined}
                optionImages={q.optionImages} visuals={q.visuals} visualLayout={q.visualLayout} />
              <p className="mt-3 text-xs text-slate-500">{sourceSummary(q.source)}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500">{q.recommendationCount ?? 0} پیشنهاد کاربران</span>
                <button type="button" disabled={recommending === q._id} onClick={() => void recommendQuestion(q._id)}
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50">
                  <ThumbsUp size={15} aria-hidden />
                  {recommending === q._id ? "در حال ثبت…" : "پیشنهاد این سؤال"}
                </button>
              </div>
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
