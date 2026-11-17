"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Minus, Search, Square, ArrowRight, BadgeCheck } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import {
  detailedExamCatalog,
  examCatalogSections,
  examYears,
  konkurYears,
  mockExamProviders,
  type ExamCatalogEntry,
} from "@/lib/exam-catalog";
import {
  catalogStatuses, publicExamEvents,
  type CatalogAvailability, type CatalogCoverageRecord, type CatalogPublicQuestion,
  type PublicExamEvent,
} from "@/lib/exam-catalog-coverage";
import { api } from "@/lib/api";

const gradeLabels: Record<string, string> = { "7": "هفتم", "8": "هشتم", "9": "نهم", "10": "دهم", "11": "یازدهم", "12": "دوازدهم" };
const trackLabels = { mathematics: "ریاضی", experimental: "تجربی" } as const;
const selectClass = "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
function faNumber(value: number) { return value.toLocaleString("fa-IR", { useGrouping: false }); }
function StatusIcon({ status }: { status: CatalogAvailability }) {
  const name = status === "complete" ? "کامل" : status === "partial" ? "ناقص" : "خالی";
  return (
    <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg border ${status === "complete"
      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
      : status === "partial" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-400"}`}
      role="img" aria-label={name} title={name}>
      {status === "complete" ? <Check size={17} strokeWidth={2.5} aria-hidden /> :
        status === "partial" ? <Minus size={17} strokeWidth={2.5} aria-hidden /> :
        <Square size={15} strokeWidth={1.5} aria-hidden />}
    </span>
  );
}
type AdminImportedExam = {
  _id: string;
  title: string;
  year?: number;
  grade?: string;
  track?: string;
  categoryIds: string[];
  examDate?: string;
  stage?: string;
  total: number;
  approved: number;
  extracted: number;
  expectedQuestionCount: number | null;
  expectedCountConfidence: "key_complete" | "numbering_estimate" | "unknown";
  percent: number | null;
  status: CatalogAvailability;
  complete: boolean;
};
type PublicImportedExam = {
  id: string;
  title: string;
  categoryIds: string[];
  hasPublicQuestions: boolean;
  approved: number;
  expectedQuestionCount: number | null;
  expectedCountConfidence: "key_complete" | "numbering_estimate" | "unknown";
  percent: number | null;
  status: CatalogAvailability;
  files?: {
    question?: { id: string };
    answer?: { id: string };
  };
};
type CatalogGroup = { key: string; title: string; rows: ExamCatalogEntry[] };
function groupRows(items: readonly ExamCatalogEntry[]): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();
  for (const item of items) {
    const title = item.section === "mock"
      ? `${mockExamProviders.find((p) => p.id === item.provider)?.name ?? "آزمایشی"} · سال تحصیلی ${faNumber(item.year ?? 0)}–${faNumber((item.year ?? 0) + 1)}`
      : item.section === "konkur"
        ? `${item.provider === "azad" ? "کنکور مستقل دانشگاه آزاد"
          : item.provider === "azad-shared" ? "آزاد (پذیرش با آزمون مشترک سراسری)" : item.provider === "farhangian" ? "کنکور اختصاصی فرهنگیان" : "کنکور سراسری"} · ${faNumber(item.year ?? 0)}`
      : item.section === "school" || item.section === "practice"
        ? `سال ${faNumber(item.year ?? 0)} · ${gradeLabels[item.grade ?? ""] ?? "چندپایه"}`
        : `سال ${faNumber(item.year ?? 0)}`;
    const key = `${item.section}:${item.provider ?? ""}:${item.year}:${item.section === "school" || item.section === "practice" ? item.grade : ""}`;
    const group = groups.get(key) ?? { key, title, rows: [] };
    group.rows.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, "fa"));
}

