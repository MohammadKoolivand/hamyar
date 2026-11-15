"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, ShieldAlert, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Question } from "@/lib/types";

type Submission = {
  _id: string; questionId?: string; versionId: string; status: string;
  licenseBasis: string; sourceReference: string; rightsNote?: string;
  existingVersionId?: string; decidedReason?: string;
  question?: { statement: string; type: string; options?: string[]; reference?: string; hints?: string[] } | null;
};
type Similar = { questionVersionId: string; statement: string; kind: "exact" | "similar"; score: number };
const field = "min-h-11 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";

export function TeacherPublicProposals({ questions }: { questions: Question[] }) {
  const [requests, setRequests] = useState<Submission[]>([]);
  const [versionId, setVersionId] = useState("");
  const [licenseBasis, setLicenseBasis] = useState("original");
  const [sourceReference, setSourceReference] = useState("");
  const [rightsNote, setRightsNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const privateQuestions = questions.filter((q) => q.visibility === "private");
  async function refresh() {
    setRequests(await api<Submission[]>("/questions/publication-requests"));
  }
  useEffect(() => { void refresh().catch(() => setError("درخواست‌های انتشار دریافت نشد.")); }, []);
  async function submit() {
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`/questions/${versionId}/propose-public`, {
        versionId, licenseBasis, sourceReference: sourceReference.trim(),
        rightsNote: rightsNote.trim(), consentToShare: true,
      });
      setMessage("درخواست به صف بازبینی مدیر بانک ارسال شد؛ سؤال تا تأیید خصوصی می‌ماند.");
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <section className="grid gap-3 rounded-2xl border border-teal-200 bg-white p-4 sm:p-5" dir="rtl">
      <h3 className="flex items-center gap-2 font-bold"><FileCheck2 size={19} /> پیشنهاد سؤال به بانک عمومی همیار</h3>
      <p className="text-sm text-slate-600">فقط سؤال خصوصی خودت را پیشنهاد بده. سؤال قبل از تأیید مدیر بانک عمومی نمی‌شود. منبع و مجوز استفاده باید واقعی باشد.</p>
      <label className="grid gap-1 text-sm">سؤال خصوصی
        <select className={field} value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          <option value="">انتخاب سؤال</option>
          {privateQuestions.map((q) => <option key={q._id} value={q._id}>{q.statement.slice(0, 100)}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">مبنای حق انتشار
        <select className={field} value={licenseBasis} onChange={(e) => setLicenseBasis(e.target.value)}>
          <option value="original">سؤال تألیف خودم است</option>
          <option value="licensed">از صاحب اثر مجوز دارم</option>
          <option value="public_domain">اثر در مالکیت عمومی است</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">منبع و مدرک ارجاع
        <input className={field} minLength={3} maxLength={500} value={sourceReference}
          onChange={(e) => setSourceReference(e.target.value)} placeholder="تألیف خودم / مشخصات کتاب / لینک مجوز" />
      </label>
      <label className="grid gap-1 text-sm">توضیح مجوز (اختیاری)
        <textarea className={field} rows={2} maxLength={1000} value={rightsNote}
          onChange={(e) => setRightsNote(e.target.value)} />
      </label>
      <button type="button" disabled={!versionId || sourceReference.trim().length < 3 || busy}
        onClick={() => void submit()} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm text-white disabled:opacity-50">
        درخواست بررسی و انتشار عمومی
      </button>
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <h4 className="font-semibold">وضعیت پیشنهادهای من</h4>
      {!requests.length && <p className="text-sm text-slate-500">هنوز پیشنهادی ثبت نشده است.</p>}
      {requests.map((item) => <p key={item._id} className="rounded-lg border p-3 text-sm">
        {questions.find((q) => q._id === item.versionId)?.statement.slice(0, 80) ?? item.versionId} ·
        {" "}{item.status === "pending" ? "در انتظار بررسی" : item.status === "approved"
          ? "تأیید و منتشر شد" : item.status === "linked_existing" ? "به سؤال موجود ارجاع داده شد" : "رد شد"}
        {item.decidedReason && <span className="block text-xs text-slate-600">دلیل: {item.decidedReason}</span>}
      </p>)}
    </section>
  );
}

export function AdminPublicReview() {
  const [items, setItems] = useState<Submission[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<Record<string, Similar[]>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    setItems(await api<Submission[]>("/admin/public-question-submissions"));
  }
  useEffect(() => { void refresh().catch(() => setError("صف بررسی دریافت نشد.")); }, []);
  async function check(item: Submission) {
    if (!item.question) return;
    setBusy(item.questionId ?? item._id); setError("");
    try {
      const data = await api<{ matches: Similar[] }>("/questions/duplicates/check", {
        statement: item.question.statement, type: item.question.type,
        options: item.question.options ?? [],
      });
      setMatches((old) => ({ ...old, [item.questionId ?? item._id]: data.matches }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  async function review(item: Submission, decision: "approve" | "reject" | "use_existing", existingVersionId?: string) {
    const key = item.questionId ?? item._id;
    if ((reason[key] ?? "").trim().length < 10) {
      setError("برای تصمیم مدیر حداقل ۱۰ نویسه دلیل بنویسید."); return;
    }
    setBusy(key); setMessage(""); setError("");
    try {
      await api(`/admin/public-question-submissions/${key}/review`, {
        decision, reason: reason[key].trim(),
        ...(existingVersionId ? { existingVersionId } : {}),
      });
      await refresh();
      setMessage("تصمیم بررسی ثبت شد؛ سوابق سؤال محفوظ است.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  return (
    <section className="grid gap-3 rounded-2xl border border-indigo-200 bg-white p-4 sm:p-5" dir="rtl">
      <h3 className="flex items-center gap-2 font-bold"><ShieldAlert size={19} /> صف تأیید بانک عمومی (مدیر)</h3>
      <p className="text-xs text-slate-600">تأیید علمی، مالکیت محتوا و مستندات حق نشر مسئولیت بازبین انسانی است. پیش از انتشار، موارد مشابه را بررسی کنید.</p>
      <button type="button" onClick={() => void refresh()} className="w-fit rounded-lg border px-3 py-2 text-sm">به‌روزرسانی صف</button>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      {!items.length && <p className="text-sm text-slate-500">درخواست در انتظار بررسی وجود ندارد.</p>}
      {items.map((item) => {
        const key = item.questionId ?? item._id;
        const exact = (matches[key] ?? []).filter((match) => match.kind === "exact");
        return <article key={key} className="grid gap-3 rounded-xl border p-4">
          <p className="font-medium">{item.question?.statement ?? "نسخه سؤال در دسترس نیست"}</p>
          <p className="text-xs text-slate-600">منبع: {item.sourceReference} · حق استفاده: {item.licenseBasis}</p>
          <p className="rounded-lg bg-indigo-50 p-2 text-sm">پاسخ مرجع (فقط مدیر): {item.question?.reference ?? "ثبت نشده"}</p>
          {!!item.question?.options?.length && <p className="text-xs text-slate-600">گزینه‌ها: {item.question.options.join(" | ")}</p>}
          {item.rightsNote && <p className="text-xs text-slate-600">توضیح: {item.rightsNote}</p>}
          <button type="button" disabled={busy === key || !item.question} onClick={() => void check(item)}
            className="w-fit rounded-lg border px-3 py-2 text-sm">بررسی سؤال‌های مشابه</button>
          {(matches[key] ?? []).map((match) => <p key={match.questionVersionId} className="rounded-lg bg-slate-50 p-2 text-sm">
            {match.kind === "exact" ? "تکراری دقیق" : "مشابه احتمالی"} · {Math.round(match.score * 100)}٪ · {match.statement}
          </p>)}
          <label className="grid gap-1 text-sm">دلیل تصمیم
            <textarea className={field} rows={2} minLength={10} maxLength={1000}
              value={reason[key] ?? ""} onChange={(e) => setReason((old) => ({ ...old, [key]: e.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy === key || !matches[key]} onClick={() => void review(item, "approve")}
              className="inline-flex items-center gap-2 rounded-lg border border-teal-200 px-3 py-2 text-sm text-teal-800">
              <CheckCircle2 size={16} /> تأیید انتشار مستقل
            </button>
            {exact.map((match) => <button type="button" key={match.questionVersionId}
              disabled={busy === key} onClick={() => void review(item, "use_existing", match.questionVersionId)}
              className="rounded-lg border border-amber-300 px-3 py-2 text-sm">استفاده از سؤال موجود ({match.questionVersionId.slice(0, 8)})</button>)}
            <button type="button" disabled={busy === key} onClick={() => void review(item, "reject")}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-800">
              <XCircle size={16} /> رد درخواست
            </button>
          </div>
        </article>;
      })}
    </section>
  );
}

type PublicReport = {
  _id: string; versionId: string; category: string;
  description: string; createdAt: string;
};

export function AdminPublicQuestionReports() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  async function refresh() {
    setReports(await api<PublicReport[]>("/admin/public-question-reports"));
  }
  useEffect(() => { void refresh().catch(() => setError("گزارش‌های کاربران دریافت نشد.")); }, []);
  async function resolve(id: string, decision: "resolved" | "dismissed") {
    setError(""); setMessage(""); setBusy(id);
    try {
      await api(`/admin/public-question-reports/${id}/resolve`, {
        decision, note: (notes[id] ?? "").trim(),
      });
      await refresh();
      setMessage("نتیجه بررسی گزارش ثبت شد.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  return (
    <section className="grid gap-3 rounded-2xl border border-amber-200 bg-white p-4 sm:p-5" dir="rtl">
      <h3 className="font-bold">گزارش اشکال سؤال‌های عمومی</h3>
      <p className="text-xs text-slate-600">بستن گزارش به معنی اصلاح خودکار سؤال نیست؛ نسخه سؤال باید جداگانه توسط صاحب محتوا اصلاح شود.</p>
      <button type="button" className="w-fit rounded-lg border px-3 py-2 text-sm"
        onClick={() => void refresh()}>به‌روزرسانی گزارش‌ها</button>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="text-sm text-teal-700">{message}</p>}
      {!reports.length && <p className="text-sm text-slate-500">گزارش بررسی‌نشده وجود ندارد.</p>}
      {reports.map((report) => (
        <article key={report._id} className="grid gap-2 rounded-xl border p-3">
          <p className="text-sm">نوع: {report.category} · شناسه نسخه: {report.versionId}</p>
          <p className="text-sm">{report.description}</p>
          <label className="grid gap-1 text-xs">یادداشت رسیدگی
            <textarea className={field} minLength={10} maxLength={1000} rows={2}
              value={notes[report._id] ?? ""}
              onChange={(e) => setNotes((old) => ({ ...old, [report._id]: e.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy === report._id || (notes[report._id] ?? "").trim().length < 10}
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => void resolve(report._id, "resolved")}>رسیدگی شد</button>
            <button type="button" disabled={busy === report._id || (notes[report._id] ?? "").trim().length < 10}
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => void resolve(report._id, "dismissed")}>رد گزارش با دلیل</button>
          </div>
        </article>
      ))}
    </section>
  );
}
