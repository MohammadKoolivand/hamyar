"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  Filter,
  RotateCcw,
  Target,
} from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { PagedList } from "@/components/ui/paged-list";
import { curriculumTopicChoices } from "@/lib/curriculum";
import { stateLabel } from "@/lib/presentation";
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

export function StudentPracticeHub({
  assignments,
  courses,
  busy,
  open,
  showReport,
  setPage,
}: StudentNavigationActions) {
  const ready = assignments.filter(available);
  const completed = assignments.filter((item) =>
    ["completed", "submitted"].includes(item.state),
  );

  return (
    <div className="grid gap-5">
      <section className="glass-hero grid gap-5 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-3">
          <span className="glass-kicker w-fit px-3 py-1.5 text-xs">
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

      <section
        aria-label="راه‌های شروع تمرین"
        className="grid gap-3 sm:grid-cols-3"
      >
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
            className="glass-panel grid cursor-pointer gap-3 p-5 text-right transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2457b8] motion-reduce:transform-none"
          >
            <item.icon size={22} className="text-[#2457b8]" aria-hidden />
            <div>
              <h3 className="font-bold">{item.title}</h3>
              {item.value !== null && (
                <strong className="mt-1 block text-2xl text-[#1f3f97]">
                  {item.value.toLocaleString("fa-IR")}
                </strong>
              )}
            </div>
            <p className="text-xs leading-6 text-slate-600">
              {item.description}
            </p>
          </button>
        ))}
      </section>

      <section className="glass-panel grid gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">ادامه بده</h2>
            <p className="mt-1 text-xs text-slate-600">
              مأموریت‌های شروع‌نشده و نیمه‌تمام در اولویت‌اند.
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
        {!ready.length ? (
          <p className="glass-note p-4 text-sm leading-loose">
            فعلاً تمرین آماده‌ای نداری. مأموریت‌های تکمیل‌شده و نتیجه‌ها در
            «پیشرفت من» محفوظ‌اند.
          </p>
        ) : (
          <PagedList items={ready} label="تمرین‌های آماده">
            {(assignment) => (
              <article
                key={assignment._id}
                className="glass-option grid gap-3 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">{assignment.title}</h3>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">
                    {stateLabel[assignment.state]}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {courses.find((course) => course._id === assignment.courseId)
                    ?.title ?? "تمرین زیر نظر معلم"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void open(assignment)}>
                    <ClipboardCheck size={16} aria-hidden /> شروع / ادامه
                  </Button>
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
