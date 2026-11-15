"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Download } from "lucide-react";
import { PagedList } from "@/components/ui/paged-list";
import {
  matchesPdfTaxonomy, formatPdfTaxonomy, type PdfLibraryItem, type PdfTaxonomy,
} from "@/lib/pdf-library";

export function PdfLibraryPublic({ taxonomy }: { taxonomy: Partial<PdfTaxonomy> }) {
  const [rows, setRows] = useState<PdfLibraryItem[]>([]);
  const [local, setLocal] = useState<Partial<PdfTaxonomy>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/pdf-library/public", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("فهرست PDFها دریافت نشد");
        return r.json() as Promise<PdfLibraryItem[]>;
      })
      .then((data) => { if (alive) setRows(data); })
      .catch((e) => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const selected = useMemo(() => ({ ...taxonomy, ...local }), [taxonomy, local]);
  const visible = useMemo(
    () => rows.filter((row) => matchesPdfTaxonomy(row, selected)),
    [rows, selected],
  );
  const fields: { key: keyof PdfTaxonomy; title: string }[] = [
    { key: "level", title: "مقطع" }, { key: "grade", title: "پایه" },
    { key: "book", title: "درس" }, { key: "chapter", title: "فصل" },
    { key: "topic", title: "مبحث" },
  ];
  return (
    <section className="grid gap-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-[#17305E]">آزمون‌ها و نمونه‌سؤال‌های PDF</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            فایل کامل معلم، بدون تبدیل یا استخراج سؤال‌ها؛ مطابق پایه، درس، فصل و مبحث انتخاب‌شده.
          </p>
        </div>
        <span className="text-sm text-slate-500">{visible.length.toLocaleString("fa-IR")} فایل PDF</span>
      </div>
      <div className="grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-5">
        {fields.map(({ key, title }) => <label key={key} className="grid gap-1 text-xs text-slate-600">{title}
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white p-2 text-sm"
            value={local[key] ?? ""}
            onChange={(event) => setLocal((current) => {
              const next = { ...current, [key]: event.target.value };
              const index = fields.findIndex((field) => field.key === key);
              for (const field of fields.slice(index + 1)) delete next[field.key];
              return next;
            })}>
            <option value="">همه</option>
            {[...new Set(rows.map((row) => row.taxonomy[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fa"))
              .map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>)}
      </div>
      {loading && <p role="status">در حال بارگذاری PDFها…</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!loading && !error && !visible.length && <p className="text-sm text-slate-500">PDF متناسب با این فیلترها پیدا نشد.</p>}
      <PagedList items={visible} label="فایل‌های PDF">
        {(item) => <article key={item._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex min-w-0 items-start gap-3">
            <FileText size={24} className="shrink-0 text-teal-700" />
            <div className="min-w-0">
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{formatPdfTaxonomy(item)}</p>
              {item.description && <p className="mt-2 text-sm text-slate-600">{item.description}</p>}
            </div>
          </div>
          <a className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-teal-200 px-4 text-sm font-medium text-teal-800"
            href={`/api/pdf-library/${item._id}/file`} target="_blank" rel="noopener noreferrer">
            <Download size={16} /> مشاهده / دریافت PDF
          </a>
        </article>}
      </PagedList>
    </section>
  );
}
