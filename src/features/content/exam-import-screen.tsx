"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { ClipboardCheck, FileText, ShieldCheck, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

type ExamKind = "konkur" | "final" | "school" | "coordinated" | "mock";
type ExamForm = {
  title: string;
  kind: ExamKind;
  year: string;
  session: string;
  grade: string;
  track: string;
  subject: string;
  sourceUrl: string;
};
type Preview = ExamForm & {
  questionPdf: string;
  answerPdf: string | null;
};

const initialForm: ExamForm = {
  title: "",
  kind: "final",
  year: "",
  session: "",
  grade: "12",
  track: "experimental",
  subject: "",
  sourceUrl: "",
};
const fieldStyle = "glass-field min-h-11 w-full min-w-0 p-3";
const maxPdfBytes = 20 * 1024 * 1024;

export function ExamImportScreen() {
  const [form, setForm] = useState<ExamForm>(initialForm);
  const [questionPdf, setQuestionPdf] = useState<File | null>(null);
  const [answerPdf, setAnswerPdf] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  function change<K extends keyof ExamForm>(key: K, value: ExamForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setPreview(null);
  }

  async function pickPdf(event: ChangeEvent<HTMLInputElement>, type: "question" | "answer") {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setPreview(null);
    if (!file) {
      if (type === "question") setQuestionPdf(null);
      else setAnswerPdf(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") || file.size > maxPdfBytes || file.size === 0) {
      setError("فقط PDF غیرخالی با حجم حداکثر ۲۰ مگابایت پذیرفته می‌شود.");
      event.target.value = "";
      if (type === "question") setQuestionPdf(null);
      else setAnswerPdf(null);
      return;
    }
    try {
      if ((await file.slice(0, 5).text()) !== "%PDF-") {
        throw new Error("امضای فایل معتبر نیست.");
      }
      if (type === "question") setQuestionPdf(file);
      else setAnswerPdf(file);
    } catch {
      setError("این فایل PDF معتبر تشخیص داده نشد.");
      event.target.value = "";
      if (type === "question") setQuestionPdf(null);
      else setAnswerPdf(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!questionPdf) {
      setError("برای آماده‌سازی آزمون، ابتدا فایل سؤال‌ها را انتخاب کنید.");
      return;
    }
    if (form.year && (!/^1[34]\d{2}$/.test(form.year) || Number(form.year) > 1500)) {
      setError("سال آزمون باید چهاررقمی و در بازه ۱۳۰۰ تا ۱۵۰۰ باشد.");
      return;
    }
    setPreview({
      ...form,
      title: form.title.trim(),
      subject: form.subject.trim(),
      sourceUrl: form.sourceUrl.trim(),
      questionPdf: questionPdf.name,
      answerPdf: answerPdf?.name ?? null,
    });
  }

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-5">
      <div className="glass-panel grid gap-3 p-5 sm:p-7">
        <span className="flex items-center gap-2 text-xs font-semibold text-[#233B8F]">
          <UploadCloud size={18} /> آماده‌سازی ورود هوشمند آزمون
        </span>
        <h2 className="text-xl font-bold text-[#17305E]">آزمون را برای ورود به بانک سؤال آماده کنید</h2>
        <p className="text-sm leading-8 text-slate-600">
          مشخصات کنکور یا امتحان نهایی را وارد کنید و PDF سؤال‌ها و در صورت وجود، پاسخ‌نامه را انتخاب کنید.
          در این مرحله پیش‌نمایش محلی ساخته می‌شود؛ هنوز فایل‌ها به سرور ارسال نمی‌شوند و استخراج سؤال فعال نیست.
        </p>
      </div>
      <form onSubmit={submit} className="glass-panel grid min-w-0 gap-5 p-5 sm:p-7">
        <h3 className="text-base font-bold">۱. مشخصات آزمون</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field title="نوع آزمون">
            <select className={fieldStyle} value={form.kind} onChange={(e) => change("kind", e.target.value as ExamKind)}>
              <option value="final">امتحان نهایی</option>
              <option value="konkur">کنکور سراسری</option>
              <option value="school">امتحان مدرسه‌ای</option>
              <option value="coordinated">امتحان هماهنگ</option>
              <option value="mock">آزمون آزمایشی</option>
            </select>
          </Field>
          <Field title="عنوان آزمون">
            <input required maxLength={150} className={fieldStyle} value={form.title} onChange={(e) => change("title", e.target.value)} placeholder="مثلاً فیزیک دوازدهم، خرداد ۱۴۰۴" />
          </Field>
          <Field title="سال آزمون (شمسی)">
            <input type="number" min={1300} max={1500} className={fieldStyle} value={form.year} onChange={(e) => change("year", e.target.value)} placeholder="۱۴۰۴" />
          </Field>
          <Field title="نوبت آزمون">
            <input maxLength={100} className={fieldStyle} value={form.session} onChange={(e) => change("session", e.target.value)} placeholder="خرداد / دی / نوبت اول" />
          </Field>
          <Field title="پایه">
            <select className={fieldStyle} value={form.grade} onChange={(e) => change("grade", e.target.value)}>
              {["7", "8", "9", "10", "11", "12"].map((grade) => <option key={grade} value={grade}>{`پایه ${grade}`}</option>)}
            </select>
          </Field>
          <Field title="رشته">
            <select className={fieldStyle} value={form.track} onChange={(e) => change("track", e.target.value)}>
              <option value="experimental">تجربی</option>
              <option value="mathematics">ریاضی</option>
              <option value="humanities">انسانی</option>
              <option value="islamic">معارف</option>
              <option value="common">مشترک</option>
              <option value="other">سایر</option>
            </select>
          </Field>
          <Field title="درس">
            <input required maxLength={100} className={fieldStyle} value={form.subject} onChange={(e) => change("subject", e.target.value)} placeholder="فیزیک" />
          </Field>
          <Field title="نشانی منبع (اختیاری)">
            <input type="url" maxLength={1500} dir="ltr" className={fieldStyle} value={form.sourceUrl} onChange={(e) => change("sourceUrl", e.target.value)} placeholder="https://..." />
          </Field>
        </div>
        <div className="border-t border-slate-200 pt-5">
          <h3 className="mb-3 text-base font-bold">۲. انتخاب PDF</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid cursor-pointer gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm">
              <span className="flex items-center gap-2 font-semibold"><FileText size={19} /> دفترچه سؤال‌ها (الزامی)</span>
              <input className="min-w-0 text-xs" aria-label="دفترچه سؤال‌ها" type="file" accept=".pdf,application/pdf" onChange={(e) => void pickPdf(e, "question")} />
              <span className="break-all text-xs text-slate-500">{questionPdf ? questionPdf.name : "PDF تا ۲۰ مگابایت"}</span>
            </label>
            <label className="grid cursor-pointer gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm">
              <span className="flex items-center gap-2 font-semibold"><FileText size={19} /> پاسخ‌نامه (اختیاری)</span>
              <input className="min-w-0 text-xs" aria-label="پاسخ‌نامه" type="file" accept=".pdf,application/pdf" onChange={(e) => void pickPdf(e, "answer")} />
              <span className="break-all text-xs text-slate-500">{answerPdf ? answerPdf.name : "PDF تا ۲۰ مگابایت"}</span>
            </label>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <Button disabled={!questionPdf || !form.title.trim() || !form.subject.trim()}>نمایش پیش‌نویس آزمون</Button>
        <p className="flex items-center gap-2 text-xs leading-7 text-slate-500">
          <ShieldCheck size={16} className="shrink-0" />
          فایل‌ها فقط در حافظه همین صفحه نگه داشته می‌شوند؛ ذخیره دائمی، آپلود یا پردازش با AI انجام نمی‌شود.
        </p>
      </form>
      {preview && (
        <section className="glass-panel grid gap-3 p-5 sm:p-7" aria-live="polite">
          <h3 className="flex items-center gap-2 text-base font-bold"><ClipboardCheck size={19} /> ۳. پیش‌نمایش آماده برای مرحله پردازش</h3>
          <p className="font-bold text-[#17305E]">{preview.title}</p>
          <p className="text-sm leading-7 text-slate-600">
            {preview.subject} · پایه {preview.grade} · {preview.year || "سال نامشخص"} · {preview.session || "نوبت نامشخص"}
          </p>
          <p className="break-all text-sm text-slate-600">سؤال‌ها: {preview.questionPdf}</p>
          <p className="break-all text-sm text-slate-600">پاسخ‌نامه: {preview.answerPdf ?? "ندارد"}</p>
          <p className="rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-950">
            پیش‌نویس فقط روی این صفحه است و در بانک سؤال ثبت نشده. مرحله بعد: آپلود امن، استخراج متن و شکل،
            تشخیص هر سؤال، تطبیق با مبحث و تأیید انسانی پیش از انتشار.
          </p>
        </section>
      )}
    </section>
  );
}
