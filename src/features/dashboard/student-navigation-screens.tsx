"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  RotateCcw,
  Search,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PagedList } from "@/components/ui/paged-list";
import { stateLabel } from "@/lib/presentation";
import type { Assignment, Course } from "@/lib/types";

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
  assignments,
  courses,
  busy,
  open,
  showReport,
  setPage,
}: StudentNavigationActions) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("fa-IR");
  const results = useMemo(() => {
    if (!normalized) return { courses: [], assignments: [] };
    return {
      courses: courses.filter((course) =>
        `${course.title} ${course.subject}`
          .toLocaleLowerCase("fa-IR")
          .includes(normalized),
      ),
      assignments: assignments.filter((assignment) => {
        const course = courses.find((item) => item._id === assignment.courseId);
        return `${assignment.title} ${course?.title ?? ""} ${course?.subject ?? ""}`
          .toLocaleLowerCase("fa-IR")
          .includes(normalized);
      }),
    };
  }, [assignments, courses, normalized]);
  const count = results.courses.length + results.assignments.length;

  return (
    <div className="grid gap-5">
      <section className="glass-hero grid gap-4 p-6 sm:p-8">
        <div>
          <h2 className="text-2xl font-bold text-[#17305e]">جست‌وجو</h2>
          <p className="mt-2 text-sm leading-loose text-slate-600">
            در درس‌ها و مأموریت‌هایی جست‌وجو کن که واقعاً به حساب تو دسترسی
            دارند.
          </p>
        </div>
        <label className="relative block">
          <span className="sr-only">جست‌وجو در درس‌ها و مأموریت‌ها</span>
          <Search
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
            size={19}
            aria-hidden
          />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="glass-field min-h-12 w-full py-3 pr-12 pl-4"
            placeholder="نام درس یا مأموریت را بنویس…"
          />
        </label>
        {normalized && (
          <p role="status" className="text-xs text-slate-600">
            {count.toLocaleString("fa-IR")} نتیجه پیدا شد.
          </p>
        )}
      </section>

      {!normalized ? (
        <p className="glass-note p-5 text-sm leading-loose">
          جست‌وجو فقط داده‌های مجاز همین دانش‌آموز را نشان می‌دهد.
        </p>
      ) : !count ? (
        <p className="glass-panel p-6 text-center text-sm text-slate-600">
          نتیجه‌ای پیدا نشد. نام درس یا مأموریت را کوتاه‌تر بنویس.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="glass-panel grid content-start gap-3 p-5">
            <h2 className="font-bold">درس‌ها</h2>
            {!results.courses.length && (
              <p className="text-sm text-slate-500">درسی پیدا نشد.</p>
            )}
            {results.courses.map((course) => (
              <button
                key={course._id}
                type="button"
                onClick={() => setPage("courses")}
                className="glass-option grid cursor-pointer gap-1 p-4 text-right"
              >
                <strong>{course.title}</strong>
                <span className="text-xs text-slate-600">{course.subject}</span>
              </button>
            ))}
          </section>
          <section className="glass-panel grid content-start gap-3 p-5">
            <h2 className="font-bold">مأموریت‌ها</h2>
            {!results.assignments.length && (
              <p className="text-sm text-slate-500">مأموریتی پیدا نشد.</p>
            )}
            {results.assignments.map((assignment) => (
              <article
                key={assignment._id}
                className="glass-option grid gap-3 p-4"
              >
                <div>
                  <h3 className="font-bold">{assignment.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {stateLabel[assignment.state]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {available(assignment) && (
                    <Button
                      disabled={busy}
                      onClick={() => void open(assignment)}
                    >
                      شروع / ادامه
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
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
