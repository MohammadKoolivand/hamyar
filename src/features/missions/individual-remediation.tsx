"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { Course, Enrollment, User } from "@/lib/types";

type Candidate = {
  questionVersionId: string;
  statement: string;
  type: string;
  lastResult: string;
};
type CandidateResult = { studentId: string; courseId: string | null; items: Candidate[] };

export function IndividualRemediation({
  students, courses, enrollments, refresh,
}: {
  students: User[];
  courses: Course[];
  enrollments: Enrollment[];
  refresh: () => Promise<void>;
}) {
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [items, setItems] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("تمرین تقویتی اختصاصی");
  const [independent, setIndependent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!studentId) return;
    let live = true;
    const query = courseId ? "?courseId=" + encodeURIComponent(courseId) : "";
    api<CandidateResult>("/students/" + studentId + "/remediation-candidates" + query)
      .then((result) => {
        if (!live) return;
        setItems(result.items);
        setSelected([]);
        setError("");
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!live) return;
        setItems([]);
        setSelected([]);
        setError(err.message);
        setLoading(false);
      });
    return () => { live = false; };
  }, [studentId, courseId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!studentId || !selected.length) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await api("/students/" + studentId + "/remediation-missions", {
        title: title.trim(),
        ...(courseId ? { courseId } : {}),
        questionVersionIds: selected,
        policy: {
          maxAttempts: independent ? 1 : 3,
          maxHints: independent ? 0 : 2,
          independent,
          maxHintLevel: independent ? 0 : 3,
          allowFullSolution: false,
        },
      });
      setSelected([]);
      await refresh();
      setNotice("تمرین تقویتی فقط برای این دانش‌آموز منتشر شد.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const studentCourses = courses.filter((course) =>
    enrollments.some((e) => e.courseId === course._id && e.studentId === studentId));

  return (
    <section className="glass-panel grid gap-4 p-6" data-testid="individual-remediation">
      <div className="flex items-center gap-3">
        <ClipboardCheck size={24} color="#233B8F" aria-hidden />
        <div>
          <h2 className="text-lg font-bold">تمرین تقویتی فردی از اشتباهات ثبت‌شده</h2>
          <p className="text-sm leading-loose text-slate-600">
            فقط خطاهای دارای ارزیابی معتبر و هنوز اصلاح‌نشده پیشنهاد می‌شوند؛
            شما سؤال‌ها را انتخاب و تمرین را تأیید می‌کنید.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field title="دانش‌آموز برای تمرین فردی">
          <select className="glass-field min-h-11 w-full p-3" value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setCourseId("");
              setItems([]);
              setSelected([]);
              setLoading(!!e.target.value);
            }}>
            <option value="">انتخاب دانش‌آموز</option>
            {students.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </Field>
        <Field title="درس تمرین">
          <select className="glass-field min-h-11 w-full p-3" value={courseId}
            disabled={!studentId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setItems([]);
              setSelected([]);
              setLoading(true);
            }}>
            <option value="">مأموریت‌های قدیمی بدون درس</option>
            {studentCourses.map((c) =>
              <option value={c._id} key={c._id}>{c.title} · {c.subject}</option>)}
          </select>
        </Field>
      </div>
      {loading && <p role="status" className="text-sm text-slate-600">در حال بررسی آخرین پاسخ‌ها…</p>}
      {studentId && !loading && !items.length && !error && (
        <p className="glass-note p-4 text-sm leading-loose">
          در این درس هنوز سؤال نیازمند تمرین مجدد با آخرین ارزیابی معتبر وجود ندارد.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="glass-note p-3 text-sm">{notice}</p>}
      {!!items.length && (
        <form className="grid gap-3" onSubmit={(e) => void create(e)}>
          <Field title="عنوان تمرین تقویتی">
            <input className="glass-field min-h-11 w-full p-3" value={title}
              onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={150} required />
          </Field>
          <p className="text-sm font-medium">
            سؤال‌هایی که آخرین نتیجه معتبرشان نیازمند اصلاح است (حداکثر ۱۰ سؤال)
          </p>
          {items.map((q) => (
            <label className="glass-option flex items-start gap-3 p-3 text-sm" key={q.questionVersionId}>
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#233B8F]"
                checked={selected.includes(q.questionVersionId)}
                disabled={!selected.includes(q.questionVersionId) && selected.length >= 10}
                onChange={(e) => setSelected(e.target.checked
                  ? [...selected, q.questionVersionId]
                  : selected.filter((id) => id !== q.questionVersionId))} />
              <span>{q.statement}
                <span className="mt-1 block text-xs text-slate-500">
                  {q.lastResult === "incorrect" ? "آخرین پاسخ نیازمند اصلاح" : "آخرین پاسخ تاحدی درست"}
                </span>
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-[#233B8F]" checked={independent}
              onChange={(e) => setIndependent(e.target.checked)} />
            سنجش مستقل (یک تلاش، بدون راهنمایی)
          </label>
          <p className="text-xs text-slate-600">
            با انتشار، فقط این دانش‌آموز مأموریت تازه دریافت می‌کند. پاسخ‌های قبلی حذف نمی‌شوند.
          </p>
          <Button disabled={busy || !selected.length} type="submit">
            انتشار تمرین تقویتی برای این دانش‌آموز
          </Button>
        </form>
      )}
    </section>
  );
}
