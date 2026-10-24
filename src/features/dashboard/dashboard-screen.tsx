"use client";
import { Button } from "@/components/ui/button";

import { fa } from "@/lib/presentation";
import type { User, Assignment } from "@/lib/types";
import { ArrowLeft, BookOpen, Target } from "lucide-react";
export function OverviewScreen({
  me,
  teacher,
  assignments,
  students,
  setPage,
}: {
  me: User;
  teacher: boolean;
  assignments: Assignment[];
  students: User[];
  setPage: (v: string) => void;
}) {
  return (
    <>
      <section className="flex items-center justify-between gap-6 rounded-3xl bg-[linear-gradient(110deg,#233b8f,#304d9d)] p-8 text-white [&_p]:mt-3 [&_p]:leading-loose [&_p]:text-indigo-100 max-[650px]:p-6 max-[650px]:[&_svg]:hidden">
        <div>
          <span className="inline-block rounded-full border border-[#19b7ae33] px-3 py-1.5 text-[11px] bg-white/15 text-white">
            یادگیری، با شواهد واقعی
          </span>
          <h2 className="font-bold mt-[18px] text-[26px]">
            سلام {me.name}، خوش آمدید
          </h2>
          <p>
            {teacher
              ? "از اولین تمرین تا تصمیم بهتر برای جلسه بعد، همراه شما هستیم."
              : "با تمرین‌های معلمت شروع کن؛ برای فکرکردن و تلاش‌کردن وقت داری."}
          </p>
          <Button variant="outline" onClick={() => setPage("missions")}>
            مشاهده مأموریت‌ها
            <ArrowLeft size={16} />
          </Button>
        </div>
        <BookOpen size={110} strokeWidth={1} />
      </section>
      <div className="grid grid-cols-4 gap-4 max-[950px]:grid-cols-2 max-[650px]:gap-2.5">
        {[
          [assignments.length, "مأموریت تخصیص‌یافته"],
          [
            assignments.filter((a) => a.state === "completed").length,
            "مأموریت تکمیل‌شده",
          ],
          [
            assignments.filter((a) => a.state === "submitted").length,
            "در انتظار بررسی",
          ],
          [
            teacher
              ? students.length
              : assignments.filter((a) => a.state === "in_progress").length,
            teacher ? "دانش‌آموز همراه" : "تمرین در حال انجام",
          ],
        ].map(([value, title]) => (
          <div
            key={title}
            className="rounded-[20px] border border-slate-200 bg-white/70 p-[22px] [&_strong]:mt-2.5 [&_strong]:block [&_strong]:text-[28px] [&_strong]:text-[#233b8f] max-[650px]:p-4"
          >
            <small className="text-xs leading-loose text-slate-500">
              {title}
            </small>
            <strong>{fa(Number(value))}</strong>
          </div>
        ))}
      </div>
      <section className="rounded-3xl border border-white bg-white/80 p-[26px] shadow-[0_8px_40px_#233b8f06] backdrop-blur-[18px] max-[650px]:p-5 grid gap-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <Target color="#19b7ae" />
          <h2 className="text-[19px] font-bold">گام بعدی شما</h2>
        </div>
        <p className="text-xs leading-loose text-slate-500">
          {teacher
            ? "ابتدا درس و مبحث را بسازید، سؤال معتبر اضافه کنید و دانش‌آموزتان را دعوت کنید."
            : "مأموریت‌های منتشرشده معلم در این بخش آماده شروع هستند."}
        </p>
        <Button
          onClick={() => setPage(teacher ? "content" : "missions")}
          className="justify-self-start"
        >
          {teacher ? "آماده‌سازی محتوا" : "شروع تمرین"}
          <ArrowLeft size={16} />
        </Button>
      </section>
    </>
  );
}
