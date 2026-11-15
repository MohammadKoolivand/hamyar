"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, CheckCheck, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";

type PdfDelivery = {
  _id: string;
  batchId: string;
  pdfId: string;
  title: string;
  description?: string;
  state: "assigned" | "completed" | "cancelled";
  dueAt?: string;
  createdAt: string;
};

export function PdfDeliveriesStudent() {
  const [items, setItems] = useState<PdfDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await api<PdfDelivery[]>("/pdf-deliveries");
      setItems(rows);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function finish(item: PdfDelivery) {
    setBusy(item._id);
    setError("");
    setNotice("");
    try {
      await api(`/pdf-deliveries/${item._id}/complete`, {});
      await refresh();
      setNotice("وضعیت «انجام دادم» ثبت شد؛ این ثبت به معنی تصحیح پاسخ‌های PDF نیست.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="glass-panel grid min-w-0 gap-4 p-4 sm:p-5" dir="rtl" aria-label="تکلیف‌های PDF دانش‌آموز">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FileText size={20} aria-hidden /> فایل‌های PDF فرستاده‌شده توسط معلم
        </h2>
        <button type="button" disabled={refreshing} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          onClick={() => void refresh()} aria-label="به‌روزرسانی تکلیف‌های PDF">
          <RotateCcw size={16} aria-hidden />
        </button>
      </div>
      {loading && <p role="status">در حال دریافت تکلیف‌های PDF…</p>}
      {error && <div role="alert" className="grid gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p><button type="button" className="min-h-11 justify-self-start rounded-lg border border-rose-300 px-3" onClick={() => void refresh()}>تلاش مجدد</button></div>}
      {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
      {!loading && !error && !items.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">هنوز PDF اختصاصی دریافت نکرده‌ای. تکلیف‌هایی که معلم برای کلاس یا خودت می‌فرستد، اینجا نمایش داده می‌شوند.</p>}
      {items.map((item) => (
        <article key={item._id} className="grid gap-3 rounded-xl border border-slate-200 p-4">
          <div>
            <h3 className="font-medium">{item.title}</h3>
            {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
            <p className="text-xs text-slate-500">
              {item.dueAt ? `مهلت: ${new Date(item.dueAt).toLocaleString("fa-IR")}` : "بدون مهلت مشخص"}
              {" · "}{item.state === "completed" ? "انجام‌شده (تأیید خود دانش‌آموز)" : "در انتظار انجام"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-300 px-4 text-sm text-teal-800"
              href={`/api/pdf-deliveries/${item._id}/file`}
              target="_blank" rel="noopener noreferrer">
              مشاهده / دریافت PDF
            </a>
            {item.state === "assigned" && (
              <button type="button" disabled={!!busy} onClick={() => void finish(item)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm disabled:opacity-50">
                <CheckCheck size={16} aria-hidden /> انجام دادم
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
