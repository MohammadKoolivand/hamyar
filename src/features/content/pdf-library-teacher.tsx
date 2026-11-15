"use client";
import { useEffect, useMemo, useState } from "react";
import { FileText, UploadCloud, ArrowLeft, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Node } from "@/lib/types";
import {
  formatPdfTaxonomy, type PdfLibraryItem, type PdfTaxonomy,
} from "@/lib/pdf-library";

const input = "w-full min-h-11 rounded-xl border border-slate-200 bg-white p-3 text-sm";
const empty: PdfTaxonomy = { level: "", grade: "", book: "", chapter: "", topic: "" };
const keyForKind = (kind: string): keyof PdfTaxonomy | null => {
  if (kind === "level") return "level";
  if (kind === "grade") return "grade";
  if (kind === "course" || kind === "subject") return "book";
  if (kind === "chapter") return "chapter";
  if (kind === "topic") return "topic";
  return null;
};

export function PdfLibraryTeacher({ nodes, currentUserId, superAdmin = false }: { nodes: Node[]; currentUserId?: string; superAdmin?: boolean }) {
  const [items, setItems] = useState<PdfLibraryItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [selectedNode, setSelectedNode] = useState("");
  const [manual, setManual] = useState<PdfTaxonomy>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "saving" | "complete" | "failed">("idle");

  const byId = useMemo(() => new Map(nodes.map((n) => [n._id, n])), [nodes]);
  function ancestorLabel(n: Node) {
    const path = [n.title];
    const seen = new Set<string>([n._id]);
    let parent = n.parentId;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const found = byId.get(parent);
      if (!found) break;
      if (keyForKind(found.kind)) path.unshift(found.title);
      parent = found.parentId;
    }
    return path.join(" / ");
  }
  const choices = nodes.filter((n) =>
    ["topic", "chapter", "course", "subject", "grade"].includes(n.kind));
  const derived = useMemo(() => {
    const taxonomy = { ...manual };
    if (!selectedNode) return taxonomy;
    const seen = new Set<string>();
    let node = byId.get(selectedNode);
    while (node && !seen.has(node._id)) {
      seen.add(node._id);
      const key = keyForKind(node.kind);
      if (key) taxonomy[key] = node.title;
      node = node.parentId ? byId.get(node.parentId) : undefined;
    }
    return taxonomy;
  }, [selectedNode, byId, manual]);

  async function refresh() {
    setItems(await api<PdfLibraryItem[]>("/pdf-library"));
  }
  useEffect(() => { void refresh().catch(() => setError("فهرست فایل‌های PDF دریافت نشد.")); }, []);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    setUploadProgress(null);
    setUploadPhase("idle");
    try { await work(); }
    catch (e) {
      setError((e as Error).message || "انجام عملیات ممکن نشد");
      setUploadPhase("failed");
    }
    finally { setBusy(false); }
  }

  function uploadTo(pdfId: string, upload: File): Promise<void> {
    // fetch() does not expose upload byte progress to the browser.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/pdf-library/${encodeURIComponent(pdfId)}/file`);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", "application/pdf");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(upload.name));
      setUploadProgress(0);
      setUploadPhase("uploading");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      };
      xhr.upload.onload = () => {
        setUploadProgress(100);
        setUploadPhase("saving");
      };
      xhr.onerror = () => reject(new Error("اتصال هنگام بارگذاری PDF قطع شد."));
      xhr.onabort = () => reject(new Error("بارگذاری PDF لغو شد."));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
          setUploadPhase("complete");
          resolve();
          return;
        }
        let message = "ثبت فایل PDF روی سرور موفق نبود.";
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string };
          if (body.message) message = body.message;
        } catch { /* Keep the generic server error. */ }
        reject(new Error(message));
      };
      xhr.send(upload);
    });
  }

  function validate(pdf: File) {
    if (!/\.pdf$/i.test(pdf.name) || pdf.size === 0 || pdf.size > 20 * 1024 * 1024)
      throw new Error("PDF معتبر تا ۲۰ مگابایت انتخاب کنید.");
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" dir="rtl">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#17305E]">
          <FileText size={22} /> بانک فایل‌های PDF
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          فایل کامل سؤال را بدون استخراج یا تبدیل نگه دارید و بر اساس پایه، درس، فصل یا مبحث دسته‌بندی کنید.
          هر وقت خواستید، یک نسخه را جداگانه برای استخراج سؤال به «ورود آزمون» بفرستید.
        </p>
      </div>
      <form className="grid gap-3 rounded-xl border border-slate-100 p-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return setError("فایل PDF انتخاب کنید");
        void run(async () => {
          validate(file);
          if ((await file.slice(0, 5).text()) !== "%PDF-")
            throw new Error("فایل انتخاب‌شده PDF معتبر نیست.");
          const row = await api<PdfLibraryItem>("/pdf-library", {
            title: title.trim(), description: description.trim(), visibility,
            taxonomy: derived,
            ...(selectedNode ? { topicId: selectedNode } : {}),
          });
          await uploadTo(row._id, file);
          await refresh();
          setFile(null);
          setTitle("");
          setDescription("");
          setSelectedNode("");
          setManual(empty);
          const control = document.getElementById("pdf-library-upload") as HTMLInputElement | null;
          if (control) control.value = "";
          setNotice("فایل PDF به بانک اضافه شد. برای ورود به آزمون تبدیل خودکار شروع نشده است.");
        });
      }}>
        <h3 className="font-medium">افزودن PDF جدید</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">عنوان PDF
            <input required minLength={3} maxLength={150} className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً آزمون فصل سوم زیست" />
          </label>
          <label className="grid gap-1 text-sm">محل قرارگیری در محتوای آموزشی
            <select className={input} value={selectedNode} onChange={(e) => setSelectedNode(e.target.value)}>
              <option value="">انتخاب کنید یا دسته‌بندی دستی بنویسید</option>
              {choices.map((n) => <option key={n._id} value={n._id}>{ancestorLabel(n)}</option>)}
            </select>
          </label>
        </div>
        {!selectedNode && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["grade", "پایه"], ["book", "درس / کتاب"], ["chapter", "فصل"], ["topic", "مبحث"],
          ] as [keyof PdfTaxonomy, string][]).map(([key, label]) =>
            <label key={key} className="grid gap-1 text-sm">{label}
              <input className={input} maxLength={150} value={manual[key]} onChange={(e) =>
                setManual((old) => ({ ...old, [key]: e.target.value }))} />
            </label>
          )}
        </div>}
        {selectedNode && <p className="text-xs text-teal-800">دسته‌بندی: {[derived.level, derived.grade, derived.book, derived.chapter, derived.topic].filter(Boolean).join(" · ")}</p>}
        <label className="grid gap-1 text-sm">توضیح کوتاه (اختیاری)
          <input className={input} maxLength={700} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">دسترسی PDF
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")} className={input}>
              <option value="public">عمومی — قابل مشاهده در بانک PDF</option>
              <option value="private">خصوصی — فقط برای خودم</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">فایل PDF
            <input id="pdf-library-upload" className={input} type="file" accept="application/pdf,.pdf" required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <button type="submit" disabled={busy || !file || !title.trim() || !derived.book}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white disabled:opacity-50">
          <UploadCloud size={18} /> {busy ? uploadPhase === "uploading" ? `در حال بارگذاری: ${uploadProgress ?? 0}٪` : uploadPhase === "saving" ? "در حال ثبت نهایی فایل…" : "در حال آماده‌سازی…" : "ذخیره PDF کامل در بانک"}
        </button>
        {uploadProgress !== null && (
          <div className="grid gap-2" role="group" aria-label="پیشرفت بارگذاری فایل PDF">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span role="status" aria-live="polite">{uploadPhase === "complete" ? "فایل با موفقیت روی سرور ثبت شد" : uploadPhase === "saving" ? "انتقال کامل شد؛ در حال تأیید ذخیره‌سازی…" : uploadPhase === "failed" ? "بارگذاری یا ثبت فایل ناموفق بود" : "در حال انتقال فایل PDF"}</span>
              <span className="tabular-nums" dir="ltr">{uploadProgress}٪</span>
            </div>
            <progress className="h-3 w-full accent-teal-700" max={100} value={uploadProgress} aria-label="درصد آپلود PDF" />
          </div>
        )}
      </form>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{notice}</p>}
      <h3 className="font-bold">{superAdmin ? "همهٔ PDFهای معلمان" : "PDFهای ثبت‌شدهٔ من"}</h3>
      {!items.length && <p className="text-sm text-slate-500">هنوز PDF مستقلی ثبت نشده است.</p>}
      {items.map((item) => <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
        <div className="min-w-0">
          <div className="font-medium">{item.title}</div>
          {superAdmin && <p className="text-xs text-teal-700">ثبت‌کننده: {item.ownerName ?? "نامشخص"}</p>}
          <p className="text-xs text-slate-500">{formatPdfTaxonomy(item)} · {item.visibility === "public" ? "عمومی" : "خصوصی"}</p>
          {item.state === "pending" && <p className="text-xs text-amber-800">بارگذاری فایل کامل نشده است</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {item.state === "ready" && <>
            <a className="rounded-lg border px-3 py-2 text-xs" href={`/api/pdf-library/${item._id}/file`} target="_blank" rel="noopener noreferrer">مشاهده PDF</a>
            <button type="button" disabled={busy} onClick={() => void run(async () => {
              const { examId } = await api<{ examId: string }>(`/pdf-library/${item._id}/send-to-import`, {});
              window.location.assign(`/exam-import?exam=${encodeURIComponent(examId)}`);
            })} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-2 text-xs text-teal-800">
              {superAdmin && item.ownerId !== currentUserId ? "ساخت کپی برای ورود آزمون مدیریت" : "ارسال کپی به ورود آزمون"} <ArrowLeft size={14} />
            </button>
          </>}
          {(!currentUserId || item.ownerId === currentUserId) && <button type="button" disabled={busy} onClick={() => {
            if (!window.confirm("فایل PDF از این بانک حذف شود؟ نسخه‌های قبلاً ارسال‌شده به ورود آزمون باقی می‌مانند.")) return;
            void run(async () => {
              const response = await fetch(`/api/pdf-library/${item._id}`, { method: "DELETE" });
              if (!response.ok) throw new Error("حذف PDF انجام نشد");
              await refresh();
            });
          }} className="rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700" aria-label="حذف فایل PDF">
            <Trash2 size={16} />
          </button>}
        </div>
      </article>)}
    </section>
  );
}
