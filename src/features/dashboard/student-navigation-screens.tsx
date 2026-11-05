"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  Clock3,
  ClipboardCheck,
  ChevronDown,
  Filter,
  Gauge,
  RotateCcw,
  Search,
  Target,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PagedList } from "@/components/ui/paged-list";
import { curriculumTopicChoices } from "@/lib/curriculum";
import { stateLabel } from "@/lib/presentation";
import { parsePracticeFilters, practiceFiltersPath } from "@/lib/student-practice-route";
import {
  emptyStudentContentFilters,
  parseStudentContentFilters,
  studentContentPath,
  type StudentContentFilters,
} from "@/lib/student-content-route";
import type { Assignment, Course, Node, StudentContentItem } from "@/lib/types";

type StudentNavigationActions = {
  assignments: Assignment[];
  courses: Course[];
  busy: boolean;
  open: (assignment: Assignment) => Promise<void>;
  showReport: (assignment: Assignment) => Promise<void>;
  setPage: (page: string) => void;
};

const available = (assignment: Assignment) =>
  !["completed", "submitted", "cancelled"].includes(assignment.state);

const practiceKinds = [
  ["all", "همه"],
  ["topic", "تمرین مبحثی"],
  ["chapter", "آزمون فصل"],
  ["school", "امتحان مدرسه"],
  ["final", "امتحان نهایی"],
  ["konkur", "کنکور"],
  ["mistakes", "مرور اشتباهات"],
  ["smart", "تمرین هوشمند"],
] as const;
type PracticeKind = (typeof practiceKinds)[number][0];

function practiceKind(assignment: Assignment): Exclude<PracticeKind, "all"> {
  const title = assignment.title.replaceAll("‌", " ");
  if (/اشتباه|مرور/.test(title)) return "mistakes";
  if (/هوشمند|پیشنهادی/.test(title)) return "smart";
  const categories = assignment.catalog?.sourceCategories ?? [];
  if (categories.includes("konkur")) return "konkur";
  if (categories.includes("final")) return "final";
  if (categories.some((item) => ["school", "coordinated"].includes(item)))
    return "school";
  if (/فصل/.test(title)) return "chapter";
  return "topic";
}

