"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cropFromDrag, percentPointFromPointer, selectableMathCrop, type PercentPoint } from "@/lib/math-ocr-crop";
import Image from "next/image";
import { MathFormula } from "@/components/question-presentation";
import { api } from "@/lib/api";

type Crop = { x: number; y: number; width: number; height: number };
const initialCrop: Crop = { x: 15, y: 20, width: 65, height: 20 };
const cropFields: { key: keyof Crop; label: string }[] = [
  { key: "x", label: "از راست/چپ صفحه (%)" },
  { key: "y", label: "از بالای صفحه (%)" },
  { key: "width", label: "عرض ناحیه (%)" },
  { key: "height", label: "ارتفاع ناحیه (%)" },
];
export function MathOcrReview({
  examId, itemId, pages, onInsert,
}: {
  examId: string;
  itemId: string;
  pages: number[];
  onInsert: (latex: string) => void;
}) {
  const [page, setPage] = useState(pages[0] ?? 1);
  const [crop, setCrop] = useState<Crop>(initialCrop);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [latex, setLatex] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const dragStart = useRef<PercentPoint | null>(null);
  const [drag, setDrag] = useState<{ start: PercentPoint; end: PercentPoint } | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ enabled: boolean }>(`/exam-imports/${examId}/math-ocr/status`)
      .then((result) => { if (alive) setEnabled(result.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, [examId]);
  function onCropDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) return;
    event.preventDefault();
    const start = percentPointFromPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    dragStart.current = start;
    setDrag({ start, end: start });
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onCropMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current || !event.isPrimary) return;
    const end = percentPointFromPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    setDrag({ start: dragStart.current, end });
  }
  function onCropEnd(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start) return;
    const end = percentPointFromPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const chosen = cropFromDrag(start, end);
    if (selectableMathCrop(chosen)) {
      setCrop(chosen);
      setLatex("");
      setReviewed(false);
      setError("");
    } else {
      setError("محدوده انتخابی مناسب نیست؛ فقط خود فرمول را انتخاب کن (حداقل ۳٪ عرض و ۲٪ ارتفاع).");
    }
    dragStart.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function onCropCancel() {
    dragStart.current = null;
    setDrag(null);
  }
  async function recognize() {
    setPending(true);
    setError("");
    setLatex("");
    setReviewed(false);
    try {
      const result = await api<{ latex: string; requiresHumanReview: true }>(
        `/exam-imports/${examId}/items/${itemId}/math-ocr`, { page, crop },
      );
      setLatex(result.latex);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تشخیص فرمول انجام نشد");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
      <summary className="cursor-pointer text-sm font-bold text-blue-900">
        تشخیص تخصصی فرمول از تصویر (Math OCR → LaTeX)
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-xs leading-6 text-slate-700">
          روی تصویر مستقیماً از یک گوشه فرمول تا گوشه مقابل بکش، یا درصدهای زیر را دستی تنظیم کن؛ کل سؤال را انتخاب نکن.
          خروجی مدل پیشنهادی است و پس از تطبیق با PDF می‌توان آن را به متن افزود.
        </p>
        <p role="status" className="text-xs text-slate-700">
          {enabled === null ? "در حال بررسی وضعیت مدل…" : enabled
            ? "مدل pix2tex روی سرور فعال است؛ خروجی نیازمند بازبینی است."
            : "مدل pix2tex هنوز روی سرور نصب/فعال نشده است؛ ویرایش دستی LaTeX در دسترس است."}
        </p>
        <label className="grid gap-1 text-sm">صفحه سؤال
          <select className="glass-field min-h-10 p-2" value={page}
            onChange={(event) => { setPage(Number(event.target.value)); setLatex(""); setReviewed(false); }}>
            {pages.map((value) => <option key={value} value={value}>صفحه {value.toLocaleString("fa-IR")}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {cropFields.map(({ key, label }) =>
            <label className="grid gap-1 text-xs" key={key}>{label}
              <input type="number" min="0" max="100" step="1" className="glass-field min-h-10 p-2"
                value={crop[key]} onChange={(event) => {
                  setCrop((old) => ({ ...old, [key]: Number(event.target.value) }));
                  setLatex(""); setReviewed(false);
                }} />
            </label>)}
        </div>
        <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-lg border bg-white">
          <Image unoptimized width={800} height={1120} alt="اصل صفحه آزمون برای تعیین محدوده فرمول" className="block h-auto w-full"
            src={`/api/exam-imports/${examId}/pages/question/${page}`} />
          <div aria-label="محدوده انتخاب شده برای تشخیص فرمول" className="pointer-events-none absolute border-2 border-red-500 bg-red-500/10"
            style={{ left: `${drag ? cropFromDrag(drag.start, drag.end).x : crop.x}%`,
              top: `${drag ? cropFromDrag(drag.start, drag.end).y : crop.y}%`,
              width: `${drag ? cropFromDrag(drag.start, drag.end).width : crop.width}%`,
              height: `${drag ? cropFromDrag(drag.start, drag.end).height : crop.height}%` }} />
          <div role="application" aria-label="با ماوس یا لمس، محدوده فرمول را روی تصویر انتخاب کنید"
            className="absolute inset-0 cursor-crosshair touch-none"
            onPointerDown={onCropDown}
            onPointerMove={onCropMove}
            onPointerUp={onCropEnd}
            onPointerCancel={onCropCancel}
          />
        </div>
        <button type="button" className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm text-white disabled:opacity-50"
          disabled={!enabled || pending || pages.length === 0 || !selectableMathCrop(crop)}
          onClick={() => void recognize()}>
          {pending ? "در حال تشخیص…" : "پیشنهاد LaTeX از ناحیه انتخابی"}
        </button>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        <button type="button" className="w-fit rounded-lg border border-slate-400 px-3 py-2 text-xs text-slate-800"
          onClick={() => { setManualOpen((old) => !old); setReviewed(false); }}>
          {manualOpen ? "بستن ویرایش دستی" : "نوشتن/اصلاح LaTeX به‌صورت دستی"}
        </button>
        {(latex || manualOpen) && <>
          <p className="text-xs font-bold text-amber-900">پیش‌نویس ماشینی؛ صحت علمی و تطبیق با تصویر تأیید نشده است.</p>
          <textarea dir="ltr" aria-label="ویرایش LaTeX پیشنهادی" className="glass-field min-h-20 w-full p-2 font-mono text-sm"
            value={latex} onChange={(event) => { setLatex(event.target.value); setReviewed(false); }} />
          {latex.trim() && <div className="overflow-x-auto rounded-lg bg-white p-2"><MathFormula latex={latex} inline /></div>}
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
            فرمول را با تصویر اصلی مقایسه و در صورت لزوم اصلاح کرده‌ام.
          </label>
          <button type="button" disabled={!reviewed || !latex.trim()}
            className="min-h-10 rounded-lg border border-blue-700 px-3 text-sm text-blue-900 disabled:opacity-50"
            onClick={() => { onInsert(latex.trim()); setReviewed(false); }}>
            افزودن LaTeX به انتهای متن سؤال (قابل ویرایش)
          </button>
        </>}
      </div>
    </details>
  );
}
