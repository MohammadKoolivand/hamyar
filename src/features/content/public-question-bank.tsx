"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { QuestionPresentation } from "@/components/question-presentation";
import { PagedList } from "@/components/ui/paged-list";
import { Button } from "@/components/ui/button";
import {
  sourceCategories,
  sourceFields,
  sourceSummary,
} from "@/lib/question-source";
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

const labels = {
  level: "مقطع",
  grade: "پایه",
  book: "درس",
  chapter: "فصل",
  topic: "مبحث",
};
const inputStyle =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
export function PublicQuestionBank({
  home = false,
  signedIn = false,
  onLogin,
}: {
  home?: boolean;
  signedIn?: boolean;
  onLogin?: () => void;
}) {
  const [questions, setQuestions] = useState<PublicBankQuestion[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filters, setFilters] = useState<BankFilters>(emptyBankFilters);
  const [ready, setReady] = useState(false),
    [printing, setPrinting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    [filtersOpen, setFiltersOpen] = useState(false);
  const printable = useRef<HTMLDivElement>(null);
  const [starting, setStarting] = useState("");
  async function startPractice(questionId: string) {
    if (!signedIn) {
      onLogin?.();
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
    api<PublicBankQuestion[]>("/questions/public")
      .then((rows) => {
        if (active) setQuestions(rows);
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
  }, []);
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
    const prior = taxonomyKeys.slice(0, taxonomyKeys.indexOf(key));
    return [
      ...new Set(
        questions
          .filter((q) =>
            prior.every((k) => !filters[k] || q.taxonomy?.[k] === filters[k]),
          )
          .map((q) => q.taxonomy?.[key])
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "fa"));
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
      await printQuestions(printable.current, "تمرین و نمونه‌سؤال هدهده");
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
    <section className="grid gap-5 bg-white" dir="rtl">
      <header className="border-b pb-5">
        <h1 className="text-2xl font-bold">
          {home ? "تمرین و نمونه‌سؤال" : "بانک سؤال عمومی"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          درس و مبحث را انتخاب کن؛ سؤال یا نمونه‌امتحان پیدا کن و خروجی PDF
          بگیر.
        </p>
      </header>
      <button
        type="button"
        className="rounded-xl border p-3 text-right md:hidden"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        فیلتر سؤال‌ها
      </button>
      <div
        className={`${filtersOpen ? "grid" : "hidden"} gap-4 rounded-2xl border p-4 md:grid`}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {taxonomyKeys.map((key) => (
            <label key={key}>
              {labels[key]}
              <select
                className={inputStyle}
                value={filters[key]}
                onChange={(e) => selectTaxonomy(key, e.target.value)}
              >
                <option value="">همه</option>
                {taxonomyOptions(key).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            نوع سؤال / آزمون
            <select
              className={inputStyle}
              value={filters.category}
              onChange={(e) =>
                change({ ...filters, category: e.target.value, extra: {} })
              }
            >
              <option value="">همهٔ انواع</option>
              {sourceCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            درجهٔ سختی
            <select
              className={inputStyle}
              value={filters.difficulty}
              onChange={(e) =>
                change({ ...filters, difficulty: e.target.value })
              }
            >
              <option value="">همهٔ درجه‌ها</option>
              <option value="easy">ساده</option>
              <option value="medium">متوسط</option>
              <option value="hard">سخت</option>
              <option value="unset">تعیین نشده</option>
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
                <option value="">همهٔ سال‌ها</option>
                {extraOptions("year").map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            {sourceFields
              .filter((field) => field.categories.includes(filters.category))
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
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {[
            ["questions", "سؤال‌ها"],
            ["exams", "نمونه‌امتحان‌ها"],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={filters.content === value ? "default" : "outline"}
              onClick={() => change({ ...filters, content: value })}
              aria-pressed={filters.content === value}
            >
              {label}
            </Button>
          ))}
        </div>
        <span className="text-sm text-slate-500">
          {(filters.content === "exams"
            ? groups.length
            : visible.length
          ).toLocaleString("fa-IR")}{" "}
          نتیجه
        </span>
        <Button
          disabled={printing || !results.length}
          onClick={() => void exportPdf()}
        >
          خروجی PDF / چاپ{" "}
          {selected.length
            ? `(${selected.length.toLocaleString("fa-IR")} سؤال)`
            : "نتایج"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        در پنجرهٔ چاپ، مقصد «ذخیره به‌صورت PDF / Save as PDF» را انتخاب کن. بدون
        انتخاب سؤال، تمام نتایج فیلترشده چاپ می‌شوند.
      </p>
      {loading && <p role="status">در حال دریافت سؤال‌ها…</p>}
      {error && (
        <p role="alert" className="text-rose-700">
          {error}
        </p>
      )}
      {!loading &&
        !error &&
        !(filters.content === "exams" ? groups.length : visible.length) && (
          <p>با این فیلترها موردی یافت نشد.</p>
        )}
      {filters.content === "questions" ? (
        <PagedList items={visible} label="سؤال‌ها">
          {(q) => (
            <article key={q._id} className="rounded-xl border p-4">
              <label className="mb-4 flex gap-2 text-sm">
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
              {home && (
                <Button
                  className="mt-4"
                  disabled={!!starting}
                  onClick={() => void startPractice(q._id)}
                >
                  {!signedIn
                    ? "ورود برای تمرین آنلاین"
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
            <article key={group._id} className="rounded-xl border p-4">
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
                <summary className="cursor-pointer">مشاهدهٔ سؤال‌ها</summary>
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
          <h1>تمرین و نمونه‌سؤال هدهده</h1>
          {output.map((q, i) => (
            <article key={q._id}>
              <p>{(i + 1).toLocaleString("fa-IR")}.</p>
              {questionView(q)}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