export function StudentPracticeHub({
  assignments,
  courses,
  nodes,
  busy,
  open,
  showReport,
  setPage,
}: StudentNavigationActions & { nodes: Node[] }) {
  const ready = assignments.filter(available);
  const completed = assignments.filter((item) =>
    ["completed", "submitted"].includes(item.state),
  );
  const featured = ready.find((item) => item.state === "in_progress") ?? ready[0];
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<PracticeKind>("all");
  const [status, setStatus] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [chapterId, setChapterId] = useState("all");
  const [topicId, setTopicId] = useState("all");
  const [year, setYear] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [minDifficulty, setMinDifficulty] = useState(0);
  const [maxDifficulty, setMaxDifficulty] = useState(100);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [sort, setSort] = useState("priority");
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const value = parsePracticeFilters(window.location.search);
    setQuery(value.query);
    setKind(value.kind as PracticeKind);
    setStatus(value.status);
    setCourseId(value.course);
    setChapterId(value.chapter);
    setTopicId(value.topic);
    setYear(value.year);
    setDifficulty(value.difficulty);
    setMinDifficulty(value.minDifficulty);
    setMaxDifficulty(value.maxDifficulty);
    setSort(value.sort);
    setFiltersLoaded(true);
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;
    window.history.replaceState(window.history.state, "", practiceFiltersPath({
      query, kind, status, course: courseId, chapter: chapterId, topic: topicId,
      year, difficulty, minDifficulty, maxDifficulty, sort,
    }));
  }, [filtersLoaded, query, kind, status, courseId, chapterId, topicId, year, difficulty, minDifficulty, maxDifficulty, sort]);

  const topicChoices = useMemo(() => curriculumTopicChoices(nodes), [nodes]);
  const topicChoiceById = useMemo(
    () => new Map(topicChoices.map((choice) => [choice.topic._id, choice])),
    [topicChoices],
  );
  const catalogTopicChoices = useMemo(
    () => topicChoices.filter((choice) =>
      assignments.some((assignment) =>
        (courseId === "all" || assignment.courseId === courseId) &&
        assignment.catalog?.topicIds?.includes(choice.topic._id),
      ),
    ),
    [assignments, courseId, topicChoices],
  );
  const chapters = useMemo(
    () => [...new Map(catalogTopicChoices.map((choice) => [choice.chapter.id, choice.chapter])).values()],
    [catalogTopicChoices],
  );
  const topics = catalogTopicChoices.filter(
    (choice) => chapterId === "all" || choice.chapter.id === chapterId,
  );
  const years = [
    ...new Set(assignments.flatMap((assignment) => assignment.catalog?.academicYears ?? [])),
  ].sort((left, right) => right.localeCompare(left, "fa"));
  const kindCounts = useMemo(
    () =>
      Object.fromEntries(
        practiceKinds.map(([value]) => [
          value,
          value === "all"
            ? assignments.length
            : assignments.filter((assignment) => practiceKind(assignment) === value).length,
        ]),
      ) as Record<PracticeKind, number>,
    [assignments],
  );
  const filtered = useMemo(
    () =>
      assignments.filter((assignment) => {
        const course = courses.find(
          (item) => item._id === assignment.courseId,
        );
        const assignedChoices = (assignment.catalog?.topicIds ?? []).flatMap(
          (id) => {
            const choice = topicChoiceById.get(id);
            return choice ? [choice] : [];
          },
        );
        const score = assignment.catalog?.difficultyScore;
        const matchesDifficulty =
          difficulty === "all" ||
          (difficulty === "unset" && (score === null || score === undefined)) ||
          (difficulty === "easy" && typeof score === "number" && score <= 33) ||
          (difficulty === "medium" && typeof score === "number" && score >= 34 && score <= 66) ||
          (difficulty === "hard" && typeof score === "number" && score >= 67);
        const matchesRange = difficulty === "unset" ||
          (typeof score === "number" && score >= minDifficulty && score <= maxDifficulty);
        const matchesQuery = [assignment.title, course?.title, course?.subject]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("fa")
          .includes(query.trim().toLocaleLowerCase("fa"));
        return (
          matchesQuery &&
          (courseId === "all" || assignment.courseId === courseId) &&
          (chapterId === "all" || assignedChoices.some((choice) => choice.chapter.id === chapterId)) &&
          (topicId === "all" || assignment.catalog?.topicIds?.includes(topicId)) &&
          (year === "all" || assignment.catalog?.academicYears.includes(year)) &&
          matchesDifficulty &&
          (difficulty === "unset" || (minDifficulty === 0 && maxDifficulty === 100) || matchesRange) &&
          (kind === "all" || practiceKind(assignment) === kind) &&
          (status === "all" ||
            (status === "ready" && available(assignment)) ||
            (status === "completed" &&
              ["completed", "submitted"].includes(assignment.state)))
        );
      }).sort((left, right) => {
        if (sort === "questions") return (right.catalog?.questionCount ?? 0) - (left.catalog?.questionCount ?? 0);
        if (sort === "hardest") return (right.catalog?.difficultyScore ?? -1) - (left.catalog?.difficultyScore ?? -1);
        if (sort === "easiest") return (left.catalog?.difficultyScore ?? 101) - (right.catalog?.difficultyScore ?? 101);
        if (sort === "success") return (right.catalog?.successRate ?? -1) - (left.catalog?.successRate ?? -1);
        return Number(available(right)) - Number(available(left));
      }),
    [assignments, chapterId, courseId, courses, difficulty, minDifficulty, maxDifficulty, kind, query, sort, status, topicChoiceById, topicId, year],
  );

  function clearFilters() {
    setQuery("");
    setKind("all");
    setStatus("all");
    setCourseId("all");
    setChapterId("all");
    setTopicId("all");
    setYear("all");
    setDifficulty("all");
    setMinDifficulty(0);
    setMaxDifficulty(100);
    setSort("priority");
  }

  return (
    <div className="grid gap-5">
      <section className="hy-learning-hero" aria-label="پیشنهاد شروع تمرین">
        <div className="hy-learning-hero-content">
          <span className="hy-learning-eyebrow"><Target size={16} aria-hidden /> قدم بعدی تو</span>
          <h2 className="hy-learning-hero-title">{featured ? "با یک تمرین، جلوتر برو" : "از همین‌جا یادگیری را شروع کن"}</h2>
          <p className="hy-learning-hero-description">{featured
            ? "یک فعالیت آماده داری. لازم نیست بین همهٔ گزینه‌ها بگردی؛ از همین تمرین شروع کن."
            : "هنوز تمرین آماده‌ای نداری؟ می‌توانی درس‌هایت را ببینی یا از معلم مأموریت تازه بگیری."}</p>
          <div className="hy-learning-featured" data-testid="practice-featured-action">
            <div className="min-w-0">
              <span className="hy-learning-featured-label">{featured ? (featured.state === "in_progress" ? "ادامهٔ تمرین نیمه‌تمام" : "پیشنهاد امروز") : "مسیر پیشنهادی"}</span>
              <h3 className="hy-learning-featured-title">{featured?.title ?? "دیدن درس‌های من"}</h3>
              <p className="text-xs text-slate-500">{featured
                ? `${courses.find((course) => course._id === featured.courseId)?.title ?? "تمرین آموزشی"} · ${featured.catalog?.questionCount?.toLocaleString("fa-IR") ?? "تعداد نامشخص"} سؤال`
                : "از یک درس شروع کن و مسیر مناسب را انتخاب کن."}</p>
            </div>
            <Button disabled={busy} onClick={() => featured ? void open(featured) : setPage("courses")}>
              {featured ? "شروع / ادامه" : "دیدن درس‌ها"} <ArrowLeft size={16} aria-hidden />
            </Button>
          </div>
        </div>
        <div className="hy-learning-hero-aside">
          <span className="hy-learning-aside-icon"><BookOpenCheck size={36} strokeWidth={1.5} aria-hidden /></span>
          <strong className="text-3xl font-black">{ready.length.toLocaleString("fa-IR")}</strong>
          <span className="text-sm text-blue-100">فعالیت آمادهٔ انجام</span>
          <button className="hy-learning-hero-link" type="button" onClick={() => setPage("student-missions")}>همهٔ مأموریت‌ها <ArrowLeft size={15} aria-hidden /></button>
        </div>
      </section>

      <section aria-label="مسیرهای دیگر تمرین" className="hy-learning-shortcuts">
        <button type="button" className="hy-learning-shortcut" onClick={() => setPage("student-mistakes")}>
          <span className="hy-learning-shortcut-icon hy-learning-shortcut-rose"><RotateCcw size={19} aria-hidden /></span>
          <span><strong>مرور اشتباهات</strong><small>از پاسخ‌های قبلی یاد بگیر</small></span>
          <ArrowLeft size={16} className="ms-auto text-slate-400" aria-hidden />
        </button>
        <button type="button" className="hy-learning-shortcut" onClick={() => setPage("courses")}>
          <span className="hy-learning-shortcut-icon hy-learning-shortcut-mint"><BookOpenCheck size={19} aria-hidden /></span>
          <span><strong>درس‌های من</strong><small>{courses.length.toLocaleString("fa-IR")} درس برای کاوش</small></span>
          <ArrowLeft size={16} className="ms-auto text-slate-400" aria-hidden />
        </button>
        <button type="button" className="hy-learning-shortcut" onClick={() => setPage("student-progress")}>
          <span className="hy-learning-shortcut-icon hy-learning-shortcut-gold"><BarChart3 size={19} aria-hidden /></span>
          <span><strong>پیشرفت من</strong><small>{completed.length.toLocaleString("fa-IR")} فعالیت تکمیل‌شده</small></span>
          <ArrowLeft size={16} className="ms-auto text-slate-400" aria-hidden />
        </button>
      </section>

      <section className="hy-practice-catalog grid gap-5 border-t border-slate-200 bg-white pt-5 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="hy-learning-section-label">یک تمرین مناسب پیدا کن</span>
            <h2 className="text-xl font-extrabold text-[#19355f]">همهٔ تمرین‌ها و آزمون‌ها</h2>
            <p className="mt-1 text-xs text-slate-600">
              تمرین مناسب را با درس، مبحث، سال و سختی پیدا کن.
            </p>
          </div>
          {!!completed.length && (
            <Button
              variant="outline"
              onClick={() => setPage("student-progress")}
            >
              <BarChart3 size={16} aria-hidden /> پیشرفت من
            </Button>
          )}
        </div>

        <label className="hy-learning-catalog-search">
          <Search size={18} className="text-[#2457b8]" aria-hidden />
          <span className="sr-only">جست‌وجوی تمرین‌ها</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="چه درسی یا چه تمرینی می‌خواهی؟" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
          <span className="hidden text-xs text-slate-500 sm:inline">{filtered.length.toLocaleString("fa-IR")} نتیجه</span>
        </label>
        <button
          type="button"
          className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 px-4 text-sm font-bold lg:hidden"
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
        >
          <span className="flex items-center gap-2"><Filter size={17} aria-hidden /> فیلتر و مرتب‌سازی</span>
          <ChevronDown size={17} className={clsx("transition-transform", filtersOpen && "rotate-180")} aria-hidden />
        </button>

        <div className={clsx("gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid lg:grid-cols-4", filtersOpen ? "grid" : "hidden")}>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700 lg:hidden">
            جست‌وجو
            <span className="relative">
              <Search
                size={17}
                aria-hidden
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="glass-field min-h-12 w-full pe-10 ps-3"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="عنوان تمرین یا نام درس"
              />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            نوع فعالیت
            <select
              className="glass-field min-h-12 px-3"
              value={kind}
              onChange={(event) => setKind(event.target.value as PracticeKind)}
            >
              {practiceKinds.map(([value, label]) => (
                <option key={value} value={value}>
                  {label} ({kindCounts[value].toLocaleString("fa-IR")})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            وضعیت
            <select
              className="glass-field min-h-12 px-3"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">همهٔ وضعیت‌ها</option>
              <option value="ready">آماده / در حال انجام</option>
              <option value="completed">تکمیل‌شده</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            درس
            <select className="glass-field min-h-12 px-3" value={courseId} onChange={(event) => { setCourseId(event.target.value); setChapterId("all"); setTopicId("all"); }}>
              <option value="all">همهٔ درس‌ها</option>
              {courses.map((course) => <option key={course._id} value={course._id}>{course.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            فصل
            <select className="glass-field min-h-12 px-3" value={chapterId} onChange={(event) => { setChapterId(event.target.value); setTopicId("all"); }}>
              <option value="all">همهٔ فصل‌ها</option>
              {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            مبحث
            <select className="glass-field min-h-12 px-3" value={topicId} onChange={(event) => setTopicId(event.target.value)}>
              <option value="all">همهٔ مباحث</option>
              {topics.map((choice) => <option key={choice.topic._id} value={choice.topic._id}>{choice.topic.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            سال آزمون
            <select className="glass-field min-h-12 px-3" value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">همهٔ سال‌ها</option>
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            سختی واقعی
            <select className="glass-field min-h-12 px-3" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="all">همهٔ درجه‌ها</option>
              <option value="unset">تعیین نشده</option>
              <option value="easy">۰ تا ۳۳</option>
              <option value="medium">۳۴ تا ۶۶</option>
              <option value="hard">۶۷ تا ۱۰۰</option>
            </select>
          </label>
          <fieldset className="grid gap-2 text-xs font-medium text-slate-700 sm:col-span-2">
            <legend>بازهٔ دلخواه سختی (۰ تا ۱۰۰)</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">از
                <input aria-label="حداقل سختی" type="number" min={0} max={maxDifficulty} step={1} value={minDifficulty}
                  className="glass-field min-h-12 w-full px-3" onChange={(event) => setMinDifficulty(Math.min(maxDifficulty, Math.max(0, Math.round(Number(event.target.value) || 0))))} />
              </label>
              <label className="grid gap-1">تا
                <input aria-label="حداکثر سختی" type="number" min={minDifficulty} max={100} step={1} value={maxDifficulty}
                  className="glass-field min-h-12 w-full px-3" onChange={(event) => setMaxDifficulty(Math.max(minDifficulty, Math.min(100, Math.round(Number(event.target.value) || 0))))} />
              </label>
            </div>
            <p className="font-normal text-slate-500">سؤال‌های بدون درجهٔ سختی فقط با گزینهٔ «تعیین نشده» نمایش داده می‌شوند.</p>
          </fieldset>
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
            مرتب‌سازی
            <select className="glass-field min-h-12 px-3" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="priority">آماده‌ها در ابتدا</option>
              <option value="questions">بیشترین سؤال</option>
              <option value="hardest">سخت‌ترین</option>
              <option value="easiest">آسان‌ترین</option>
              <option value="success">بیشترین موفقیت</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button variant="outline" className="min-h-12 w-full" onClick={clearFilters}><RotateCcw size={15} aria-hidden /> پاک‌کردن فیلترها</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>{filtered.length.toLocaleString("fa-IR")} فعالیت پیدا شد</span>
          {busy && <span role="status">در حال به‌روزرسانی…</span>}
        </div>

        {!assignments.length ? (
          <div className="hy-learning-empty">
            <BookOpenCheck size={29} className="text-[#2457b8]" aria-hidden />
            <h3 className="font-bold text-[#17305e]">هنوز تمرینی به تو اختصاص داده نشده</h3>
            <p className="text-sm leading-loose text-slate-600">می‌توانی درس‌های خودت را مرور کنی یا مأموریت‌های معلم را ببینی.</p>
            <div className="flex flex-wrap gap-2"><Button onClick={() => setPage("courses")}>دیدن درس‌ها</Button><Button variant="outline" onClick={() => setPage("student-missions")}>مأموریت‌ها</Button></div>
          </div>
        ) : !filtered.length ? (
          <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Filter size={24} className="text-slate-400" aria-hidden />
            <p className="text-sm font-medium">نتیجه‌ای با این فیلتر پیدا نشد.</p>
            <Button
              variant="outline"
              onClick={clearFilters}
            >
              پاک‌کردن فیلترها
            </Button>
          </div>
        ) : (
          <PagedList items={filtered} label="تمرین‌ها و آزمون‌ها" pageSize={8} className="grid gap-3 md:grid-cols-2">
            {(assignment) => (
              <article
                key={assignment._id}
                className="hy-learning-practice-card grid gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="grid gap-1">
                    <span className="text-xs font-medium text-[#2457b8]">
                      {practiceKinds.find(
                        ([value]) => value === practiceKind(assignment),
                      )?.[1] ?? "تمرین مبحثی"}
                    </span>
                    <h3 className="font-bold">{assignment.title}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {stateLabel[assignment.state] ?? assignment.state}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {courses.find((course) => course._id === assignment.courseId)
                    ?.title ?? "تمرین زیر نظر معلم"}
                </p>
                <dl className="hy-learning-card-facts text-xs text-slate-600">
                  <div><dt><ClipboardCheck size={14} aria-hidden /> سؤال</dt><dd>{(assignment.catalog?.questionCount ?? Object.keys(assignment.progress ?? {}).length).toLocaleString("fa-IR")}</dd></div>
                  <div><dt><Clock3 size={14} aria-hidden /> زمان</dt><dd>حدود {Math.max(5, (assignment.catalog?.questionCount ?? 1) * 2).toLocaleString("fa-IR")} دقیقه</dd></div>
                  <div><dt><Gauge size={14} aria-hidden /> سختی</dt><dd>{assignment.catalog?.difficultyScore == null ? "نامشخص" : `${assignment.catalog.difficultyScore.toLocaleString("fa-IR")} از ۱۰۰`}</dd></div>
                </dl>
                {assignment.catalog?.successRate != null && <p className="text-xs text-emerald-700">موفقیت قبلی: {assignment.catalog.successRate.toLocaleString("fa-IR")}٪</p>}
                {!!assignment.catalog?.academicYears.length && (
                  <p className="text-xs text-slate-500">
                    سال آزمون: {assignment.catalog.academicYears.join("، ")}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {available(assignment) && (
                    <Button
                      disabled={busy}
                      onClick={() => void open(assignment)}
                    >
                      <ClipboardCheck size={16} aria-hidden /> شروع / ادامه
                    </Button>
                  )}
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => void showReport(assignment)}
                  >
                    گزارش
                  </Button>
                </div>
              </article>
            )}
          </PagedList>
        )}
      </section>
    </div>
  );
}

export function StudentSearchScreen({
  nodes,
  contentItems,
  assignments,
  open,
  busy,
  setPage,
}: StudentNavigationActions & {
  nodes: Node[];
  contentItems: StudentContentItem[];
}) {
  const [library, setLibrary] = useState<{ items: StudentContentItem[]; nodes: Node[] }>({ items: [], nodes: [] });
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [starting, setStarting] = useState("");
  useEffect(() => {
    let cancelled = false;
    api<{ items: StudentContentItem[]; nodes: Node[] }>("/student/library")
      .then(rows => { if (!cancelled) setLibrary(rows); })
      .catch(error => { if (!cancelled) setLibraryError((error as Error).message); })
      .finally(() => { if (!cancelled) setLibraryLoading(false); });
    return () => { cancelled = true; };
  }, []);
  async function startLibrary(questionId: string, courseId: string) {
    setStarting(questionId);
    setLibraryError("");
    try {
      const result = await api<{ assignmentId: string }>(`/student/library/${questionId}/start`, { courseId });
      await open({ _id: result.assignmentId } as Assignment);
    } catch (error) { setLibraryError((error as Error).message); }
    finally { setStarting(""); }
  }
  const mergedNodes = useMemo(() => [...new Map([...nodes, ...library.nodes].map(node => [node._id, node])).values()], [nodes, library.nodes]);
  const mergedItems = useMemo(() => [...new Map([...contentItems, ...library.items].map(item => [item.questionId, item])).values()], [contentItems, library.items]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<StudentContentFilters>(
    emptyStudentContentFilters,
  );
  useEffect(() => {
    setFilters(parseStudentContentFilters(window.location.search));
  }, []);
  function update(next: Partial<typeof filters>) {
    setFilters((current) => {
      const value = { ...current, ...next };
      window.history.replaceState(
        window.history.state,
        "",
        studentContentPath(value),
      );
      return value;
    });
  }
  const choices = useMemo(() => curriculumTopicChoices(mergedNodes), [mergedNodes]);
  const byTopic = useMemo(
    () => new Map(choices.map((choice) => [choice.topic._id, choice])),
    [choices],
  );
  const unique = (rows: { id: string; title: string }[]) => [
    ...new Map(rows.map((row) => [row.id, row])).values(),
  ];
  const scopedItems = (scope: Partial<typeof filters>) =>
    mergedItems.filter((item) => {
      const choice = byTopic.get(item.topicId);
      return (
        !!choice &&
        (!scope.grade || choice.grade.id === scope.grade) &&
        (!scope.track || choice.tracks.includes(scope.track)) &&
        (!scope.book || choice.book.id === scope.book) &&
        (!scope.chapter || choice.chapter.id === scope.chapter) &&
        (!scope.topic || choice.topic._id === scope.topic)
      );
    });
  const counts = (items: StudentContentItem[]) => ({
    questions: items.length,
    exams: new Set(
      items.flatMap((item) => (item.examKey ? [item.examKey] : [])),
    ).size,
    resources: new Set(
      items.flatMap((item) => (item.resourceKey ? [item.resourceKey] : [])),
    ).size,
  });
  const grades = unique(choices.map((choice) => choice.grade));
  const tracks = [
    ...new Set(
      choices
        .filter((choice) => choice.grade.id === filters.grade)
        .flatMap((choice) => choice.tracks),
    ),
  ];
  const books = unique(
    choices
      .filter(
        (choice) =>
          choice.grade.id === filters.grade &&
          (!filters.track || choice.tracks.includes(filters.track)),
      )
      .map((choice) => choice.book),
  );
  const chapters = unique(
    choices
      .filter(
        (choice) =>
          choice.grade.id === filters.grade && choice.book.id === filters.book,
      )
      .map((choice) => choice.chapter),
  );
  const topics = choices.filter(
    (choice) =>
      choice.grade.id === filters.grade &&
      choice.book.id === filters.book &&
      choice.chapter.id === filters.chapter,
  );
  const selectedItems = scopedItems(filters);
  const selectedCounts = counts(selectedItems);
  const contentRows = useMemo(() => {
    const rows = filters.content === "questions"
      ? selectedItems.map((item) => ({ key: item.questionId, title: byTopic.get(item.topicId)?.topic.title ?? "سؤال آموزشی", items: [item] }))
      : [...new Map(selectedItems.filter((item) => filters.content === "exams" ? !!item.examKey : !!item.resourceKey).map((item) => [filters.content === "exams" ? item.examKey! : item.resourceKey!, true])).keys()].map((key) => {
          const rows = selectedItems.filter((item) => (filters.content === "exams" ? item.examKey : item.resourceKey) === key);
          return { key, title: (filters.content === "exams" ? rows[0]?.examTitle : rows[0]?.resourceTitle) || "مجموعهٔ آموزشی", items: rows };
        });
    const needle = filters.query.trim().toLocaleLowerCase("fa");
    return rows.filter((row) => !needle || [row.title, ...row.items.flatMap((item) => [
      byTopic.get(item.topicId)?.book.title,
      byTopic.get(item.topicId)?.chapter.title,
      byTopic.get(item.topicId)?.topic.title,
      item.academicYear,
      item.examTitle,
      item.resourceTitle,
    ])].filter(Boolean).join(" ").toLocaleLowerCase("fa").includes(needle))
      .sort((a, b) => {
        const value = (row: typeof a) => row.items.map((item) => item.difficultyScore).filter((x): x is number => typeof x === "number");
        const score = (row: typeof a) => { const scores = value(row); return scores.length ? scores.reduce((sum, x) => sum + x, 0) / scores.length : null; };
        if (filters.sort === "hardest") return (score(b) ?? -1) - (score(a) ?? -1);
        if (filters.sort === "easiest") return (score(a) ?? 101) - (score(b) ?? 101);
        if (filters.sort === "newest") return (b.items[0]?.academicYear ?? "").localeCompare(a.items[0]?.academicYear ?? "", "fa");
        return a.title.localeCompare(b.title, "fa");
      });
  }, [selectedItems, filters.content, filters.query, filters.sort, byTopic]);
  const trackLabels: Record<string, string> = {
    common: "مشترک متوسطه اول",
    mathematics: "ریاضی و فیزیک",
    experimental: "علوم تجربی",
    humanities: "علوم انسانی",
    islamic: "علوم و معارف اسلامی",
    custom: "بدون رشته مشخص",
  };
  const contentTypes = [
    ["questions", "سؤال", selectedCounts.questions],
    ["exams", "آزمون", selectedCounts.exams],
    ["resources", "منبع", selectedCounts.resources],
  ] as const;
  const countLabel = (items: StudentContentItem[]) => {
    const value = counts(items);
    return `${value.questions.toLocaleString("fa-IR")} سؤال · ${value.exams.toLocaleString("fa-IR")} آزمون · ${value.resources.toLocaleString("fa-IR")} منبع`;
  };
  const stages = [
    {
      key: "grade",
      title: "پایه",
      enabled: true,
      options: grades,
      scope: (id: string) => ({ grade: id }),
      reset: { track: "", book: "", chapter: "", topic: "" },
    },
    {
      key: "track",
      title: "رشته",
      enabled: !!filters.grade,
      options: tracks.map((id) => ({ id, title: trackLabels[id] ?? id })),
      scope: (id: string) => ({ grade: filters.grade, track: id }),
      reset: { book: "", chapter: "", topic: "" },
    },
    {
      key: "book",
      title: "درس",
      enabled: !!filters.grade && (!!filters.track || !tracks.length),
      options: books,
      scope: (id: string) => ({
        grade: filters.grade,
        track: filters.track,
        book: id,
      }),
      reset: { chapter: "", topic: "" },
    },
    {
      key: "chapter",
      title: "فصل",
      enabled: !!filters.book,
      options: chapters,
      scope: (id: string) => ({
        grade: filters.grade,
        track: filters.track,
        book: filters.book,
        chapter: id,
      }),
      reset: { topic: "" },
    },
    {
      key: "topic",
      title: "مبحث",
      enabled: !!filters.chapter,
      options: topics.map((choice) => ({
        id: choice.topic._id,
        title: choice.topic.title,
      })),
      scope: (id: string) => ({
        grade: filters.grade,
        track: filters.track,
        book: filters.book,
        chapter: filters.chapter,
        topic: id,
      }),
      reset: {},
    },
  ] as const;

  return (
    <div className="grid gap-6">
      <section className="hy-learning-hero" aria-label="کتابخانهٔ آموزشی">
        <div className="hy-learning-hero-content">
          <span className="hy-learning-eyebrow"><BookOpenCheck size={16} aria-hidden /> کتابخانهٔ من</span>
          <h2 className="hy-learning-hero-title">برای یادگرفتن، از کنجکاوی شروع کن</h2>
          <p className="hy-learning-hero-description">سؤال‌ها و مجموعه‌های آموزشیِ مجاز در کلاس‌هایت را بر اساس درس و مبحث پیدا کن. برای پاسخ‌دادن، مأموریت مرتبط را باز کن.</p>
          <div className="flex flex-wrap gap-2 text-sm text-white/90">
            <span className="rounded-full border border-white/25 px-3 py-1">{mergedItems.length.toLocaleString("fa-IR")} سؤال</span>
            <span className="rounded-full border border-white/25 px-3 py-1">{new Set(mergedItems.flatMap((item) => item.examKey ? [item.examKey] : [])).size.toLocaleString("fa-IR")} مجموعهٔ آزمون</span>
          </div>
        </div>
      </section>
      <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="جست‌وجوی کتابخانه">
        <label className="hy-learning-catalog-search"><Search size={18} aria-hidden className="text-[#2457b8]" />
          <span className="sr-only">جست‌وجوی کتابخانه</span>
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={filters.query} onChange={(event) => update({ query: event.target.value.slice(0, 120) })} placeholder="نام درس، مبحث، سال یا مجموعه را جست‌وجو کن…" />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([ ["questions", "سؤال"], ["exams", "آزمون"], ["resources", "منبع"] ] as const).map(([kind, label]) => (
            <button type="button" key={kind} aria-pressed={filters.content === kind} className={clsx("rounded-xl border px-3 py-3 text-sm font-bold", filters.content === kind ? "border-[#2457b8] bg-[#eaf1ff] text-[#17305e]" : "border-slate-200 text-slate-600 hover:border-slate-400")} onClick={() => update({content: kind})}>{label}</button>
          ))}
          <label className="grid gap-1 text-xs text-slate-600"><span>مرتب‌سازی</span><select className="glass-field min-h-9 px-2" value={filters.sort} onChange={(event) => update({sort: event.target.value as StudentContentFilters["sort"]})}>
            <option value="relevant">نام محتوا</option><option value="newest">جدیدترین سال</option><option value="hardest">سخت‌ترین</option><option value="easiest">آسان‌ترین</option>
          </select></label>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 font-bold md:hidden"
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
        >
          <span className="flex items-center gap-2">
            <Filter size={18} aria-hidden /> مسیر و فیلترها
          </span>
          <span>{filtersOpen ? "بستن" : "نمایش"}</span>
        </button>
        <div
          className={clsx(
            "mt-4 gap-5 md:mt-0 md:grid",
            filtersOpen ? "grid" : "hidden md:grid",
          )}
        >
          {stages.map((stage, index) => (
            <fieldset key={stage.key} disabled={!stage.enabled}>
              <legend className="mb-2 text-sm font-bold text-[#17305e]">
                {index + 1}. {stage.title}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {stage.options.map((option) => {
                  const active = filters[stage.key] === option.id;
                  const rows = scopedItems(stage.scope(option.id));
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        update({
                          ...stage.reset,
                          [stage.key]: active ? "" : option.id,
                        })
                      }
                      className={clsx(
                        "rounded-2xl border p-3 text-right disabled:cursor-not-allowed disabled:opacity-40",
                        active
                          ? "border-[#2457b8] bg-[#eaf1ff]"
                          : "border-slate-200 bg-white hover:border-slate-400",
                      )}
                    >
                      <strong className="block text-sm">{option.title}</strong>
                      <span className="mt-1 block text-xs text-slate-500">
                        {countLabel(rows)}
                      </span>
                    </button>
                  );
                })}
                {stage.enabled && !stage.options.length && (
                  <p className="text-sm text-slate-500">
                    موردی در این مسیر موجود نیست.
                  </p>
                )}
              </div>
            </fieldset>
          ))}
          <fieldset disabled={!filters.topic}>
            <legend className="mb-2 text-sm font-bold text-[#17305e]">
              6. نوع محتوا
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {contentTypes.map(([id, label, value]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => update({ content: id })}
                  className={clsx(
                    "rounded-2xl border p-3 text-center disabled:opacity-40",
                    filters.content === id
                      ? "border-[#2457b8] bg-[#eaf1ff]"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <strong className="block">
                    {value.toLocaleString("fa-IR")}
                  </strong>
                  <span className="text-xs text-slate-600">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </section>
      {libraryLoading && <p role="status" className="text-sm text-slate-500">در حال دریافت سؤال‌های منتشرشدهٔ درس‌ها…</p>}
      {libraryError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{libraryError}</p>}
      <section className="grid gap-4" aria-label="نتایج کتابخانه">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-xl font-extrabold text-[#17305e]">محتوای پیدا شده</h2>
          <p className="mt-1 text-xs text-slate-500">{contentRows.length.toLocaleString("fa-IR")} نتیجه · {countLabel(selectedItems)}</p></div>
          {(filters.topic || filters.grade || filters.query) && <Button variant="outline" onClick={() => update({ ...emptyStudentContentFilters, content: filters.content })}><RotateCcw size={15} aria-hidden /> پاک‌کردن جست‌وجو و فیلترها</Button>}
        </div>
        {!contentRows.length ? <div className="hy-learning-empty">
          <Search size={28} className="text-[#2457b8]" aria-hidden />
          <h3 className="font-bold text-[#17305e]">محتوایی با این شرایط پیدا نشد</h3>
          <p className="text-sm text-slate-600">کتابخانه شامل مأموریت‌های تو و سؤال‌های منتشرشده برای درس‌هایی است که عضو آن‌ها هستی. فیلترها را پاک کن یا درس دیگری انتخاب کن.</p>
          <Button onClick={() => update(emptyStudentContentFilters)}>نمایش همهٔ محتوا</Button>
        </div> : <PagedList items={contentRows} label="محتوای کتابخانه" pageSize={9} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(row) => {
            const first = row.items[0];
            const topic = byTopic.get(first.topicId);
            const scores = row.items.map((item) => item.difficultyScore).filter((value): value is number => typeof value === "number");
            const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
            const related = assignments.find((assignment) => assignment.state !== "cancelled" && row.items.some((item) => assignment.questionVersionIds?.includes(item.questionId)));
            return <article key={row.key} className="hy-learning-practice-card grid gap-3">
              <span className="text-xs font-bold text-[#2457b8]">{filters.content === "questions" ? "سؤال آموزشی" : filters.content === "exams" ? "مجموعهٔ آزمون" : "منبع آموزشی"}</span>
              <h3 className="text-base font-bold text-[#17305e]">{row.title}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{[topic?.book.title, topic?.chapter.title, topic?.topic.title].filter(Boolean).join(" ← ") || "موضوع در دسترس"}</p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-lg bg-slate-100 px-2 py-1">{row.items.length.toLocaleString("fa-IR")} سؤال</span>
                {first.academicYear && <span className="rounded-lg bg-slate-100 px-2 py-1">سال {first.academicYear}</span>}
                <span className="rounded-lg bg-slate-100 px-2 py-1">سختی: {score === null ? "نامشخص" : `${score.toLocaleString("fa-IR")} از ۱۰۰`}</span>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {related ? <Button disabled={busy} onClick={() => void open(related)}>رفتن به تمرین مرتبط <ArrowLeft size={15} aria-hidden /></Button> : first.library && first.courseIds[0] ? <Button disabled={busy || !!starting} onClick={() => void startLibrary(first.questionId, first.courseIds[0])}>{starting === first.questionId ? "در حال آماده‌سازی…" : "شروع تمرین مستقل"}<ArrowLeft size={15} aria-hidden /></Button> : <Button variant="outline" onClick={() => setPage("student-missions")}>دیدن مأموریت‌ها</Button>}
              </div>
            </article>;
          }}
        </PagedList>}
        <p className="text-xs leading-relaxed text-slate-500">سؤال‌های منتشرشده فقط برای دانش‌آموزان عضو درس قابل‌تمرین‌اند. بانک خصوصی معلم و پاسخ‌های مرجع در فهرست نمایش داده نمی‌شوند.</p>
      </section>
    </div>
  );
}
