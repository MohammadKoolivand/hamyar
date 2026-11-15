"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  QuestionPresentation,
  MathText,
  QuestionVisualView,
} from "@/components/question-presentation";
import { PagedList } from "@/components/ui/paged-list";
import { Button } from "@/components/ui/button";
import { sourceFields, sourceSummary } from "@/lib/question-source";
import {
  discoveryChoices,
  type DiscoveryKey,
  type DiscoverySettings,
} from "@/lib/discovery-settings";
import {
  bankExamKey,
  bankFilterSearch,
  bankSourceValue,
  emptyBankFilters,
  matchesBankQuestion,
  parseBankFilters,
  taxonomyKeys,
  type BankFilters,
  type PublicBankQuestion,
} from "@/lib/public-bank";
import { printQuestions } from "@/lib/print-questions";
import { PdfLibraryPublic } from "./pdf-library-public";
import { BookOpen, SlidersHorizontal, FileDown } from "lucide-react";

const inputStyle =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
export function PublicQuestionBank({
  home = false,
  signedIn = false,
  onlinePractice = true,
  onLogin,
}: {
  home?: boolean;
  signedIn?: boolean;
  onlinePractice?: boolean;
  onLogin?: () => void;
}) {
  const [questions, setQuestions] = useState<PublicBankQuestion[]>([]);
  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const labelFor = (key: DiscoveryKey) =>
    settings?.fields.find((field) => field.key === key)?.label ?? "";
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filters, setFilters] = useState<BankFilters>(emptyBankFilters);
  const [ready, setReady] = useState(false),
    [printing, setPrinting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    [filtersOpen, setFiltersOpen] = useState(false);
  const printable = useRef<HTMLDivElement>(null);
  const [retry, setRetry] = useState(0);
  const [starting, setStarting] = useState("");
  const [guestSession, setGuestSession] = useState<PublicBankQuestion[] | null>(null);
  const [guestIndex, setGuestIndex] = useState(0);
  const [guestAnswers, setGuestAnswers] = useState<Record<string, string>>({});
  const [guestFinished, setGuestFinished] = useState(false);
  const [reportingQuestion, setReportingQuestion] = useState("");
  const [reportCategory, setReportCategory] = useState<"wrong_answer" | "typo" | "duplicate" | "copyright" | "other">("wrong_answer");
  const [reportDescription, setReportDescription] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  function beginGuestSession(items: PublicBankQuestion[]) {
    if (!items.length) return;
    setGuestSession(items.slice(0, 10));
    setGuestIndex(0);
    setGuestAnswers({});
    setGuestFinished(false);
  }
  async function startPractice(questionId: string) {
    if (!signedIn) {
      const question = questions.find((item) => item._id === questionId);
      if (question) beginGuestSession([question]);
      return;
    }
    setStarting(questionId);
    setError("");
    try {
      const result = await api<{ assignmentId: string }>(
        `/student/library/${questionId}/start`,
        { courseId: questionId },
      );
      window.location.assign(
        `/practice?assignment=${encodeURIComponent(result.assignmentId)}`,
      );
    } catch (error) {
      setError((error as Error).message);
      setStarting("");
    }
  }
  useEffect(() => {
    const read = () => {
      setFilters(parseBankFilters(window.location.search));
      setSelected([]);
    };
    read();
    setReady(true);
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const search = bankFilterSearch(filters);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
  }, [filters, ready]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api<PublicBankQuestion[]>("/questions/public"),
      api<DiscoverySettings>("/discovery-filters"),
    ])
      .then(([rows, config]) => {
        if (active) {
          setQuestions(rows);
          setSettings(config);
        }
      })
      .catch((error) => {
        if (active) setError((error as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const visible = useMemo(
    () => questions.filter((q) => matchesBankQuestion(q, filters)),
    [questions, filters],
  );
  const groups = useMemo(() => {
    const map = new Map<string, PublicBankQuestion[]>();
    for (const q of visible) {
      const key = bankExamKey(q);
      if (key) map.set(key, [...(map.get(key) ?? []), q]);
    }
    return [...map].map(([key, items]) => ({
      _id: key,
      items: items.sort(
        (a, b) =>
          (a.source?.questionNumber ?? 0) - (b.source?.questionNumber ?? 0),
      ),
    }));
  }, [visible]);
  function change(next: BankFilters) {
    setFilters(next);
    setSelected([]);
  }
  function selectTaxonomy(key: (typeof taxonomyKeys)[number], value: string) {
    const next = { ...filters, [key]: value };
    for (const descendant of taxonomyKeys.slice(taxonomyKeys.indexOf(key) + 1))
      next[descendant] = "";
    change(next);
  }
  function taxonomyOptions(key: (typeof taxonomyKeys)[number]) {
    return [
      ...new Map(
        discoveryChoices(settings, key, filters).map((option) => [
          option.value,
          option,
        ]),
      ).values(),
    ];
  }
  function extraOptions(key: string) {
    const scope = { ...filters, extra: { ...filters.extra, [key]: "" } };
    return [
      ...new Set(
        questions
          .filter((q) => matchesBankQuestion(q, scope))
          .map((q) => bankSourceValue(q, key))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "fa"));
  }
  async function exportPdf() {
    if (!printable.current) return;
    setPrinting(true);
    setError("");
    try {
      await printQuestions(printable.current, "تمرین و نمونه‌سؤال هدهد");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPrinting(false);
    }
  }
  const questionView = (q: PublicBankQuestion) => (
    <QuestionPresentation
      statement={q.statement}
      options={q.type === "choice" ? q.options : undefined}
      optionImages={q.optionImages}
      visuals={q.visuals}
      visualLayout={q.visualLayout}
    />
  );
  const examQuestions = groups.flatMap((group) => group.items);
  const results = filters.content === "exams" ? examQuestions : visible;
  const output = selected.length
    ? results.filter((q) => selected.includes(q._id))
    : results;
  return (
    <section className="hy-discovery grid gap-5" dir="rtl">
      <header className="discovery-hero flex items-center justify-between gap-5">
        <div>
          <span className="discovery-eyebrow">یادگیری، یک سؤال در هر قدم</span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {home ? "تمرین و نمونه‌سؤال" : "بانک سؤال عمومی"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            درس و مبحث را انتخاب کن؛ سؤال یا نمونه‌امتحان پیدا کن و خروجی PDF
            بگیر.
          </p>
        </div>
        <span aria-hidden="true" className="discovery-hero-icon">
          <BookOpen size={30} strokeWidth={1.6} />
        </span>
      </header>
      {filters.content !== "pdf" && <button
        type="button"
        className="discovery-filter-toggle flex items-center gap-2 rounded-xl border p-3 text-right md:hidden"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <SlidersHorizontal size={17} aria-hidden />
        فیلتر سؤال‌ها
      </button>}
      {filters.content !== "pdf" && <div
        className={`discovery-filters ${filtersOpen ? "grid" : "hidden"} gap-4 rounded-2xl border p-4 md:grid md:p-5`}
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {taxonomyKeys.map((key) => (
            <label key={key}>
              {labelFor(key)}
              <select
                className={inputStyle}
                value={filters[key]}
                onChange={(e) => selectTaxonomy(key, e.target.value)}
              >
                <option value="">همه</option>
                {taxonomyOptions(key).map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            {labelFor("category")}
            <select
              className={inputStyle}
              value={filters.category}
              onChange={(e) =>
                change({ ...filters, category: e.target.value, extra: {} })
              }
            >
              <option value="">همه‌ی انواع</option>
              {discoveryChoices(settings, "category", {}).map((c) => (
                <option key={c.id} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {labelFor("difficulty")}
            <select
              className={inputStyle}
              value={filters.difficulty}
              onChange={(e) =>
                change({ ...filters, difficulty: e.target.value })
              }
            >
              <option value="">همه‌ی درجه‌ها</option>
              {discoveryChoices(settings, "difficulty", {}).map((option) => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {filters.category && (
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              سال آزمون
              <select
                className={inputStyle}
                value={filters.extra.year ?? ""}
                onChange={(e) =>
                  change({
                    ...filters,
                    extra: { ...filters.extra, year: e.target.value },
                  })
                }
              >
                <option value="">همه‌ی سال‌ها</option>
                {extraOptions("year").map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            {sourceFields
              .filter((field) => field.categories.includes(filters.category))
              .filter(
                (field) =>
                  field.options ||
                  extraOptions(field.key).length ||
                  filters.extra[field.key],
              )
              .map((field) => (
                <label key={field.key}>
                  {field.label}
                  <select
                    className={inputStyle}
                    value={filters.extra[field.key] ?? ""}
                    onChange={(e) =>
                      change({
                        ...filters,
                        extra: {
                          ...filters.extra,
                          [field.key]: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">همه</option>
                    {(
                      field.options ??
                      extraOptions(field.key).map((value) => [value, value])
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
        )}
        <Button variant="outline" onClick={() => change(emptyBankFilters())}>
          پاک‌کردن فیلترها
        </Button>
      </div>}
      <div className="discovery-toolbar flex flex-wrap items-center justify-between gap-3">
        <div className="discovery-tabs flex gap-1">
          {[
            ["questions", "سؤال‌ها"],
            ["exams", "نمونه‌امتحان‌ها"],
            ["pdf", "فایل‌های PDF"],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant="outline"
              onClick={() => change(value === "pdf" ? { ...emptyBankFilters(), content: "pdf" } : { ...filters, content: value })}
              aria-pressed={filters.content === value}
            >
              {label}
            </Button>
          ))}
        </div>
        {filters.content !== "pdf" && <span className="discovery-count text-sm text-slate-500">
          {(filters.content === "exams"
            ? groups.length
            : visible.length
          ).toLocaleString("fa-IR")}{" "}
          نتیجه
        </span>}
        {filters.content !== "pdf" && <><Button
          variant="outline"
          disabled={!results.length || results.every((q) => selected.includes(q._id))}
          onClick={() =>
            setSelected((previous) => [
              ...new Set([...previous, ...results.map((q) => q._id)]),
            ])
          }
        >
          افزودن همه‌ی {results.length.toLocaleString("fa-IR")} سؤال به لیست PDF
        </Button>
        <Button
          variant="outline"
          disabled={!selected.length}
          onClick={() => setSelected([])}
        >
          پاک‌کردن انتخاب‌ها
        </Button>
        <Button
          className="discovery-export"
          disabled={printing || !results.length}
          onClick={() => void exportPdf()}
        >
          <FileDown size={17} aria-hidden />
          خروجی PDF / چاپ{" "}
          {selected.length
            ? `(${selected.length.toLocaleString("fa-IR")} سؤال)`
            : "نتایج"}
        </Button></>}
      </div>
      {home && onlinePractice && !signedIn && filters.content === "questions" && !loading && visible.length > 0 && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-teal-900">بدون ورود، تا ۱۰ سؤال را برای آشنایی با تمرین آنلاین امتحان کن. پاسخ‌ها ذخیره یا تصحیح نمی‌شوند.</p>
            <Button variant="outline" onClick={() => beginGuestSession(
              selected.length ? visible.filter((item) => selected.includes(item._id)) : visible,
            )}>شروع تمرین آزمایشی</Button>
          </div>
        </div>
      )}
      {guestSession && guestSession.length > 0 && (
        <section aria-label="تمرین آزمایشی مهمان" className="rounded-2xl border border-sky-200 bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <strong>تمرین آزمایشی · سؤال {(guestIndex + 1).toLocaleString("fa-IR")} از {guestSession.length.toLocaleString("fa-IR")}</strong>
            <Button variant="outline" onClick={() => setGuestSession(null)}>بستن تمرین</Button>
          </div>
          {!guestFinished ? (
            <>
              {questionView(guestSession[guestIndex])}
              {guestSession[guestIndex].type === "choice" && guestSession[guestIndex].options?.length ? (
                <fieldset className="mt-4 grid gap-2">
                  <legend className="mb-2 font-medium">پاسخ شما</legend>
                  {guestSession[guestIndex].options.map((option) => (
                    <label key={option} className="flex items-center gap-2 rounded-lg border p-3">
                      <input type="radio" name="guest-answer" value={option}
                        checked={guestAnswers[guestSession[guestIndex]._id] === option}
                        onChange={() => setGuestAnswers((previous) => ({ ...previous, [guestSession[guestIndex]._id]: option }))} />
                      <MathText text={option} />
                    </label>
                  ))}
                </fieldset>
              ) : (
                <label className="mt-4 block">
                  پاسخ شما
                  <textarea className={inputStyle} rows={3}
                    value={guestAnswers[guestSession[guestIndex]._id] ?? ""}
                    onChange={(event) => setGuestAnswers((previous) => ({
                      ...previous, [guestSession[guestIndex]._id]: event.target.value,
                    }))} />
                </label>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" disabled={guestIndex === 0}
                  onClick={() => setGuestIndex((index) => index - 1)}>سؤال قبل</Button>
                <Button onClick={() => guestIndex + 1 === guestSession.length
                  ? setGuestFinished(true)
                  : setGuestIndex((index) => index + 1)}>
                  {guestIndex + 1 === guestSession.length ? "پایان تمرین آزمایشی" : "سؤال بعد"}
                </Button>
              </div>
            </>
          ) : (
            <div className="grid gap-3">
              <p role="status">به {Object.values(guestAnswers).filter((answer) => answer.trim()).length.toLocaleString("fa-IR")} سؤال از {guestSession.length.toLocaleString("fa-IR")} سؤال پاسخ دادی.</p>
              <p className="text-sm text-slate-600">این نسخه مهمان فقط برای آشنایی است؛ نمره، تصحیح و ذخیره پاسخ ندارد. برای تمرین تصحیح‌شونده و ثبت پیشرفت با حساب دانش‌آموز وارد شو.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => beginGuestSession(guestSession)}>تمرین دوباره</Button>
                {onLogin && <Button onClick={onLogin}>ورود دانش‌آموز</Button>}
              </div>
            </div>
          )}
        </section>
      )}
      {filters.content !== "pdf" && <p className="text-xs leading-6 text-slate-400">
        در پنجره‌ی چاپ، مقصد «ذخیره به‌صورت PDF / Save as PDF» را انتخاب کن. بدون
        انتخاب سؤال، تمام نتایج فیلترشده چاپ می‌شوند.
      </p>}
      {loading && <p role="status">در حال دریافت سؤال‌ها…</p>}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            تلاش دوباره
          </Button>
        </div>
      )}
      {filters.content !== "pdf" && !loading &&
        !error &&
        !(filters.content === "exams" ? groups.length : visible.length) && (
          <p>با این فیلترها موردی یافت نشد.</p>
        )}
      {filters.content === "pdf" ? (
        <PdfLibraryPublic taxonomy={filters} />
      ) : filters.content === "questions" ? (
        <PagedList items={visible} label="سؤال‌ها">
          {(q) => (
            <article
              key={q._id}
              className="discovery-question rounded-2xl border p-5 sm:p-6"
            >
              <label className="discovery-question-meta mb-5 flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.includes(q._id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, q._id]
                        : prev.filter((id) => id !== q._id),
                    )
                  }
                />
                انتخاب برای PDF{" "}
                <span className="text-slate-500">
                  {q.taxonomy?.book}{" "}
                  {q.source ? ` · ${sourceSummary(q.source)}` : ""}
                </span>
              </label>
              {questionView(q)}
              <div className="mt-3">
                <button type="button" className="text-xs text-slate-500 underline"
                  onClick={() => {
                    setReportingQuestion(reportingQuestion === q._id ? "" : q._id);
                    setReportDescription("");
                    setReportMessage("");
                  }}>گزارش اشکال سؤال</button>
                {reportingQuestion === q._id && (
                  <form className="mt-3 grid gap-2 rounded-xl border bg-slate-50 p-3"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!signedIn) { onLogin?.(); return; }
                      setReportPending(true); setReportMessage("");
                      try {
                        await api(`/questions/${q._id}/report`, {
                          category: reportCategory, description: reportDescription.trim(),
                        });
                        setReportMessage("گزارش برای بررسی مدیر بانک ثبت شد.");
                        setReportDescription("");
                      } catch (error) { setReportMessage((error as Error).message); }
                      finally { setReportPending(false); }
                    }}>
                    <label className="text-xs">نوع اشکال
                      <select className={inputStyle} value={reportCategory}
                        onChange={(event) => setReportCategory(event.target.value as typeof reportCategory)}>
                        <option value="wrong_answer">پاسخ نادرست</option>
                        <option value="typo">خطای متن</option>
                        <option value="duplicate">سؤال تکراری</option>
                        <option value="copyright">مشکل حق نشر</option>
                        <option value="other">سایر</option>
                      </select>
                    </label>
                    <label className="text-xs">توضیح اشکال
                      <textarea className={inputStyle} rows={2} minLength={10} maxLength={1000}
                        value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} />
                    </label>
                    <Button disabled={reportPending || reportDescription.trim().length < 10}>
                      {signedIn ? "ثبت گزارش" : "ورود برای ثبت گزارش"}
                    </Button>
                    {reportMessage && <p role="status" className="text-xs">{reportMessage}</p>}
                  </form>
                )}
              </div>
              {home && onlinePractice && (
                <Button
                  className="discovery-practice mt-5"
                  disabled={!!starting}
                  onClick={() => void startPractice(q._id)}
                >
                  {!signedIn
                    ? "تمرین آزمایشی این سؤال"
                    : starting === q._id
                      ? "در حال شروع…"
                      : "تمرین آنلاین این سؤال"}
                </Button>
              )}
            </article>
          )}
        </PagedList>
      ) : (
        <PagedList items={groups} label="نمونه‌امتحان‌ها">
          {(group) => (
            <article
              key={group._id}
              className="discovery-question rounded-2xl border p-5 sm:p-6"
            >
              <h2 className="font-bold">
                {group.items[0].source?.sourceTitle ||
                  sourceSummary(group.items[0].source)}
              </h2>
              <p className="my-3 text-sm">
                {group.items.length.toLocaleString("fa-IR")} سؤال موجود از این
                آزمون
              </p>
              <Button
                variant="outline"
                onClick={() => setSelected(group.items.map((q) => q._id))}
              >
                انتخاب سؤال‌های این آزمون برای PDF
              </Button>
              <details className="mt-4">
                <summary className="cursor-pointer">مشاهده‌ی سؤال‌ها</summary>
                {group.items.map((q) => (
                  <div key={q._id} className="border-t py-4">
                    {questionView(q)}
                  </div>
                ))}
              </details>
            </article>
          )}
        </PagedList>
      )}
      <div className="hidden" aria-hidden="true">
        <div ref={printable} dir="rtl">
          <h1>تمرین و نمونه‌سؤال هدهد</h1>
          {output.map((q, i) => (
            <article key={q._id} className="pdf-question">
              <div className="pdf-question-head">
                <span className="pdf-number">
                  {(i + 1).toLocaleString("fa-IR")}ـ
                </span>
                <div className="pdf-statement">
                  <MathText text={q.statement} />
                </div>
                <span className="pdf-source">
                  {[
                    q.source?.family === "konkur"
                      ? `سراسری ${q.source.group === "mathematics" ? "ریاضی" : q.source.group === "experimental" ? "تجربی" : ""}`
                      : q.source?.family === "practice"
                        ? "تألیفی"
                        : q.source?.administration === "final"
                          ? "نهایی"
                          : sourceSummary(q.source).split(" · ")[0],
                    q.year
                      ? q.year.toLocaleString("fa-IR", { useGrouping: false })
                      : q.source?.academicYear,
                    q.source?.organizer,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </span>
              </div>
              {!!q.options?.length && (
                <ol
                  className="pdf-options"
                >
                  {q.options.map((option, index) => (
                    <li key={index} className="pdf-option">
                      <span>{(index + 1).toLocaleString("fa-IR")})</span>
                      <span className="pdf-option-text">
                        {!(q.optionImages?.[index] && option === `تصویر گزینه ${index + 1}`) && <MathText text={option} />}
                        {q.optionImages?.[index] && <span className="block max-w-[75mm]"><QuestionVisualView visual={q.optionImages[index]!} /></span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {!!q.visuals?.length && (
                <div className="pdf-visuals">
                  {q.visuals.map((visual, index) => (
                    <QuestionVisualView key={index} visual={visual} />
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
