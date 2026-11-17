"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, GitMerge, RefreshCcw, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PagedList } from "@/components/ui/paged-list";
import { QuestionPresentation } from "@/components/question-presentation";

type DuplicateQuestion = {
  questionId: string; versionId: string; ownerId: string;
  statement: string; type: string; options: string[];
  visuals: unknown[]; optionImages: unknown[];
  source?: { sourceTitle?: string; organizer?: string; academicYear?: string | number };
  fingerprint: string;
};
type Group = {
  id: string; kind: "exact" | "similar"; score: number;
  questions: DuplicateQuestion[];
};
type Response = { groups: Group[]; totalGroups: number; totalQuestions: number };

function GroupReview({ group, onResolved }: { group: Group; onResolved: () => void }) {
  const [keeper, setKeeper] = useState(group.questions[0].questionId);
  const [checked, setChecked] = useState<string[]>(group.questions.slice(1).map((q) => q.questionId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const candidates = group.questions.filter((q) => q.questionId !== keeper);
  const selected = checked.filter((id) => candidates.some((q) => q.questionId === id));
  async function resolve(action: "merge" | "delete") {
    if (!selected.length) return;
    const message = action === "merge"
      ? `آیا ${selected.length} سؤال کاملاً یکسان در سؤال اصلی ادغام و آرشیو شوند؟ ارجاعات تاریخی محفوظ می‌مانند.`
      : `آیا ${selected.length} سؤال انتخاب‌شده آرشیو شوند؟ این کار سؤال‌ها را از بانک عمومی خارج می‌کند.`;
    if (!window.confirm(message)) return;
    setBusy(true); setError("");
    try {
      await api("/admin/duplicate-questions/resolve", {
        action,
        ...(action === "merge" ? { survivorId: keeper } : {}),
        duplicateIds: selected,
        expectedVersionIds: Object.fromEntries(group.questions.map((q) => [q.questionId, q.versionId])),
        confirmation: "CONFIRM",
      });
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت تغییرات ممکن نشد");
    } finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" dir="rtl">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{group.kind === "exact" ? "تکراری کاملاً یکسان" : "مشابه؛ نیازمند بررسی"}</strong>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs">{Math.round(group.score * 100).toLocaleString("fa-IR")}٪ شباهت</span>
        <span className="text-xs text-slate-500">{group.questions.length.toLocaleString("fa-IR")} سؤال</span>
      </div>
      <span className="text-xs text-slate-500">{group.kind === "similar" ? "ادغام خودکار موارد مشابه غیرفعال است" : "برای ادغام، یک نسخه اصلی انتخاب کنید"}</span>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {group.questions.map((q) => <article key={q.questionId} className="min-w-0 rounded-xl border border-slate-200 p-3">
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name={group.id} checked={keeper === q.questionId}
              onChange={() => { setKeeper(q.questionId); setChecked(group.questions.filter((v) => v.questionId !== q.questionId).map((v) => v.questionId)); }} />
            نسخه اصلی
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled={keeper === q.questionId}
              checked={keeper !== q.questionId && checked.includes(q.questionId)}
              onChange={(e) => setChecked((old) => e.target.checked ? [...old, q.questionId] : old.filter((id) => id !== q.questionId))} />
            انتخاب برای حذف/ادغام
          </label>
        </div>
        <QuestionPresentation statement={q.statement} options={q.type === "choice" ? q.options : undefined} />
        <p className="mt-3 text-xs text-slate-500">{q.source?.sourceTitle ?? q.source?.organizer ?? "منبع نامشخص"} · {q.source?.academicYear ?? ""}</p>
        <p className="mt-1 break-all font-mono text-[10px] text-slate-400">{q.questionId}</p>
      </article>)}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={busy || !selected.length || group.kind !== "exact"}
        onClick={() => void resolve("merge")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-800 px-4 text-sm text-white disabled:opacity-40">
        <GitMerge size={17} /> ادغام {selected.length.toLocaleString("fa-IR")} سؤال
      </button>
      <button type="button" disabled={busy || !selected.length}
        onClick={() => void resolve("delete")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm text-red-800 disabled:opacity-40">
        <Trash2 size={17} /> آرشیو {selected.length.toLocaleString("fa-IR")} سؤال
      </button>
    </div>
  </section>;
}

export default function DuplicateQuestionManagement() {
  const [data, setData] = useState<Response | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api<Response>("/admin/duplicate-questions")); }
    catch (err) { setError(err instanceof Error ? err.message : "دریافت فهرست ممکن نشد"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const filtered = useMemo(() => (data?.groups ?? []).filter((g) =>
    (kind === "all" || g.kind === kind) &&
    (!query.trim() || g.questions.some((q) => [q.statement, q.source?.sourceTitle, q.source?.organizer].some((t) =>
      String(t ?? "").toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa"))))
  ), [data, kind, query]);
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 text-slate-800" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">مدیریت سؤالات تکراری</h1>
        <p className="mt-2 text-sm text-slate-600">مقایسه، انتخاب نسخه اصلی، ادغام موارد یکسان و آرشیو امن موارد تکراری</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm"><ArrowRight size={17} /> بازگشت</a>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 px-4 text-sm"><RefreshCcw size={17} /> به‌روزرسانی</button>
      </div>
    </div>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
      این صفحه ویژه مدیرکل است. حذف به‌صورت آرشیو انجام می‌شود تا سابقه‌ها و ارجاعات قبلی از بین نروند. ادغام فقط برای سؤال‌های کاملاً یکسان فعال است؛ موارد مشابه را جداگانه بررسی کنید.
    </p>
    {data && <p className="font-semibold">{data.totalGroups.toLocaleString("fa-IR")} گروه تکراری از {data.totalQuestions.toLocaleString("fa-IR")} سؤال عمومی بررسی‌شده</p>}
    <div className="flex flex-wrap gap-3">
      <label className="flex min-w-[230px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
        <Search size={18} className="text-slate-500" />
        <input aria-label="جست‌وجوی سؤال تکراری" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در متن یا منبع سؤال" className="min-h-11 w-full outline-none" />
      </label>
      <select aria-label="نوع تکراری" value={kind} onChange={(e) => setKind(e.target.value)}
        className="min-h-11 rounded-xl border border-slate-200 bg-white px-3">
        <option value="all">همه گروه‌ها</option><option value="exact">کاملاً یکسان</option><option value="similar">مشابه</option>
      </select>
    </div>
    {loading && <p role="status">در حال بررسی سؤالات…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} — برای دسترسی به این صفحه باید با حساب مدیرکل وارد شوید.</p>}
    {!loading && !error && filtered.length === 0 && <p className="rounded-xl bg-white p-5">گروه تکراری مطابق جست‌وجو یافت نشد.</p>}
    {!loading && !error && <PagedList items={filtered} label="گروه‌های تکراری" pageSize={20} className="grid gap-4">
      {(group) => <GroupReview key={group.id} group={group} onResolved={() => void refresh()} />}
    </PagedList>}
  </main>;
}
