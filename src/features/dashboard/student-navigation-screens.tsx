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
      <section className="grid gap-5 border-b border-slate-200 bg-white py-5 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-3">
          <span className="w-fit rounded-full bg-[#eef4ff] px-3 py-1.5 text-xs font-medium text-[#2457b8]">
            مرکز فعالیت‌های یادگیری
          </span>
          <h2 className="text-2xl font-bold text-[#17305e]">تمرین و آزمون</h2>
          <p className="max-w-2xl text-sm leading-loose text-slate-600">
            تمرین آماده را ادامه بده، مأموریت تازهٔ معلم را شروع کن یا سراغ
            اشتباه‌هایی برو که نیاز به مرور دارند.
          </p>
        </div>
        <Button onClick={() => setPage("student-missions")}>
          همهٔ مأموریت‌های معلم <ArrowLeft size={16} aria-hidden />
        </Button>
      </section>

      <section aria-label="راه‌های شروع تمرین" className="flex flex-wrap gap-2">
        {[
          {
            title: "مأموریت‌های آماده",
            value: ready.length,
            description: "تمرین‌هایی که می‌توانی همین حالا شروع یا ادامه بدهی.",
            icon: Target,
            page: "student-missions",
          },
          {
            title: "مرور اشتباهات",
            value: null,
            description: "پاسخ‌های نیازمند اصلاح و شواهد یادگیری را مرور کن.",
            icon: RotateCcw,
            page: "student-mistakes",
          },
          {
            title: "درس‌های فعال",
            value: courses.length,
            description: "فعالیت‌ها و مأموریت‌ها را به تفکیک درس ببین.",
            icon: BookOpenCheck,
            page: "courses",
          },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setPage(item.page)}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-right hover:border-[#8eafe9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2457b8]"
          >
            <item.icon size={18} className="text-[#2457b8]" aria-hidden />
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">{item.title}</h3>
              {item.value !== null && (
                <strong className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-[#1f3f97]">
                  {item.value.toLocaleString("fa-IR")}
                </strong>
              )}
            </div>
          </button>
        ))}
      </section>

      <section className="grid gap-5 border-t border-slate-200 bg-white pt-5 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">کاتالوگ تمرین و آزمون</h2>
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
          <label className="grid gap-1.5 text-xs font-medium text-slate-700">
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
          <p className="glass-note p-4 text-sm leading-loose">
            فعلاً تمرین آماده‌ای نداری. مأموریت‌های تکمیل‌شده و نتیجه‌ها در
            «پیشرفت من» محفوظ‌اند.
          </p>
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
          <PagedList items={filtered} label="تمرین‌ها و آزمون‌ها" pageSize={8}>
            {(assignment) => (
              <article
                key={assignment._id}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
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
                <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt>تعداد سؤال</dt>
                    <dd className="mt-1 font-bold text-slate-900">
                      {(assignment.catalog?.questionCount ??
                        Object.keys(assignment.progress ?? {}).length
                      ).toLocaleString("fa-IR")}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="flex items-center gap-1">
                      <Clock3 size={14} aria-hidden /> زمان تقریبی
                    </dt>
                    <dd className="mt-1 font-bold text-slate-900">
                      حدود {Math.max(5, (assignment.catalog?.questionCount ?? 1) * 2).toLocaleString("fa-IR")} دقیقه
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="flex items-center gap-1">
                      <Gauge size={14} aria-hidden /> سختی واقعی
                    </dt>
                    <dd className="mt-1 font-bold text-slate-900">
                      {assignment.catalog?.difficultyScore === null ||
                      assignment.catalog?.difficultyScore === undefined
                        ? "تعیین نشده"
                        : `${assignment.catalog.difficultyScore.toLocaleString("fa-IR")} از ۱۰۰`}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt>موفقیت قبلی من</dt>
                    <dd className="mt-1 font-bold text-slate-900">
                      {assignment.catalog?.successRate === null ||
                      assignment.catalog?.successRate === undefined
                        ? "بدون سابقه"
                        : `${assignment.catalog.successRate.toLocaleString("fa-IR")}٪`}
                    </dd>
                  </div>
                </dl>
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
  setPage,
}: StudentNavigationActions & {
  nodes: Node[];
  contentItems: StudentContentItem[];
}) {
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
  const choices = useMemo(() => curriculumTopicChoices(nodes), [nodes]);
  const byTopic = useMemo(
    () => new Map(choices.map((choice) => [choice.topic._id, choice])),
    [choices],
  );
  const unique = (rows: { id: string; title: string }[]) => [
    ...new Map(rows.map((row) => [row.id, row])).values(),
  ];
  const scopedItems = (scope: Partial<typeof filters>) =>
    contentItems.filter((item) => {
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
      <section className="rounded-3xl bg-[#eef4ff] p-6 sm:p-8">
        <div>
          <h2 className="text-2xl font-bold text-[#17305e]">مرور محتوا</h2>
          <p className="mt-2 text-sm leading-loose text-slate-600">
            از پایه شروع کن و قدم‌به‌قدم به سؤال، آزمون یا منبع موردنظر برس.
          </p>
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
      {filters.topic ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="font-bold">محتوای این مبحث</h2>
          <p className="mt-2 text-sm text-slate-600">
            {countLabel(selectedItems)} در دسترس است. برای حل سؤال‌ها، مأموریت
            مرتبط را باز کن.
          </p>
          <Button className="mt-4" onClick={() => setPage("student-practice")}>
            رفتن به تمرین‌ها <ArrowLeft size={16} aria-hidden />
          </Button>
        </section>
      ) : (
        <p className="rounded-2xl bg-[#f3f6fa] p-5 text-sm text-slate-600">
          برای دیدن محتوا، مسیر را تا انتخاب مبحث ادامه بده. انتخاب‌ها در نشانی
          صفحه ذخیره می‌شوند.
        </p>
      )}
    </div>
  );
}
