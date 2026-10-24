"use client";
import { Button } from "@/components/ui/button";
import { StudentJoinTeacher } from "@/features/students/join-teacher";

import { fa } from "@/lib/presentation";
import type { User, Assignment } from "@/lib/types";
import { ArrowLeft, BookOpen, Target } from "lucide-react";
export function OverviewScreen({
  me,
  teacher,
  assignments,
  students,
  setPage,
  invitationToken,
  onJoined,
}: {
  me: User;
  teacher: boolean;
  assignments: Assignment[];
  students: User[];
  setPage: (v: string) => void;
  invitationToken?: string;
  onJoined?: () => Promise<void>;
}) {
  return (
    <>
      <section className="glass-hero flex items-center justify-between gap-6 p-8 [&_p]:mt-3 [&_p]:leading-loose max-[650px]:p-6 max-[650px]:[&_svg]:hidden">
        <div>
          <span className="glass-kicker inline-block px-3 py-1.5 text-[11px]">
            یادگیری، با شواهد واقعی
          </span>
          <h2 className="font-bold mt-[18px] text-[26px]">
            سلام {me.name}، خوش آمدید
          </h2>
          <p>
            {teacher
              ? "از اولین تمرین تا تصمیم بهتر برای جلسه بعد، همراه شما هستیم."
              : assignments.length
                ? "با مأموریت‌های معلم‌هایت شروع کن؛ برای فکرکردن و تلاش‌کردن وقت داری."
                : "حسابت آماده است. برای دریافت مأموریت از معلم، کد دعوت او را وارد کن."}
          </p>
          {(teacher || assignments.length > 0) && (
            <Button variant="outline" onClick={() => setPage("missions")}>
              مشاهده مأموریت‌ها
              <ArrowLeft size={16} />
            </Button>
          )}
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
            className="glass-stat p-[22px] [&_strong]:mt-2.5 [&_strong]:block [&_strong]:text-[28px] [&_strong]:text-[#233b8f] max-[650px]:p-4"
          >
            <small className="text-xs leading-loose text-slate-500">
              {title}
            </small>
            <strong>{fa(Number(value))}</strong>
          </div>
        ))}
      </div>
      <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <Target color="#19b7ae" />
          <h2 className="text-[19px] font-bold">گام بعدی شما</h2>
        </div>
        <p className="text-xs leading-loose text-slate-500">
          {teacher
            ? "ابتدا درس و مبحث را بسازید، سؤال معتبر اضافه کنید و دانش‌آموزتان را دعوت کنید."
            : assignments.length
              ? "مأموریت‌های منتشرشده معلم در این بخش آماده شروع هستند."
              : "هنوز مأموریتی نداری. با اتصال به معلم می‌توانی تمرین‌های او را دریافت کنی."}
        </p>
        {(teacher || assignments.length > 0) && (
          <Button
            onClick={() => setPage(teacher ? "content" : "missions")}
            className="justify-self-start"
          >
            {teacher ? "آماده‌سازی محتوا" : "شروع تمرین"}
            <ArrowLeft size={16} />
          </Button>
        )}
      </section>
      {!teacher && onJoined && (
        <StudentJoinTeacher invitationToken={invitationToken} onJoined={onJoined} />
      )}
    </>
  );
}
