"use client";
import { PagedList } from "@/components/ui/paged-list";
import {
  sourceCategories,
  sourceCategory,
  sourceSummary,
  sourceFields,
} from "@/lib/question-source";
import { QuestionEditor } from "./question-editor";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useState } from "react";
import { AppLink as Link } from "@/components/app-link";
import { Plus, LibraryBig, Search, SlidersHorizontal } from "lucide-react";
import { Field } from "@/components/ui/field";
import { QuestionPresentation } from "@/components/question-presentation";
import { curriculumTopicChoices } from "@/lib/curriculum";
import { fa } from "@/lib/presentation";
import type { Node, Question } from "@/lib/types";
export const difficultyLabels: Record<string, string> = {
  easy: "آسان",
  medium: "متوسط",
  hard: "سخت",
};
const types: Record<string, string> = {
  numeric: "عددی",
  symbolic: "عبارت و معادله",
  choice: "چندگزینه‌ای",
  short: "پاسخ کوتاه",
  essay: "تشریحی",
};
const selectStyle =
  "glass-field min-h-11 w-full min-w-0 p-3 text-sm disabled:bg-slate-100 disabled:text-slate-400";
export function QuestionBank({
  nodes,
  questions,
  onSaved,
}: {
  nodes: Node[];
  questions: Question[];
  onSaved: () => Promise<unknown> | void;
}) {
  const [bulkDifficulty, setBulkDifficulty] = useState("medium");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [guidedOnly, setGuidedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [track, setTrack] = useState("");
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [examCategory, setExamCategory] = useState("");
  const [examFilters, setExamFilters] = useState<Record<string, string>>({});
  const [source, setSource] = useState("");
  const choices = curriculumTopicChoices(nodes);
  const unique = (rows: { id: string; title: string }[]) => [
    ...new Map(rows.map((r) => [r.id, r])).values(),
  ];
  const grades = unique(choices.map((c) => c.grade));
  const tracks = [
    ...new Set(
      choices.filter((c) => c.grade.id === grade).flatMap((c) => c.tracks),
    ),
  ];
  const showTracks = tracks.some((t) => t !== "custom");
  const trackLabels: Record<string, string> = {
    common: "مشترک متوسطه اول",
    mathematics: "ریاضی و فیزیک",
    experimental: "علوم تجربی",
    humanities: "علوم انسانی",
    islamic: "علوم و معارف اسلامی",
    custom: "بدون رشته مشخص",
  };
  const books = unique(
    choices
      .filter(
        (c) => c.grade.id === grade && (!track || c.tracks.includes(track)),
      )
      .map((c) => c.book),
  );
  const chapters = unique(
    choices
      .filter((c) => c.grade.id === grade && c.book.id === book)
      .map((c) => c.chapter),
  );
  const topics = choices.filter(
    (c) =>
      c.grade.id === grade && c.book.id === book && c.chapter.id === chapter,
  );
  const byTopic = new Map(choices.map((c) => [c.topic._id, c]));
  const years = [
    ...new Set(questions.flatMap((q) => (q.year ? [q.year] : []))),
  ].sort((a, b) => b - a);
  const visible = questions.filter((q) => {
    const c = q.topicId ? byTopic.get(q.topicId) : undefined;
    return (
      (!guidedOnly || (!!q.hints?.length && !!q.skillIds?.length)) &&
      (!search.trim() ||
        `${q.statement} ${c?.topic.title ?? ""}`.includes(search.trim())) &&
      (!examCategory || sourceCategory(q.source) === examCategory) &&
      Object.entries(examFilters).every(
        ([key, value]) =>
          !value ||
          String(
            q.source?.[key as keyof NonNullable<Question["source"]>] ?? "",
          ) === value,
      ) &&
      (!grade || c?.grade.id === grade) &&
      (!track || !!c?.tracks.includes(track)) &&
      (!book || c?.book.id === book) &&
      (!chapter || c?.chapter.id === chapter) &&
      (!topic || q.topicId === topic) &&
      (!difficulty ||
        (difficulty === "unknown"
          ? !q.difficulty
          : q.difficulty === difficulty)) &&
      (!year || (year === "unknown" ? !q.year : String(q.year) === year)) &&
      (!type || q.type === type) &&
      (!source ||
        (source === "free"
          ? q.classification === "free"
          : source === "ai"
            ? q.origin === "ai_reviewed"
            : q.classification !== "free"))
    );
  });
  const active = [
    search,
    guidedOnly,
    examCategory,
    ...Object.values(examFilters),
    grade,
    track,
    book,
    chapter,
    topic,
    difficulty,
    year,
    type,
    source,
  ].filter(Boolean).length;
  function clear() {
    setSearch("");
    setGuidedOnly(false);
    setExamCategory("");
    setExamFilters({});
    setGrade("");
    setTrack("");
    setBook("");
    setChapter("");
    setTopic("");
    setDifficulty("");
    setYear("");
    setType("");
    setSource("");
  }
  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white bg-white/70 p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#233B8F]">
            <LibraryBig className="size-5" />
            <h2 className="text-lg font-bold">بانک سؤال‌های شما</h2>
          </div>
          <p className="text-sm leading-7 text-slate-500">
            مرور، جست‌وجو و انتخاب از {fa(questions.length)} سؤال تأییدشده
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/resources"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
          >
            منابع آموزشی
          </Link>
          <Link
            href="/exam-import"
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-[#233B8F]"
          >
            ورود آزمون از PDF
          </Link>
          <Link
            href="/content-new"
            className="flex items-center gap-2 rounded-xl bg-[#233B8F] px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-900/10"
          >
            <Plus className="size-4" />
            افزودن سؤال
          </Link>
        </div>
      </section>
      <section
        aria-label="دسته‌بندی آزمون‌ها"
        className="grid min-w-0 gap-4 rounded-2xl border border-slate-200/70 bg-white/80 p-5 sm:p-6"
      >
        <div className="space-y-1">
          <h3 className="font-bold text-slate-700">
            دسته‌بندی آزمون‌ها و منابع
          </h3>
          <p className="text-xs leading-6 text-slate-500">
            یک دسته را انتخاب کنید؛ موضوع درسی، روش پاسخ و شیوه تولید سؤال
            فیلترهای جداگانه‌اند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "", label: "همه دسته‌ها" },
            ...sourceCategories,
            { id: "unknown", label: "دسته‌بندی نشده" },
          ].map((c) => (
            <button
              type="button"
              key={c.id}
              aria-label={c.label}
              aria-pressed={examCategory === c.id}
              onClick={() => {
                setExamCategory(c.id);
                setExamFilters({});
              }}
              className={`rounded-xl border px-4 py-2.5 text-sm transition-colors ${examCategory === c.id ? "border-[#233B8F] bg-[#233B8F] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {c.label}
              <span className="mr-2 text-xs opacity-70">
                {fa(
                  questions.filter(
                    (q) => !c.id || sourceCategory(q.source) === c.id,
                  ).length,
                )}
              </span>
            </button>
          ))}
        </div>
        {!!examCategory && examCategory !== "unknown" && (
          <div className="grid min-w-0 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {sourceFields
              .filter((f) => f.categories.includes(examCategory))
              .map((f) => {
                const available = [
                  ...new Set(
                    questions
                      .filter((q) => sourceCategory(q.source) === examCategory)
                      .flatMap((q) => {
                        const v = q.source?.[f.key];
                        return v ? [String(v)] : [];
                      }),
                  ),
                ];
                const options = f.options ?? available.map((v) => [v, v]);
                return (
                  <Field key={f.key} title={`فیلتر ${f.label}`}>
                    <select
                      className={selectStyle}
                      value={examFilters[f.key] ?? ""}
                      onChange={(e) =>
                        setExamFilters({
                          ...examFilters,
                          [f.key]: e.target.value,
                        })
                      }
                    >
                      <option value="">همه</option>
                      {options.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                );
              })}
          </div>
        )}
      </section>
      <section
        aria-label="فیلترهای بانک سؤال"
        className="grid min-w-0 gap-5 rounded-2xl border border-slate-200/70 bg-white/80 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <SlidersHorizontal className="size-4" />
            جست‌وجو و فیلتر سؤال‌ها
          </h3>
          {active > 0 && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-[#233B8F] underline underline-offset-4"
            >
              پاک‌کردن فیلترها ({fa(active)})
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={guidedOnly}
            onChange={(e) => setGuidedOnly(e.target.checked)}
          />
          فقط سؤال‌های دارای راهنما و مهارت
        </label>
        <Field title="جست‌وجو در بانک سؤال">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-3.5 size-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="متن سؤال یا نام مبحث را جست‌وجو کنید…"
              className="glass-field min-h-12 w-full py-3 pr-10 pl-3 text-sm"
            />
          </div>
        </Field>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field title="پایه">
            <select
              className={selectStyle}
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setTrack("");
                setBook("");
                setChapter("");
                setTopic("");
              }}
            >
              <option value="">همه پایه‌ها</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
          {showTracks && (
            <Field title="رشته">
              <select
                className={selectStyle}
                value={track}
                onChange={(e) => {
                  setTrack(e.target.value);
                  setBook("");
                  setChapter("");
                  setTopic("");
                }}
              >
                <option value="">همه رشته‌ها</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    {trackLabels[t] ?? t}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field title="درس / کتاب">
            <select
              className={selectStyle}
              disabled={!grade}
              value={book}
              onChange={(e) => {
                setBook(e.target.value);
                setChapter("");
                setTopic("");
              }}
            >
              <option value="">همه کتاب‌ها</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </Field>
          <Field title="فصل">
            <select
              className={selectStyle}
              disabled={!book}
              value={chapter}
              onChange={(e) => {
                setChapter(e.target.value);
                setTopic("");
              }}
            >
              <option value="">همه فصل‌ها</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field title="مبحث">
            <select
              className={selectStyle}
              disabled={!chapter}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">همه مباحث</option>
              {topics.map((c) => (
                <option key={c.topic._id} value={c.topic._id}>
                  {c.topic.title}
                </option>
              ))}
            </select>
          </Field>
          <Field title="درجه سختی">
            <select
              className={selectStyle}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">همه درجه‌ها</option>
              {Object.entries(difficultyLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
              <option value="unknown">تعیین نشده</option>
            </select>
          </Field>
          <Field title="سال سؤال">
            <select
              className={selectStyle}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">همه سال‌ها</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y.toLocaleString("fa-IR", { useGrouping: false })}
                </option>
              ))}
              <option value="unknown">تعیین نشده</option>
            </select>
          </Field>
          <Field title="روش پاسخ">
            <select
              className={selectStyle}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">همه روش‌ها</option>
              {Object.entries(types).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field title="دسته سؤال">
            <select
              className={selectStyle}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">همه سؤال‌ها</option>
              <option value="topic">مبحثی</option>
              <option value="free">آزاد</option>
              <option value="ai">تولید با هوش مصنوعی</option>
            </select>
          </Field>
        </div>
      </section>
      <section className="grid min-w-0 gap-4" aria-label="نتایج بانک سؤال">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-slate-700">سؤال‌ها</h3>
          <span role="status" className="text-sm text-slate-500">
            {fa(visible.length)} از {fa(questions.length)} سؤال
          </span>
        </div>
        {!visible.length && (
          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-16 text-center">
            <LibraryBig className="size-10 text-slate-300" />
            <p className="font-medium text-slate-600">
              {questions.length
                ? "سؤالی با این فیلترها پیدا نشد"
                : "بانک سؤال شما آماده شروع است"}
            </p>
            <p className="text-sm leading-7 text-slate-500">
              {questions.length
                ? "فیلترها را تغییر دهید یا جست‌وجو را پاک کنید."
                : "اولین سؤال را به‌صورت دستی یا با کمک هوش مصنوعی اضافه کنید."}
            </p>
            <Link
              className="mt-2 text-sm font-medium text-[#233B8F]"
              href="/content-new"
            >
              افزودن سؤال جدید ←
            </Link>
          </div>
        )}
        <div className="glass-note flex flex-wrap items-end gap-3 p-4">
          <Field title="تعیین گروهی سختی نتایج فیلترشده">
            <select
              className={selectStyle}
              value={bulkDifficulty}
              onChange={(e) => setBulkDifficulty(e.target.value)}
            >
              {Object.entries(difficultyLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Button
            type="button"
            disabled={bulkBusy || !visible.length || visible.length > 500}
            onClick={async () => {
              setBulkBusy(true);
              setBulkError("");
              setBulkNotice("");
              try {
                const result = await api<{ updated: number }>(
                  "/questions/difficulty-batch",
                  {
                    questionVersionIds: visible.map((q) => q._id),
                    difficulty: bulkDifficulty,
                  },
                );
                await onSaved();
                setBulkNotice(`سختی ${fa(result.updated)} سؤال ذخیره شد.`);
              } catch (e) {
                setBulkError((e as Error).message);
              } finally {
                setBulkBusy(false);
              }
            }}
          >
            اعمال روی {fa(visible.length)} سؤال فیلترشده
          </Button>
          <p className="w-full text-xs text-slate-500">
            این تغییر شامل همهٔ صفحه‌های نتیجه است؛ برای بیش از ۵۰۰ سؤال فیلتر
            را محدود کنید.
          </p>
          {bulkNotice && <p role="status">{bulkNotice}</p>}
          {bulkError && (
            <p role="alert" className="text-rose-700">
              {bulkError}
            </p>
          )}
        </div>
        <PagedList items={visible} label="بانک سؤال">
          {(q, i) => {
            const c = q.topicId ? byTopic.get(q.topicId) : undefined;
            return (
              <article
                key={q._id}
                className="grid min-w-0 gap-4 rounded-2xl border border-slate-200/70 bg-white/85 p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-[#233B8F]">
                    سؤال {fa(i + 1)}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-600">
                    {types[q.type] ?? q.type}
                  </span>
                  <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-800">
                    سختی:{" "}
                    {q.difficulty
                      ? difficultyLabels[q.difficulty]
                      : "تعیین نشده"}
                  </span>
                  {q.difficultyAssessment?.needsReview && (
                    <span
                      className="text-amber-700"
                      title={q.difficultyAssessment.reason}
                    >
                      برآورد اولیه · قابل اصلاح
                    </span>
                  )}
                  <span className="text-slate-500">
                    سال:{" "}
                    {q.year
                      ? q.year.toLocaleString("fa-IR", { useGrouping: false })
                      : "تعیین نشده"}
                  </span>
                  {q.origin === "ai_reviewed" && (
                    <span className="text-teal-700">
                      هوش مصنوعی · تأیید معلم
                    </span>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCropOpen(false);
                      setEditing(q._id);
                    }}
                  >
                    ویرایش سؤال
                  </Button>
                </div>
                {q.origin === "human_revised" && (
                  <p className="text-xs text-amber-700">
                    نسخهٔ ویرایش‌شده توسط معلم
                  </p>
                )}
                <p className="text-xs font-medium leading-7 text-teal-700">
                  {sourceSummary(q.source)}
                </p>
                {q.source && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs leading-6 text-slate-500">
                    {q.source.sourceTitle && (
                      <span>{q.source.sourceTitle}</span>
                    )}
                    {q.source.examDate && (
                      <span>
                        تاریخ آزمون: <bdi>{q.source.examDate}</bdi>
                      </span>
                    )}
                    {q.source.publishedDate && (
                      <span>
                        انتشار منبع:{" "}
                        {new Date(
                          q.source.publishedDate + "T12:00:00Z",
                        ).toLocaleDateString("fa-IR", { timeZone: "UTC" })}
                      </span>
                    )}
                    {q.source.sourcePage && (
                      <span>صفحهٔ PDF: {fa(q.source.sourcePage)}</span>
                    )}
                    {q.source.sourcePageUrl && (
                      <a
                        href={q.source.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#233B8F] underline underline-offset-4"
                      >
                        صفحهٔ منبع
                      </a>
                    )}
                    {q.source.sourceUrl && (
                      <a
                        href={q.source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#233B8F] underline underline-offset-4"
                      >
                        منبع اصلی
                      </a>
                    )}
                  </div>
                )}
                {q.importEvidence?.answerBasis === "independent_review" && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs leading-6 text-amber-800">
                    پاسخ‌نامهٔ منتشرشده در منبع پیدا نشد؛ پاسخ مرجع مستقل بررسی
                    شده و ارزیابی پاسخ دانش‌آموز نیازمند بررسی معلم است.
                  </p>
                )}
                <QuestionPresentation
                  statement={q.statement}
                  visuals={q.visuals}
                  onCrop={() => {
                    setCropOpen(true);
                    setEditing(q._id);
                  }}
                />
                <p className="border-t border-slate-100 pt-3 text-xs leading-7 text-slate-500">
                  {q.classification === "free"
                    ? "سؤال آزاد"
                    : c
                      ? [
                          c.grade.title,
                          c.book.title,
                          c.chapter.title,
                          c.topic.title,
                        ].join(" / ")
                      : "مبحث در دسترس نیست"}
                </p>
              </article>
            );
          }}
        </PagedList>
      </section>
      {editing && (
        <QuestionEditor
          key={editing}
          versionId={editing}
          cropOpen={cropOpen}
          onClose={() => setEditing(undefined)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
