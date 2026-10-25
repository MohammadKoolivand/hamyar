"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { ClipboardCheck, FileText, ShieldCheck, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { ExamMetadata } from "@/lib/exam-import";
import type { Node } from "@/lib/types";

type FormState = Omit<ExamMetadata, "year"> & { year: string };
type Draft = {
  _id: string; number: number | null; page: number; statement: string;
  confidence: "medium" | "low"; state: string;
};
type Detail = {
  exam: ExamMetadata & { _id: string; warning: string; answerPreview?: string; questionFile: string };
  questions: Draft[];
};
type ExamListItem = { _id: string; title: string; createdAt: string };
const initial: FormState = {
  title: "", kind: "final", year: "", session: "", grade: "12",
  track: "experimental", subject: "", sourceUrl: "",
};
const maxFile = 10 * 1024 * 1024;
const field = "glass-field min-h-11 w-full min-w-0 p-3";

export function ExamImportScreen({ nodes }: { nodes: Node[] }) {
  const [form, setForm] = useState<FormState>(initial);
  const [questionsPdf, setQuestionsPdf] = useState<File | null>(null);
  const [answersPdf, setAnswersPdf] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(() => crypto.randomUUID());
  const [detail, setDetail] = useState<Detail | null>(null);
  const [recent, setRecent] = useState<ExamListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function open(id: string) {
    setDetail(await api<Detail>("/exams/" + encodeURIComponent(id)));
  }
  async function list() {
    setRecent(await api<ExamListItem[]>("/exams"));
  }
  useEffect(() => {
    void list().catch((e) => setError((e as Error).message));
  }, []);

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setUploadKey(crypto.randomUUID());
  }
  async function selectFile(e: ChangeEvent<HTMLInputElement>, which: "questions" | "answers") {
    const file = e.target.files?.[0] ?? null;
    setError("");
    setUploadKey(crypto.randomUUID());
    if (file && (!file.name.toLowerCase().endsWith(".pdf") ||
      file.size === 0 || file.size > maxFile ||
      (file.type !== "" && !["application/pdf", "application/octet-stream"].includes(file.type)))) {
      setError("فقط PDF با حجم حداکثر ۱۰ مگابایت مجاز است.");
      e.target.value = "";
      return;
    }
    if (file && (await file.slice(0, 5).text()) !== "%PDF-") {
      setError("امضای PDF معتبر نیست.");
      e.target.value = "";
      return;
    }
    if (which === "questions") setQuestionsPdf(file);
    else setAnswersPdf(file);
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!questionsPdf || busy) return;
    setBusy(true); setError(""); setNotice(""); setDetail(null);
    try {
      const metadata = {
        ...form, ...(form.year ? { year: form.year } : { year: undefined }),
      };
      const data = new FormData();
      data.set("metadata", JSON.stringify(metadata));
      data.set("questions", questionsPdf);
      if (answersPdf) data.set("answers", answersPdf);
      const res = await fetch("/api/exams/upload", {
        method: "POST", credentials: "same-origin",
        headers: { "idempotency-key": uploadKey },
        body: data,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "آپلود انجام نشد");
      await open(body.examId);
      await list();
      setNotice(`${body.count} پیش‌نویس استخراج شد. هر سؤال باید پیش از ورود به بانک بررسی شود.`);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return <section className="mx-auto grid w-full max-w-5xl gap-5">
    <div className="glass-panel grid gap-3 p-5 sm:p-7">
      <span className="flex items-center gap-2 text-xs font-semibold text-[#233B8F]"><UploadCloud size={18}/> ورود PDF آزمون</span>
      <h2 className="text-xl font-bold">استخراج سؤال از دفترچه آزمون</h2>
      <p className="text-sm leading-8 text-slate-600">
        PDF متن‌دار را آپلود کنید. سرور متن را استخراج می‌کند و سؤال‌ها را برای بازبینی شما به‌صورت خصوصی نگه می‌دارد.
        نسخه اسکن‌شده به OCR نیاز دارد؛ شکل‌ها، فرمول‌ها و جواب‌ها خودکار تأیید نمی‌شوند.
      </p>
    </div>
    <form onSubmit={(e) => void upload(e)} className="glass-panel grid gap-5 p-5 sm:p-7">
      <h3 className="font-bold">۱. مشخصات آزمون</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field title="نوع آزمون"><select className={field} value={form.kind} onChange={(e) => change("kind", e.target.value as FormState["kind"])}>
          <option value="final">امتحان نهایی</option><option value="konkur">کنکور</option>
          <option value="school">امتحان مدرسه‌ای</option><option value="coordinated">هماهنگ</option>
          <option value="mock">آزمایشی</option>
        </select></Field>
        <Field title="عنوان آزمون"><input required maxLength={150} className={field} value={form.title} onChange={(e) => change("title", e.target.value)} placeholder="فیزیک دوازدهم خرداد ۱۴۰۴"/></Field>
        <Field title="سال آزمون (شمسی)"><input type="number" min={1300} max={1499} className={field} value={form.year} onChange={(e) => change("year", e.target.value)} placeholder="1404"/></Field>
        <Field title="نوبت"><input maxLength={100} className={field} value={form.session} onChange={(e) => change("session", e.target.value)} placeholder="خرداد"/></Field>
        <Field title="پایه"><select className={field} value={form.grade} onChange={(e) => change("grade", e.target.value as FormState["grade"])}>
          {["7","8","9","10","11","12"].map(g => <option key={g} value={g}>پایه {g}</option>)}
        </select></Field>
        <Field title="رشته"><select className={field} value={form.track} onChange={(e) => change("track", e.target.value as FormState["track"])}>
          <option value="experimental">تجربی</option><option value="mathematics">ریاضی</option>
          <option value="humanities">انسانی</option><option value="islamic">معارف</option>
          <option value="common">مشترک</option><option value="other">سایر</option>
        </select></Field>
        <Field title="درس"><input required maxLength={100} className={field} value={form.subject} onChange={(e) => change("subject", e.target.value)} placeholder="فیزیک"/></Field>
        <Field title="لینک منبع (اختیاری)"><input type="url" dir="ltr" maxLength={1500} className={field} value={form.sourceUrl} onChange={(e) => change("sourceUrl", e.target.value)} placeholder="https://..."/></Field>
      </div>
      <h3 className="font-bold">۲. فایل‌های PDF</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm">
          <span className="flex items-center gap-2 font-medium"><FileText size={17}/> دفترچه سؤال‌ها (الزامی)</span>
          <input aria-label="فایل سؤال‌ها" type="file" accept=".pdf,application/pdf" onChange={(e) => void selectFile(e,"questions")}/>
          <span className="break-all text-xs text-slate-500">{questionsPdf?.name ?? "حداکثر ۱۰ مگابایت"}</span>
        </label>
        <label className="grid gap-2 rounded-xl border border-dashed p-4 text-sm">
          <span className="flex items-center gap-2 font-medium"><FileText size={17}/> پاسخ‌نامه (اختیاری)</span>
          <input aria-label="فایل پاسخ‌نامه" type="file" accept=".pdf,application/pdf" onChange={(e) => void selectFile(e,"answers")}/>
          <span className="break-all text-xs text-slate-500">{answersPdf?.name ?? "حداکثر ۱۰ مگابایت"}</span>
        </label>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm">{notice}</p>}
      <Button disabled={!questionsPdf || !form.title.trim() || !form.subject.trim() || busy}>
        {busy ? "در حال بارگذاری و استخراج…" : "آپلود و استخراج سؤال‌ها"}
      </Button>
      <p className="flex items-center gap-2 text-xs leading-7 text-slate-500"><ShieldCheck size={16}/>
        اصل PDF فقط هنگام پردازش به سرور ارسال می‌شود؛ متن استخراج‌شده و مشخصات آزمون ذخیره می‌شوند.
      </p>
    </form>
    {!!recent.length && <section className="glass-panel grid gap-3 p-5 sm:p-7">
      <h3 className="font-bold">آزمون‌های واردشده من</h3>
      <div className="grid gap-2">
        {recent.map((exam) => <button key={exam._id} type="button" onClick={() => void open(exam._id).catch(e=>setError(e.message))}
          className="rounded-xl border border-slate-200 p-3 text-right text-sm hover:bg-slate-50">{exam.title}</button>)}
      </div>
    </section>}
    {detail && <section className="glass-panel grid gap-4 p-5 sm:p-7">
      <h3 className="flex items-center gap-2 font-bold"><ClipboardCheck size={20}/> ۳. بازبینی سؤال‌ها — {detail.exam.title}</h3>
      <p className="text-sm leading-7 text-amber-900">{detail.exam.warning}</p>
      {detail.exam.answerPreview && <details className="rounded-xl border p-4">
        <summary className="cursor-pointer text-sm font-bold">متن استخراج‌شده پاسخ‌نامه (صرفاً برای مقایسه)</summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm" dir="auto">{detail.exam.answerPreview}</pre>
      </details>}
      {detail.questions.map((draft) => <DraftReview key={draft._id} draft={draft} nodes={nodes} onChanged={async () => {
        await open(detail.exam._id);
      }}/>)}
    </section>}
  </section>;
}

function DraftReview({ draft, nodes, onChanged }: { draft: Draft; nodes: Node[]; onChanged: () => Promise<void> }) {
  const [statement,setStatement] = useState(draft.statement);
  const [reference,setReference] = useState("");
  const [type,setType] = useState<"short"|"essay"|"numeric"|"choice">("short");
  const [options,setOptions] = useState("");
  const [topic,setTopic] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  if (draft.state !== "pending_review") return <p className="rounded-xl bg-slate-50 p-3 text-sm">
    سؤال {draft.number ?? "بدون شماره"} — {draft.state === "approved" ? "تأییدشده" : "ردشده"}
  </p>;
  async function approve(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api("/exam-questions/"+draft._id+"/approve", {
        confirmed: true,
        question: {
          ...(topic ? {topicId: topic} : {classification:"free"}),
          statement,reference,type,options: type==="choice" ? options.split("\n").map(v=>v.trim()).filter(Boolean) : [],
          hints:[],skillIds:[],tolerance:0,
        },
      });
      await onChanged();
    } catch(e) { setError((e as Error).message); }
    finally {setBusy(false);}
  }
  async function reject() {
    setBusy(true);setError("");
    try {await api("/exam-questions/"+draft._id+"/reject",{reason:"توسط معلم رد شد"}); await onChanged();}
    catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  return <form onSubmit={(e)=>void approve(e)} className="grid gap-3 rounded-xl border border-slate-200 p-4">
    <p className="text-xs text-slate-600">
      سؤال {draft.number ?? "نامشخص"} · صفحه {draft.page} · {draft.confidence==="low"?"نیازمند جداسازی دستی":"مرزبندی پیشنهادی؛ بررسی الزامی"}
    </p>
    <Field title="صورت سؤال (قابل اصلاح)"><textarea required minLength={3} maxLength={5000} rows={5} className={field} value={statement} onChange={e=>setStatement(e.target.value)}/></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field title="روش پاسخ"><select className={field} value={type} onChange={e=>setType(e.target.value as typeof type)}>
        <option value="short">کوتاه</option><option value="essay">تشریحی</option>
        <option value="numeric">عددی</option><option value="choice">چندگزینه‌ای</option>
      </select></Field>
      <Field title="مبحث (اختیاری)"><select className={field} value={topic} onChange={e=>setTopic(e.target.value)}>
        <option value="">بدون مبحث / سؤال آزاد</option>
        {nodes.filter(n=>n.kind==="topic").map(n=><option key={n._id} value={n._id}>{n.title}</option>)}
      </select></Field>
    </div>
    {type==="choice" && <Field title="گزینه‌ها (هر گزینه یک خط)">
      <textarea required rows={4} className={field} value={options} onChange={e=>setOptions(e.target.value)}/>
    </Field>}
    <Field title="پاسخ مرجع — باید توسط معلم تأیید شود">
      <input required maxLength={2000} className={field} value={reference} onChange={e=>setReference(e.target.value)}
        placeholder={type==="choice"?"متن دقیق یکی از گزینه‌ها":"پاسخ صحیح"}/>
    </Field>
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <Button disabled={busy || !reference.trim()}>تأیید و افزودن به بانک سؤال</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={()=>void reject()}>رد سؤال</Button>
    </div>
  </form>;
}
