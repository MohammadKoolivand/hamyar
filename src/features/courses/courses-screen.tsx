"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { Course, Enrollment, Assignment, User } from "@/lib/types";

export function CoursesScreen({
  teacher,
  courses,
  enrollments,
  assignments,
  students,
  refresh,
}: {
  teacher: boolean;
  courses: Course[];
  enrollments: Enrollment[];
  assignments: Assignment[];
  students: User[];
  refresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/courses", { title: title.trim(), subject: subject.trim() });
      setTitle("");
      setSubject("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      {teacher && (
        <section className="glass-panel grid gap-4 p-6">
          <h2 className="text-lg font-bold">ایجاد درس آموزشی</h2>
          <p className="text-sm text-slate-600">
            هر درس یک فضای آموزشی متعلق به شماست. دانش‌آموز پس از پذیرش دعوت همان درس به آن عضو می‌شود.
          </p>
          <form onSubmit={(event) => void createCourse(event)} className="grid gap-3 sm:grid-cols-2">
            <Field title="نام درس">
              <input className="glass-field min-h-11 w-full p-3" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} required placeholder="ریاضی" />
            </Field>
            <Field title="عنوان دوره">
              <input className="glass-field min-h-11 w-full p-3" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="ریاضی پایه دهم" />
            </Field>
            <Button disabled={busy} type="submit"><Plus size={16} /> ایجاد درس</Button>
          </form>
          {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
        </section>
      )}
      <section className="grid gap-4">
        <h2 className="text-lg font-bold">{teacher ? "درس‌های تحت تدریس" : "درس‌های من"}</h2>
        {!courses.length && (
          <div className="glass-panel p-6 text-sm leading-loose text-slate-600">
            {teacher
              ? "هنوز درسی تعریف نکرده‌اید. یک درس بسازید و از بخش دانش‌آموزان برای همان درس دعوت بفرستید."
              : "هنوز عضو هیچ درسی نیستید. از معلم کد دعوت مخصوص آن درس را بگیرید و در صفحه اصلی وارد کنید."}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => {
            const enrolled = enrollments.filter((e) => e.courseId === course._id);
            const count = assignments.filter((a) => a.courseId === course._id).length;
            return (
              <article className="glass-card grid gap-3 p-5" key={course._id}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[#19B7AE15] text-[#096c67]"><BookOpen size={20}/></span>
                  <div>
                    <p className="text-xs text-slate-500">{course.subject}</p>
                    <h3 className="font-bold">{course.title}</h3>
                  </div>
                </div>
                {teacher ? (
                  <>
                    <p className="text-sm text-slate-600">{enrolled.length} دانش‌آموز عضو · {count} مأموریت</p>
                    {!!enrolled.length && (
                      <p className="text-xs leading-loose text-slate-600">
                        {enrolled.map((e) => students.find((s) => s._id === e.studentId)?.name ?? "دانش‌آموز").join("، ")}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">معلم: {enrolled[0]?.teacherName ?? "معلم"}</p>
                    <p className="text-xs text-slate-500">{count} مأموریت این درس</p>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