export default function ExamCatalogPage() {
  const [questions, setQuestions] = useState<CatalogPublicQuestion[]>([]);
  const [coverage, setCoverage] = useState<CatalogCoverageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(false);
  const [imports, setImports] = useState<AdminImportedExam[]>([]);
  const [publishedImports, setPublishedImports] = useState<PublicImportedExam[]>([]);
  const [saving, setSaving] = useState("");
  const [section, setSection] = useState<(typeof examCatalogSections)[number]["id"]>("konkur");
  const [provider, setProvider] = useState("");
  const [year, setYear] = useState("");
  const [grade, setGrade] = useState("");
  const [track, setTrack] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    let unsubscribeFocus: (() => void) | undefined;
    Promise.all([
      api<CatalogPublicQuestion[]>("/questions/public"),
      api<CatalogCoverageRecord[]>("/exam-catalog/coverage"),
      api<PublicImportedExam[]>("/exam-catalog/public-progress").catch(() => []),
    ]).then(([q, c, published]) => {
      if (mounted) { setQuestions(q); setCoverage(c); setPublishedImports(published); }
    })
      .catch((cause: unknown) => { if (mounted) setError(cause instanceof Error ? cause.message : "دریافت اطلاعات آزمون‌ها ممکن نشد"); })
      .finally(() => { if (mounted) setLoading(false); });
    api<{ role: string }>("/auth/me").then((me) => {
      if (mounted && me.role === "super_admin") {
        setAdmin(true);
        const updateImports = () => {
          void api<AdminImportedExam[]>("/admin/exam-catalog/imports")
            .then((rows) => { if (mounted) setImports(rows); })
            .catch(() => { /* Only authorized private imports are visible. */ });
        };
        updateImports();
        poll = setInterval(updateImports, 30000);
        window.addEventListener("focus", updateImports);
        unsubscribeFocus = () => window.removeEventListener("focus", updateImports);
      }
    }).catch(() => { /* Public catalog never requires authentication. */ });
    return () => { mounted = false; if (poll) clearInterval(poll); unsubscribeFocus?.(); };
  }, []);

  const statuses = useMemo(() => catalogStatuses(questions, coverage), [questions, coverage]);
  const events = useMemo(() => publicExamEvents(questions), [questions]);
  const publishedByCategory = useMemo(() => {
    const map = new Map<string, PublicImportedExam[]>();
    for (const entry of publishedImports)
      for (const categoryId of entry.categoryIds)
        map.set(categoryId, [...(map.get(categoryId) ?? []), entry]);
    return map;
  }, [publishedImports]);
  const eventMap = useMemo(() => {
    const entries = new Map<string, PublicExamEvent[]>();
    for (const event of events) entries.set(event.parentId, [...(entries.get(event.parentId) ?? []), event]);
    return entries;
  }, [events]);
  const certified = useMemo(() => new Map(coverage.map((entry) => [entry.categoryId, entry.expectedQuestionCount])), [coverage]);
  const filtered = useMemo(() => detailedExamCatalog.filter((item) =>
    item.section === section &&
    (!provider || item.provider === provider) &&
    (!year || String(item.year) === year) &&
    (!grade || item.grade === grade) &&
    (!track || item.track === track) &&
    (!search.trim() || item.label.includes(search.trim()))
  ), [section, provider, year, grade, track, search]);
  const groups = useMemo(() => groupRows(filtered), [filtered]);

  async function review(id: string, count: number, complete: boolean) {
    if (!admin || saving) return;
    if (complete) {
      if (!window.confirm("تأیید کامل‌بودن این مورد برداشته شود؟")) return;
      setSaving(id); setError("");
      try {
        const response = await fetch(`/api/admin/exam-catalog/coverage/${encodeURIComponent(id)}`, {
          method: "DELETE", credentials: "same-origin",
        });
        if (!response.ok) throw new Error("لغو تأیید انجام نشد");
        setCoverage((current) => current.filter((row) => row.categoryId !== id));
      } catch (cause) { setError(cause instanceof Error ? cause.message : "خطا در ثبت وضعیت"); }
      finally { setSaving(""); }
      return;
    }
    if (count === 0) return;
    const raw = window.prompt("تعداد کل سؤال‌های این آزمون را پس از بازبینی وارد کن:", String(count));
    if (raw === null) return;
    const expected = Number(raw);
    if (!Number.isSafeInteger(expected) || expected < 1 || expected > 5000 || expected > count) {
      setError("برای تکمیل، تعداد کل باید عدد صحیح و حداکثر برابر سؤال‌های عمومی موجود باشد.");
      return;
    }
    if (!window.confirm(`تأیید می‌کنی تمام ${faNumber(expected)} سؤال این مورد بازبینی و منتشر شده‌اند؟`)) return;
    setSaving(id); setError("");
    try {
      await api("/admin/exam-catalog/coverage", {
        categoryId: id, expectedQuestionCount: expected,
        reviewNote: "بازبینی دستی شمار سؤال‌های عمومی و تأیید تکمیل این مورد",
      });
      setCoverage((current) => [...current.filter((row) => row.categoryId !== id), { categoryId: id, expectedQuestionCount: expected }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "خطا در ثبت وضعیت"); }
    finally { setSaving(""); }
  }

  function statusOf(id: string, count: number): CatalogAvailability {
    if (count === 0) return "empty";
    const expected = certified.get(id);
    return expected && expected <= count ? "complete" : "partial";
  }

  const countVisible = filtered.length;
  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f9fc] text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a href="/" aria-label="بازگشت به خانه هدهد"><Brand /></a>
          <a href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm text-blue-800 hover:bg-blue-50">
            <ArrowRight size={17} aria-hidden /> جست‌وجوی سؤال و خروجی PDF
          </a>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10">
        <section className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-8">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-blue-950">
            <BookOpen aria-hidden /> فهرست موردی آزمون‌ها
          </h1>
          <p className="mt-3 text-sm leading-8 text-slate-600">
            کنکورهای سراسری ۱۳۹۰ تا ۱۴۰۵، آزمون مستقل آزاد ۱۳۹۰ و ۱۳۹۱،
            پذیرش مشترک آزاد از ۱۳۹۲ به بعد و آزمون اختصاصی فرهنگیان ۱۴۰۳ تا ۱۴۰۵
            به تفکیک سال و رشته فهرست شده‌اند. نوبت‌ها، محل برگزاری، نظام آموزشی
            و دفترچه‌های عمومی و اختصاصی هم جدا شده‌اند.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600" aria-label="راهنمای وضعیت موجودی">
            <span className="inline-flex items-center gap-2"><StatusIcon status="complete" /> کامل و تأییدشده</span>
            <span className="inline-flex items-center gap-2"><StatusIcon status="partial" /> موجود ولی ناقص</span>
            <span className="inline-flex items-center gap-2"><StatusIcon status="empty" /> هنوز موجود نیست</span>
          </div>
        </section>

        <section aria-label="دسته‌بندی آزمون‌ها" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <nav aria-label="نوع آزمون" className="flex flex-wrap gap-2">
            {examCatalogSections.map((item) => (
              <button key={item.id} type="button" aria-pressed={section === item.id}
                className={`min-h-11 rounded-xl border px-4 text-sm ${section === item.id ? "border-blue-700 bg-blue-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50"}`}
                onClick={() => { setSection(item.id); setProvider(""); setYear(""); setGrade(""); setTrack(""); setSearch(""); }}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {section === "mock" && <label className="grid gap-1 text-sm">برگزارکننده
              <select className={selectClass} value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">همه برگزارکننده‌ها</option>
                {mockExamProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>}
            <label className="grid gap-1 text-sm">سال
              <select className={selectClass} value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">تمام سال‌ها</option>
                {(section === "konkur" ? konkurYears : examYears).map((item) => <option key={item} value={item}>{faNumber(item)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">پایه
              <select className={selectClass} value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">تمام پایه‌ها</option>
                {Object.entries(gradeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">رشته
              <select className={selectClass} value={track} onChange={(e) => setTrack(e.target.value)}>
                <option value="">همه رشته‌ها</option>
                {Object.entries(trackLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">جست‌وجوی موردی
              <div className="relative"><Search size={16} aria-hidden className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                <input className={selectClass + " pr-9"} placeholder="نام آزمون یا برگزارکننده" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </label>
          </div>
          <p className="text-sm text-slate-500">{faNumber(countVisible)} ردیف مستقل برای ثبت و پیگیری</p>
        </section>

        {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
        {loading && <p role="status" className="rounded-2xl bg-white p-5">در حال دریافت موجودی بانک سؤال…</p>}
        {!loading && !error && filtered.length === 0 &&
          <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">برای این فیلترها موردی وجود ندارد.</p>}

        {!loading && groups.map((group) => {
          const count = group.rows.reduce((sum, row) => sum + (statuses.get(row.id)?.count ?? 0), 0);
          return (
            <details key={group.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm" open={search.trim() !== "" ? true : undefined}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 font-bold text-blue-900 sm:p-5">
                <span>{group.title}</span>
                <span className="text-xs font-normal text-slate-500">
                  {faNumber(group.rows.length)} مورد · {faNumber(count)} سؤال عمومی
                </span>
              </summary>
              <div className="grid gap-2 border-t border-slate-100 p-3 sm:p-5">
                {group.rows.map((item) => {
                  const status = statuses.get(item.id) ?? { count: 0, status: "empty" as const };
                  const childEvents = eventMap.get(item.id) ?? [];
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <a href={`/?exam=${encodeURIComponent(item.linkedCatalogId ?? item.id)}`}
                          className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-2 text-right text-sm hover:text-blue-700">
                          <StatusIcon status={status.status} />
                          <span className="min-w-0">{item.label}</span>
                          <span className="shrink-0 text-xs text-slate-400">{status.count ? `${faNumber(status.count)} سؤال` : ""}</span>
                        </a>
                        {admin && !item.linkedCatalogId && status.count > 0 &&
                          <button disabled={Boolean(saving)} type="button" onClick={() => void review(item.id, status.count, status.status === "complete")}
                            className="min-h-9 rounded-lg border border-blue-200 px-3 text-xs text-blue-800 disabled:opacity-50">
                            {status.status === "complete" ? "لغو تأیید" : "تأیید تکمیل ✓"}
                          </button>}
                      </div>
                      {(publishedByCategory.get(item.id) ?? []).map((entry) => (
                        <div key={entry.id} className="mr-7 mt-3 grid gap-2 rounded-lg border border-sky-100 bg-sky-50/50 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.hasPublicQuestions && <StatusIcon status={entry.status} />}
                            <strong className="min-w-0 flex-1 text-xs leading-6 text-slate-700">
                              آزمون: {entry.title}
                            </strong>
                            {entry.hasPublicQuestions && (
                              <span className="text-xs font-semibold tabular-nums text-blue-900">
                                {entry.expectedQuestionCount === null
                                  ? `${faNumber(entry.approved)} سؤال عمومی · تعداد کل نامشخص`
                                  : `${faNumber(entry.approved)} از ${faNumber(entry.expectedQuestionCount)} سؤال (${faNumber(entry.percent ?? 0)}٪)`}
                              </span>
                            )}
                          </div>
                          {entry.hasPublicQuestions && entry.expectedQuestionCount !== null && (
                            <div role="progressbar" aria-label={`موجودی سؤال‌های عمومی ${entry.title}`}
                              aria-valuemin={0} aria-valuemax={entry.expectedQuestionCount}
                              aria-valuenow={Math.min(entry.approved, entry.expectedQuestionCount)}
                              className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className={`h-full rounded-full ${entry.status === "complete" ? "bg-emerald-600" : "bg-blue-700"}`}
                                style={{ width: `${entry.percent ?? 0}%` }} />
                            </div>
                          )}
                          {entry.hasPublicQuestions && entry.expectedCountConfidence === "numbering_estimate" && (
                            <p className="text-xs text-amber-800">
                              تعداد کل برآوردی است و تیک کامل قطعی صادر نمی‌شود.
                            </p>
                          )}
                          {(entry.files?.question || entry.files?.answer) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {entry.files?.question && (
                                <a href={`/api/pdf-library/${entry.files.question.id}/file`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex min-h-9 items-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-900 hover:bg-blue-50">
                                  دفترچه PDF
                                </a>
                              )}
                              {entry.files?.answer && (
                                <a href={`/api/pdf-library/${entry.files.answer.id}/file`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex min-h-9 items-center rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50">
                                  کلید پاسخ
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {admin && imports.filter((entry) => entry.categoryIds.includes(item.id)).map((entry) => {
                        const denominator = entry.expectedQuestionCount;
                        const progressLabel = denominator === null
                          ? `${faNumber(entry.approved)} سؤال واردشده · تعداد کل نامشخص`
                          : `${faNumber(entry.approved)} از ${faNumber(denominator)} سؤال`;
                        return (
                          <div key={entry._id} className="mr-7 mt-3 grid gap-2 rounded-lg border border-teal-100 bg-teal-50/50 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusIcon status={entry.status} />
                              <span className="min-w-0 flex-1 text-xs leading-6 text-slate-700">
                                <strong>ورود خصوصی: {entry.title}</strong>
                                {entry.examDate ? ` · ${entry.examDate}` : ""}
                                {entry.stage ? ` · ${entry.stage}` : ""}
                              </span>
                              <span className="text-xs font-bold tabular-nums text-teal-900">
                                {progressLabel}
                              </span>
                            </div>
                            {denominator !== null && (
                              <div role="progressbar" aria-label={`پیشرفت ورود ${entry.title}`}
                                aria-valuemin={0} aria-valuemax={denominator}
                                aria-valuenow={Math.min(entry.approved, denominator)}
                                className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                                <div className={`h-full rounded-full ${entry.status === "complete" ? "bg-emerald-600" : "bg-sky-600"}`}
                                  style={{ width: `${entry.percent ?? 0}%` }} />
                              </div>
                            )}
                            <p className="text-xs leading-6 text-slate-600">
                              {denominator === null
                                ? "تعداد واقعی سؤال‌ها از فایل اصلی با اطمینان تشخیص داده نشد؛ پیشرفت کامل اعلام نمی‌شود."
                                : entry.expectedCountConfidence === "numbering_estimate"
                                  ? `تعداد کل برآوردی از شماره‌های PDF است. ${entry.percent ?? 0}٪ ثبت شده؛ تکمیل قطعی اعلام نمی‌شود.`
                                  : `تعداد کل از کلید شماره‌دار پاسخ‌نامه تشخیص داده شده؛ ${entry.percent ?? 0}٪ وارد شده.`}
                              {" "}تعداد پیش‌نویس‌های استخراج‌شده: {faNumber(entry.extracted)}.
                            </p>
                          </div>
                        );
                      })}
                      {childEvents.length > 0 && <div className="mr-7 mt-3 grid gap-2 border-r-2 border-sky-100 pr-3">
                        {childEvents.map((event) => {
                          const eventStatus = statusOf(event.id, event.questionIds.length);
                          return <div key={event.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                            <a href={`/?exam=${encodeURIComponent(event.id)}`} className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm hover:text-blue-700">
                              <StatusIcon status={eventStatus} />
                              <span>آزمون موردی: {event.label}</span>
                              <span className="text-xs text-slate-500">{faNumber(event.questionIds.length)} سؤال</span>
                            </a>
                            {admin && <button type="button" disabled={Boolean(saving)}
                              className="min-h-9 rounded-lg border border-blue-200 px-3 text-xs text-blue-800 disabled:opacity-50"
                              onClick={() => void review(event.id, event.questionIds.length, eventStatus === "complete")}>
                              {eventStatus === "complete" ? "لغو تیک" : "تیک تکمیل"}
                            </button>}
                          </div>;
                        })}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
        <p className="text-xs leading-7 text-slate-500">
          «دانشگاه آزاد ـ آزمون مشترک» از سال ۱۳۹۲ به بعد به همان دفترچه سراسری مرتبط است و آزمون مستقل جدیدی نیست.
          ردیف‌های آرشیوی محل ثبت و پیگیری‌اند و تا بارگذاری سؤال تأییدشده، نشانگر خالی می‌مانند.
          علامت کامل صرفاً برای سؤال‌های عمومیِ بازبینی‌شده پس از تأیید مدیر ثبت می‌شود؛
          آزمون‌های خصوصی و فایل‌هایی که هنوز تأیید انتشار نگرفته‌اند در شمارش عمومی نیستند.
        </p>
        {admin && <p className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-7 text-teal-900">
          <BadgeCheck size={18} aria-hidden className="ml-2 inline" />
          دسترسی مدیریت فعال است. برای هر ردیف دارای سؤال، پس از بررسی تعداد و انتشار تمام سؤال‌ها،
          «تأیید تکمیل» را بزن تا تیک سبز ذخیره شود؛ با «لغو تأیید» می‌توانی آن را برگردانی.
        </p>}
      </main>
    </div>
  );
}
