"use client";

import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  RotateCcw,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { curriculumTopicChoices } from "@/lib/curriculum";
import type {
  Assignment,
  DashboardTopicEvidence,
  StudentDashboardData,
} from "@/lib/types";

const count = (value: number) => value.toLocaleString("fa-IR");

export function StudentCourseScreen({
  courseId,
  data,
  assignments,
  open,
  showReport,
  setPage,
}: {
  courseId: string | null;
  data: StudentDashboardData | null;
  assignments: Assignment[];
  open: (assignment: Assignment) => Promise<void>;
  showReport: (assignment: Assignment) => Promise<void>;
  setPage: (page: string, contextId?: string) => void;
}) {
  const course = data?.courses.find((item) => item.courseId === courseId);
  if (!data)
    return (
      <p className="rounded-3xl border border-slate-200 bg-white p-6 text-sm">
        اطلاعات درس در حال بارگذاری است.
      </p>
    );
  if (!course)
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">این درس در دسترس نیست</h2>
        <p className="mt-2 text-sm text-slate-600">
          ممکن است عضویت درس پایان یافته باشد یا پیوند معتبر نباشد.
        </p>
        <Button className="mt-4" onClick={() => setPage("courses")}>
          بازگشت به درس‌های من
        </Button>
      </section>
    );

  const courseAssignments = assignments.filter(
    (assignment) => assignment.courseId === course.courseId,
  );
  const ready = courseAssignments.filter((assignment) =>
    ["published", "in_progress"].includes(assignment.state),
  );
  const completed = courseAssignments.filter(
    (assignment) => assignment.state === "completed",
  );
  const items = (data.content?.items ?? []).filter((item) =>
    item.courseIds.includes(course.courseId),
  );
  const topicIds = new Set(items.map((item) => item.topicId));
  const choices = curriculumTopicChoices(
    data.content?.nodes ?? [],
  ).filter((choice) => topicIds.has(choice.topic._id));
  const chapters = [
    ...new Map(
      choices.map((choice) => [choice.chapter.id, choice.chapter.title]),
    ).entries(),
  ];
  const exams = [
    ...new Map(
      items.flatMap((item) =>
        item.examKey
          ? [[item.examKey, item.examTitle || "آزمون مرتبط"] as const]
          : [],
      ),
    ).values(),
  ];
  const resources = [
    ...new Map(
      items.flatMap((item) =>
        item.resourceKey
          ? [[item.resourceKey, item.resourceTitle || "منبع مرتبط"] as const]
          : [],
      ),
    ).values(),
  ];
  const strong = course.topics.filter(isStrong);
  const weak = course.topics.filter(isWeak);
  const stats: [string, number, LucideIcon][] = [
    ["پاسخ‌داده‌شده", course.answeredQuestions, ClipboardCheck],
    ["مأموریت آماده", ready.length, Target],
    ["مبحث تمرین‌شده", course.topics.length, BookOpenCheck],
    ["اشتباه نیازمند مرور", course.incorrectQuestions, RotateCcw],
  ];

  return (
    <div className="grid gap-6" data-testid="student-course-page">
      <button
        type="button"
        className="flex w-fit items-center gap-2 text-sm font-medium text-[#1f3f97]"
        onClick={() => setPage("courses")}
      >
        <ArrowRight size={17} aria-hidden /> درس‌های من
      </button>

      <section className="hy-learning-detail-hero p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm text-slate-600">{course.subject}</p>
            <h2 className="mt-1 text-3xl font-bold text-[#17305e]">
              {course.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              معلم: {course.teacherName}
            </p>
          </div>
          <div className="rounded-2xl bg-white px-5 py-4 text-center">
            <p className="text-xs text-slate-600">پیشرفت واقعی یادگیری</p>
            <strong className="mt-1 block text-3xl text-[#1f3f97]">
              {course.learningProgress === null
                ? "—"
                : `${count(course.learningProgress)}٪`}
            </strong>
            <p className="mt-1 max-w-48 text-[11px] leading-relaxed text-slate-500">
              بر پایه پاسخ‌های مستقل ارزیابی‌شده
            </p>
          </div>
        </div>
      </section>

      {ready.length > 0 && (
        <section className="hy-learning-next-lesson" aria-label="پیشنهاد ادامهٔ درس">
          <div><span className="hy-learning-section-label">قدم بعدی در این درس</span><h3 className="font-bold text-[#19355f]">{ready[0].title}</h3><p className="mt-1 text-xs text-slate-600">{ready.length.toLocaleString("fa-IR")} مأموریت آماده داری؛ همین‌جا ادامه بده.</p></div>
          <Button onClick={() => void open(ready[0])}>شروع / ادامه <ArrowRight size={16} aria-hidden /></Button>
        </section>
      )}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <Icon size={19} className="text-[#1f3f97]" aria-hidden />
            <p className="mt-3 text-xs text-slate-600">{String(label)}</p>
            <strong className="mt-1 block text-xl">
              {count(Number(value))}
            </strong>
          </div>
        ))}
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Target size={21} className="text-[#1f3f97]" aria-hidden />
          مأموریت‌ها و تمرین‌های این درس
        </h3>
        {!courseAssignments.length && (
          <p className="text-sm text-slate-600">
            هنوز مأموریتی منتشر نشده است.
          </p>
        )}
        {courseAssignments.map((assignment) => (
          <article
            key={assignment._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f4f7fb] p-4"
          >
            <div>
              <h4 className="font-bold">{assignment.title}</h4>
              <p className="mt-1 text-xs text-slate-600">
                {assignment.questions?.length
                  ? `${count(assignment.questions.length)} سؤال`
                  : "مأموریت درس"}
              </p>
            </div>
            {["published", "in_progress"].includes(assignment.state) ? (
              <Button onClick={() => void open(assignment)}>
                شروع / ادامه
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => void showReport(assignment)}
              >
                مشاهده نتیجه
              </Button>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TopicPanel title="مباحث قوی" tone="strong" topics={strong} />
        <TopicPanel title="نیازمند مرور" tone="weak" topics={weak} />
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-xl font-bold">فصل‌ها و مباحث</h3>
        {!choices.length ? (
          <p className="text-sm text-slate-600">
            هنوز برای سؤال‌های این درس مبحث آموزشی ثبت نشده است.
          </p>
        ) : (
          chapters.map(([chapterId, chapterTitle]) => (
            <div key={chapterId} className="rounded-2xl bg-[#f4f7fb] p-4">
              <h4 className="font-bold">{chapterTitle}</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {choices
                  .filter((choice) => choice.chapter.id === chapterId)
                  .map((choice) => (
                    <span
                      key={choice.topic._id}
                      className="rounded-full bg-white px-3 py-1.5 text-xs"
                    >
                      {choice.topic.title}
                    </span>
                  ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ListPanel
          title={`آزمون‌های آماده (${count(exams.length)})`}
          icon={ClipboardCheck}
          items={exams}
          empty="آزمون آماده‌ای برای این درس ثبت نشده است."
        />
        <ListPanel
          title={`منابع آموزشی (${count(resources.length)})`}
          icon={FileText}
          items={resources}
          empty="منبع آموزشی مرتبطی ثبت نشده است."
        />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-[#eef4ff] p-5 sm:p-6">
        <div>
          <h3 className="font-bold">دفترچه اشتباهات {course.title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {count(course.incorrectQuestions)} پاسخ این درس برای مرور ثبت شده
            است.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPage("student-mistakes")}>
          <RotateCcw size={16} aria-hidden /> مرور اشتباهات
        </Button>
      </section>

      {!!completed.length && (
        <p className="text-center text-xs text-slate-500">
          {count(completed.length)} مأموریت این درس تکمیل شده است.
        </p>
      )}
    </div>
  );
}

function isStrong(topic: DashboardTopicEvidence) {
  return topic.evaluated > 0 && topic.correctIndependent > topic.incorrect;
}
function isWeak(topic: DashboardTopicEvidence) {
  return topic.incorrect > 0 && topic.incorrect >= topic.correctIndependent;
}

function TopicPanel({
  title,
  topics,
  tone,
}: {
  title: string;
  topics: DashboardTopicEvidence[];
  tone: "strong" | "weak";
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        {tone === "strong" ? (
          <CheckCircle2 size={20} className="text-emerald-500" aria-hidden />
        ) : (
          <TrendingUp size={20} className="text-amber-500" aria-hidden />
        )}
        {title}
      </h3>
      {!topics.length ? (
        <p className="mt-3 text-sm text-slate-600">
          هنوز شواهد کافی برای این بخش وجود ندارد.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {topics.map((topic) => (
            <div key={topic.topicId} className="rounded-xl bg-[#f4f7fb] p-3">
              <strong className="text-sm">{topic.title}</strong>
              <p className="mt-1 text-xs text-slate-600">
                {count(topic.answered)} پاسخ · {count(topic.incorrect)} نیازمند
                مرور
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ListPanel({
  title,
  items,
  empty,
  icon: Icon,
}: {
  title: string;
  items: string[];
  empty: string;
  icon: typeof FileText;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Icon size={20} className="text-[#1f3f97]" aria-hidden /> {title}
      </h3>
      {!items.length ? (
        <p className="mt-3 text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-4 grid gap-2 text-sm">
          {items.slice(0, 6).map((item) => (
            <li key={item} className="rounded-xl bg-[#f4f7fb] p-3">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
