"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, Send, Ban } from "lucide-react";
import { api } from "@/lib/api";
import type { Course, Enrollment, User } from "@/lib/types";
import type { PdfLibraryItem } from "@/lib/pdf-library";

type ClassGroup = { _id: string; courseId: string; title: string; studentIds: string[] };
type Delivery = {
  _id: string;
  batchId: string;
  title: string;
  pdfId: string;
  studentId: string;
  courseId: string;
  state: string;
  createdAt: string;
};

export function PdfDeliveryTeacher({
  pdfs, currentUserId,
}: { pdfs: PdfLibraryItem[]; currentUserId?: string }) {
  const available = useMemo(() => pdfs.filter((pdf) =>
    pdf.state === "ready" && pdf.visibility === "private" && (!currentUserId || pdf.ownerId === currentUserId),
  ), [pdfs, currentUserId]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pdfId, setPdfId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [nextCourses, nextEnrollments, nextStudents, nextGroups, nextDeliveries] =
        await Promise.all([
          api<Course[]>("/courses"),
          api<Enrollment[]>("/enrollments"),
          api<User[]>("/students"),
          api<ClassGroup[]>("/class-groups"),
          api<Delivery[]>("/pdf-deliveries"),
        ]);
      setCourses(nextCourses);
      setEnrollments(nextEnrollments);
      setStudents(nextStudents);
      setGroups(nextGroups);
      setDeliveries(nextDeliveries);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const members = useMemo(() => enrollments
    .filter((entry) => entry.courseId === courseId && entry.status === "active")
    .map((entry) => entry.studentId), [enrollments, courseId]);
  const chosenGroup = groups.find((group) => group._id === groupId && group.courseId === courseId);
  const recipients = groupId ? (chosenGroup?.studentIds ?? []) : selected;
  const activeRecipients = recipients.filter((sid) => members.includes(sid));
  const batches = [...new Map(deliveries.map((row) => [row.batchId, row])).values()];
  const selectedPdf = available.find((pdf) => pdf._id === pdfId);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pdfId || !courseId || !activeRecipients.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/pdf-deliveries", {
        pdfId, courseId, ...(groupId ? { groupId } : {}),
        studentIds: activeRecipients,
        title: title.trim() || selectedPdf?.title || "تکلیف PDF",
        description: description.trim(),
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      });
      setSelected([]);
      setGroupId("");
      setDescription("");
      setDueAt("");
      await refresh();
      setNotice("PDF برای دانش‌آموزان انتخاب‌شده ارسال شد؛ نیازی به OCR نیست.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(batchId: string) {
    if (!window.confirm("دسترسی همه دریافت‌کنندگان این ارسال لغو شود؟")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/pdf-deliveries/${batchId}/cancel`, {});
      await refresh();
      setNotice("دسترسی PDF ارسال‌شده لغو شد؛ تاریخچه ارسال برای معلم محفوظ است.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 grid gap-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4 sm:p-6" dir="rtl">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Send size={20} aria-hidden /> ارسال مستقیم PDF برای کلاس یا دانش‌آموز
      </h3>
      <p className="text-sm text-slate-600">
        PDF خصوصی را بدون استخراج سؤال یا OCR برای اعضای فعال درس ارسال کن.
        فایل فقط از مسیر اختصاصی تکلیف برای دریافت‌کنندگان مجاز باز می‌شود.
      </p>
      {loading && <p role="status">در حال دریافت کلاس‌ها…</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-teal-100 p-3 text-sm text-teal-900">{notice}</p>}
      {!available.length && <p className="text-sm text-amber-900">برای ارسال، ابتدا یک PDF خصوصی کامل در بانک خودت بارگذاری کن.</p>}
      <form onSubmit={(e) => void send(e)} className="grid gap-3">
        <label className="grid gap-1 text-sm">PDF آماده
          <select required className="min-h-11 rounded-lg border bg-white p-2" value={pdfId}
            onChange={(e) => { setPdfId(e.target.value); setTitle(available.find((x) => x._id === e.target.value)?.title ?? ""); }}>
            <option value="">انتخاب فایل</option>
            {available.map((pdf) => <option key={pdf._id} value={pdf._id}>{pdf.title}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">درس
          <select required className="min-h-11 rounded-lg border bg-white p-2" value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setGroupId(""); setSelected([]); }}>
            <option value="">انتخاب درس</option>
            {courses.map((course) => <option key={course._id} value={course._id}>{course.title}</option>)}
          </select>
        </label>
        {courseId && <label className="grid gap-1 text-sm">مقصد ارسال
          <select className="min-h-11 rounded-lg border bg-white p-2" value={groupId}
            onChange={(e) => { setGroupId(e.target.value); setSelected([]); }}>
            <option value="">انتخاب دانش‌آموزان درس</option>
            {groups.filter((group) => group.courseId === courseId).map((group) => (
              <option key={group._id} value={group._id}>کل کلاس: {group.title}</option>
            ))}
          </select>
        </label>}
        {courseId && !groupId && (
          <fieldset className="grid gap-2 rounded-xl border bg-white p-3">
            <legend className="px-1 text-sm font-medium">دریافت‌کنندگان</legend>
            {!members.length && <p className="text-sm text-slate-600">هنوز عضو فعالی در این درس وجود ندارد.</p>}
            {members.map((studentId) => (
              <label key={studentId} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(studentId)}
                  onChange={(e) => setSelected((old) => e.target.checked
                    ? [...old, studentId]
                    : old.filter((id) => id !== studentId))} />
                {students.find((student) => student._id === studentId)?.name ?? "دانش‌آموز"}
              </label>
            ))}
          </fieldset>
        )}
        {groupId && <p className="text-sm text-slate-600">
          {activeRecipients.length.toLocaleString("fa-IR")} عضو فعال این کلاس PDF را دریافت می‌کنند.
        </p>}
        <label className="grid gap-1 text-sm">عنوان تکلیف
          <input required minLength={3} maxLength={150}
            className="min-h-11 rounded-lg border bg-white p-2"
            value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">توضیحات (اختیاری)
          <input maxLength={700} className="min-h-11 rounded-lg border bg-white p-2"
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">مهلت تکلیف (اختیاری)
          <input type="datetime-local" className="min-h-11 rounded-lg border bg-white p-2"
            value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <button type="submit" disabled={busy || !pdfId || !courseId || !activeRecipients.length || !title.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white disabled:opacity-50">
          <FileUp size={17} aria-hidden /> ارسال PDF به {activeRecipients.length.toLocaleString("fa-IR")} دانش‌آموز
        </button>
      </form>
      <h4 className="font-semibold">ارسال‌های قبلی</h4>
      {!batches.length && <p className="text-sm text-slate-500">هنوز PDF اختصاصی ارسال نشده است.</p>}
      {batches.map((batch) => {
        const rows = deliveries.filter((item) => item.batchId === batch.batchId);
        const cancelled = rows.every((item) => item.state === "cancelled");
        return <div key={batch.batchId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3">
          <div className="text-sm">
            <p className="font-medium">{batch.title}</p>
            <p className="text-xs text-slate-600">
              {rows.length.toLocaleString("fa-IR")} دریافت‌کننده ·
              {rows.filter((item) => item.state === "completed").length.toLocaleString("fa-IR")} نفر اعلام انجام ·
              {cancelled ? "لغوشده" : "فعال"}
            </p>
          </div>
          {!cancelled && <button type="button" disabled={busy} onClick={() => void cancel(batch.batchId)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700 disabled:opacity-50">
            <Ban size={16} aria-hidden /> لغو دسترسی
          </button>}
        </div>;
      })}
    </section>
  );
}
