"use client";
import { PagedList } from "@/components/ui/paged-list";
import { useEffect, useState } from "react";
import { FileText, UploadCloud, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AppLink } from "@/components/app-link";
import { api } from "@/lib/api";
import { fa } from "@/lib/presentation";
import { SourceEditor } from "./source-editor";
import { TopicSelector } from "./topic-selector";
import { VisualEditor } from "./visual-editor";
import { QuestionPresentation } from "@/components/question-presentation";
import { questionVisualsSchema } from "@/lib/question-visuals";
import {
  MAX_PDF_BYTES,
  type ExamImport,
  type ExamImportItem,
} from "@/lib/exam-import";
import type { QuestionSource } from "@/lib/question-source";
import type { Node } from "@/lib/types";
const style = "glass-field min-h-11 w-full min-w-0 p-3";
type Detail = ExamImport & { items: ExamImportItem[] };
export function ExamImportScreen({
  nodes,
  onApproved,
}: {
  nodes: Node[];
  onApproved: () => Promise<void>;
}) {
  const [list, setList] = useState<ExamImport[]>([]),
    [exam, setExam] = useState<Detail | null>(null);
  const [title, setTitle] = useState(""),
    [subject, setSubject] = useState(""),
    [grade, setGrade] = useState(""),
    [track, setTrack] = useState(""),
    [year, setYear] = useState("");
  const [source, setSource] = useState<QuestionSource | undefined>({
    family: "school",
    administration: "final",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [ocrLanguage, setOcrLanguage] = useState("fas");
  const [manual, setManual] = useState("");
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  useEffect(() => {
    if (!exam || exam.state !== "processing") return;
    const timer = setInterval(() => {
      void load(exam._id).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [exam?._id, exam?.state]);
  async function loadList() {
    setList(await api<ExamImport[]>("/exam-imports"));
  }
  async function load(id: string) {
    setExam(await api<Detail>(`/exam-imports/${id}`));
    history.replaceState(null, "", `/exam-import?exam=${id}`);
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در انجام عملیات");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    const restored = new URLSearchParams(location.search).get("exam");
    if (restored && /^[a-f0-9-]{36}$/.test(restored))
      void load(restored).catch((e) => setError(e.message));
    api<ExamImport[]>("/exam-imports")
      .then((rows) => {
        if (alive) setList(rows);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function upload(file: File | null, kind: "question" | "answer") {
    if (!exam || !file) return;
    await run(async () => {
      if (
        !/\.pdf$/i.test(file.name) ||
        file.size === 0 ||
        file.size > MAX_PDF_BYTES ||
        (await file.slice(0, 5).text()) !== "%PDF-"
      )
        throw new Error("PDF غیرخالی معتبر تا ۲۰ مگابایت لازم است.");
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      const key =
        "pdf-" +
        Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      const response = await fetch(
        `/api/exam-imports/${exam._id}/files/${kind}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "X-File-Name": encodeURIComponent(file.name),
            "Idempotency-Key": key,
          },
          body: file,
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).message ?? "بارگذاری فایل انجام نشد",
        );
      await load(exam._id);
      await loadList();
      setNotice("فایل در سرور ذخیره شد.");
    });
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl min-w-0 gap-5">
      <div className="glass-panel flex flex-wrap items-start justify-between gap-4 p-5 sm:p-7">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[#17305E]">
            <UploadCloud className="size-5" />
            ورود آزمون به بانک سؤال
          </h2>
          <p className="max-w-2xl text-sm leading-8 text-slate-600">
            ۱. ثبت مشخصات و PDF · ۲. استخراج متن · ۳. بازبینی و تأیید
            تک‌سؤال‌ها. پیش از تأیید شما هیچ سؤالی به بانک اضافه نمی‌شود.
          </p>
        </div>
        <AppLink
          href="/content"
          className="flex items-center gap-1 text-sm text-[#233B8F]"
        >
          <ArrowRight className="size-4" />
          بانک سؤال
        </AppLink>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm leading-7 text-rose-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
        >
          {notice}
        </p>
      )}
      {!exam ? (
        <>
          <form
            className="glass-panel grid min-w-0 gap-5 p-5 sm:p-7"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!source) throw new Error("دسته آزمون را انتخاب کنید.");
                const row = await api<ExamImport>("/exam-imports", {
                  title,
                  subject,
                  ...(grade ? { grade } : {}),
                  ...(track ? { track } : {}),
                  ...(year ? { year: Number(year) } : {}),
                  source,
                  ocrLanguage,
                });
                await load(row._id);
                await loadList();
              });
            }}
          >
            <h3 className="font-bold">آزمون جدید</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="زبان OCR">
                <select
                  className={style}
                  value={ocrLanguage}
                  onChange={(e) => setOcrLanguage(e.target.value)}
                >
                  <option value="fas">فارسی</option>
                  <option value="eng">انگلیسی</option>
                  <option value="fas+eng">فارسی و انگلیسی</option>
                </select>
              </Field>
              <Field title="عنوان آزمون">
                <input
                  required
                  minLength={3}
                  maxLength={150}
                  className={style}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً امتحان فیزیک، خرداد ۱۴۰۵"
                />
              </Field>
              <Field title="درس آزمون">
                <input
                  required
                  maxLength={150}
                  className={style}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
              <Field title="سال آزمون (شمسی)">
                <input
                  type="number"
                  min={1300}
                  max={1500}
                  className={style}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </Field>
              <Field title="پایه یا دامنه آزمون (اختیاری)">
                <input
                  maxLength={100}
                  placeholder="مثلاً دوازدهم یا چندپایه"
                  className={style}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
              </Field>
              <Field title="رشته یا گروه (اختیاری)">
                <input
                  maxLength={100}
                  className={style}
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                />
              </Field>
            </div>
            <SourceEditor
              hideQuestionNumber
              value={source}
              onChange={setSource}
              disabled={busy}
            />
            <Button disabled={busy || !source}>
              ثبت آزمون و ادامه به آپلود
            </Button>
          </form>
          <section className="glass-panel grid gap-3 p-5">
            <h3 className="font-bold">آزمون‌های ذخیره‌شده من</h3>
            {!list.length && (
              <p className="text-sm text-slate-500">
                هنوز آزمونی ثبت نشده است.
              </p>
            )}
            <PagedList items={list} label="آزمون‌های واردشده">
              {(e) => (
                <button
                  disabled={busy}
                  type="button"
                  key={e._id}
                  onClick={() => void run(() => load(e._id))}
                  className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 text-right"
                >
                  <span>{e.title}</span>
                  <span className="text-xs text-slate-500">
                    {e.state === "review"
                      ? "آماده بازبینی"
                      : "در انتظار فایل / پردازش"}
                  </span>
                </button>
              )}
            </PagedList>
          </section>
        </>
      ) : (
        <>
          <section className="glass-panel grid min-w-0 gap-4 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold">{exam.title}</h3>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setExam(null);
                  history.replaceState(null, "", "/exam-import");
                  void run(loadList);
                }}
              >
                فهرست آزمون‌ها
              </Button>
            </div>
            <p className="text-sm text-slate-500">
              {exam.subject} ·{" "}
              {exam.year?.toLocaleString("fa-IR", { useGrouping: false }) ??
                "سال نامشخص"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["question", "answer"] as const).map((kind) => (
                <div
                  key={kind}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (exam.state === "collecting")
                      void upload(e.dataTransfer.files[0] ?? null, kind);
                  }}
                  className="grid min-w-0 gap-3 rounded-xl border border-dashed border-slate-300 p-4"
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <FileText className="size-4" />
                    {kind === "question"
                      ? "دفترچه سؤال‌ها (الزامی)"
                      : "پاسخ‌نامه (اختیاری)"}
                  </span>
                  {exam.state === "collecting" && exam.files?.[kind] && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const result = await fetch(
                            `/api/exam-imports/${exam._id}/files/${kind}`,
                            { method: "DELETE" },
                          );
                          if (!result.ok) throw new Error("حذف فایل انجام نشد");
                          await load(exam._id);
                        })
                      }
                    >
                      حذف فایل انتخاب‌شده
                    </Button>
                  )}
                  {exam.state === "collecting" && (
                    <input
                      aria-label={
                        kind === "question" ? "دفترچه سؤال‌ها" : "پاسخ‌نامه"
                      }
                      type="file"
                      accept=".pdf,application/pdf"
                      disabled={busy}
                      className="min-w-0 w-full text-xs"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void upload(file, kind);
                      }}
                    />
                  )}
                  {exam.files?.[kind] ? (
                    <a
                      href={`/api/exam-imports/${exam._id}/files/${kind}`}
                      className="break-all text-sm text-[#233B8F] underline"
                    >
                      دریافت فایل ذخیره‌شده: {exam.files[kind]!.name}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">
                      فایل انتخاب نشده؛ حداکثر ۲۰ مگابایت
                    </span>
                  )}
                </div>
              ))}
            </div>
            {exam.state === "collecting" && (
              <Button
                disabled={busy || !exam.files?.question}
                onClick={() =>
                  void run(async () => {
                    await api(`/exam-imports/${exam._id}/extract`, {});
                    await load(exam._id);
                    await loadList();
                  })
                }
              >
                {busy
                  ? "در حال انجام…"
                  : "استخراج متن و ایجاد پیش‌نویس سؤال‌ها"}
              </Button>
            )}
            {exam.state === "processing" && (
              <div
                role="status"
                className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-sm leading-7"
              >
                پردازش در صف پایدار سرور · مرحله: {exam.job?.stage ?? "queued"}
                {exam.job?.processedPage
                  ? ` · صفحه ${fa(exam.job.processedPage)}`
                  : ""}
                <p>
                  می‌توانید صفحه را ببندید؛ پردازش در worker مستقل ادامه می‌یابد
                  و نتیجه اینجا باقی می‌ماند.
                </p>
              </div>
            )}
            {exam.state === "failed" && (
              <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm">
                <p>{exam.job?.errorMessage ?? "پردازش ناموفق بود"}</p>
                <Button
                  type="button"
                  disabled={busy || (exam.job?.attempts ?? 3) >= 3}
                  onClick={() =>
                    void run(async () => {
                      await api(`/exam-imports/${exam._id}/retry`, {});
                      await load(exam._id);
                    })
                  }
                >
                  تلاش مجدد پردازش
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`/exam-imports/${exam._id}/manual-review`, {});
                      await load(exam._id);
                    })
                  }
                >
                  ادامه با ورود دستی
                </Button>
              </div>
            )}
            {exam.statistics && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["صفحات دفترچه", exam.statistics.pages],
                  ["سؤال‌ها", exam.statistics.questions],
                  ["چهارگزینه‌ای کامل", exam.statistics.fourOptions],
                  ["کلید استخراج‌شده", exam.statistics.keys],
                  ["تطبیق شماره معتبر", exam.statistics.matched],
                  ["نیازمند بازبینی", exam.statistics.needsReview],
                ].map(([label, count]) => (
                  <div key={String(label)} className="glass-option p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <strong className="text-xl text-[#233B8F]">
                      {fa(Number(count))}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {exam.statistics?.keyWarnings.map((w) => (
              <p key={w} className="text-sm text-amber-800">
                {w}
              </p>
            ))}
            {!!exam.statistics?.unmatchedKeys.length && (
              <p className="text-sm text-amber-800">
                {fa(exam.statistics.unmatchedKeys.length)} پاسخ کلید، سؤال
                متناظر ندارد.
              </p>
            )}
            {exam.state === "review" && (
              <>
                <details>
                  <summary className="cursor-pointer text-sm text-[#233B8F]">
                    مشاهده اصل صفحه پاسخ‌نامه
                  </summary>
                  {exam.files?.answer && !exam.sourceDeletedAt && (
                    <a
                      href={`/api/exam-imports/${exam._id}/pages/answer/1`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm underline"
                    >
                      بازکردن تصویر اصلی پاسخ‌نامه (صفحه اول)
                    </a>
                  )}
                </details>
                <p className="text-xs text-slate-500">
                  منبع تا{" "}
                  {exam.sourceExpiresAt
                    ? new Date(exam.sourceExpiresAt).toLocaleDateString("fa-IR")
                    : "پایان دوره نگهداری"}{" "}
                  نگهداری می‌شود. پس از حذف، پیش‌نویس‌ها باقی می‌مانند؛ تصاویرِ
                  سؤال‌های منتشرشده مستقل حفظ می‌شوند.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !!exam.sourceDeletedAt}
                  onClick={() => {
                    if (
                      confirm(
                        "اصل PDF و تصاویر موقت حذف شوند؟ سؤالات بانک حفظ خواهند شد.",
                      )
                    )
                      void run(async () => {
                        const res = await fetch(
                          `/api/exam-imports/${exam._id}/files`,
                          { method: "DELETE" },
                        );
                        if (!res.ok) throw new Error("حذف فایل انجام نشد");
                        await load(exam._id);
                      });
                  }}
                >
                  حذف فایل‌های موقت منبع
                </Button>
              </>
            )}
            {exam.state === "review" && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm leading-8 text-amber-900">
                {exam.extractionNotice}
              </p>
            )}
          </section>
          {exam.state === "review" && (
            <>
              <section className="glass-panel grid gap-4 p-5">
                <h3 className="font-bold">متن استخراج‌شده و ورود دستی</h3>
                {[
                  ["سؤال‌ها", exam.questionText],
                  ["پاسخ‌نامه", exam.answerText],
                ].map(([label, text]) => (
                  <details key={label}>
                    <summary className="cursor-pointer text-sm text-[#233B8F]">
                      نمایش متن {label}
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 font-sans text-sm leading-8">
                      {text || "متنی استخراج نشده است."}
                    </pre>
                  </details>
                ))}
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api(`/exam-imports/${exam._id}/items`, {
                        statement: manual,
                      });
                      setManual("");
                      await load(exam._id);
                    });
                  }}
                >
                  <Field title="افزودن سؤال دستی به این آزمون">
                    <textarea
                      required
                      minLength={3}
                      maxLength={5000}
                      className={`${style} min-h-24`}
                      value={manual}
                      onChange={(e) => setManual(e.target.value)}
                    />
                  </Field>
                  <Button disabled={busy}>افزودن پیش‌نویس دستی</Button>
                </form>
              </section>
              <section
                className="grid min-w-0 gap-4"
                aria-label="بازبینی سؤال‌های آزمون"
              >
                <h3 className="font-bold">
                  بازبینی سؤال‌ها ·{" "}
                  {fa(exam.items.filter((i) => i.state === "pending").length)}{" "}
                  در انتظار ·{" "}
                  {fa(exam.items.filter((i) => i.state === "approved").length)}{" "}
                  واردشده به بانک
                </h3>
                {!exam.items.length && (
                  <p className="rounded-xl bg-white p-5 text-sm">
                    پیش‌نویسی استخراج نشد؛ از فرم بالا سؤال دستی اضافه کنید.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Field title="فیلتر بازبینی">
                    <select
                      className={style}
                      value={reviewFilter}
                      onChange={(e) => setReviewFilter(e.target.value)}
                    >
                      <option value="all">همه</option>
                      <option value="pending">در انتظار</option>
                      <option value="problems">دارای هشدار</option>
                      <option value="deferred">بازبینی بعدی</option>
                      <option value="approved">تأییدشده</option>
                      <option value="rejected">ردشده</option>
                    </select>
                  </Field>
                  <label className="text-sm">
                    <input
                      type="checkbox"
                      checked={bulkConfirmed}
                      onChange={(e) => setBulkConfirmed(e.target.checked)}
                    />{" "}
                    متن، شکل، گزینه و کلید همهٔ موارد انتخاب‌شده را بررسی
                    کرده‌ام.
                  </label>
                  <Button
                    type="button"
                    disabled={busy || !bulkConfirmed || !selectedItems.length}
                    onClick={() =>
                      void run(async () => {
                        const result = await api<{
                          approved: string[];
                          failed: { id: string; reason: string }[];
                        }>(`/exam-imports/${exam._id}/approve-batch`, {
                          itemIds: selectedItems,
                          confirmed: true,
                        });
                        setSelectedItems([]);
                        setBulkConfirmed(false);
                        await load(exam._id);
                        await onApproved();
                        setNotice(
                          `${fa(result.approved.length)} تأیید شد؛ ${fa(result.failed.length)} مورد معتبر نبود و در بازبینی ماند.`,
                        );
                      })
                    }
                  >
                    تأیید گروهی موارد معتبر (حداکثر ۵۰)
                  </Button>
                </div>
                <PagedList
                  items={exam.items.filter((i) =>
                    reviewFilter === "all" || reviewFilter === "problems"
                      ? reviewFilter === "all" ||
                        !!i.extraction?.warnings.length
                      : reviewFilter === "deferred"
                        ? !!i.deferred
                        : i.state === reviewFilter,
                  )}
                  label="سؤال‌های آزمون"
                >
                  {(item, index) => (
                    <ReviewItem
                      key={`${item._id}-${item.updatedAt ?? ""}`}
                      selected={selectedItems.includes(item._id)}
                      onSelected={(checked) => {
                        setBulkConfirmed(false);
                        setSelectedItems((old) =>
                          checked
                            ? [...new Set([...old, item._id])]
                            : old.filter((id) => id !== item._id),
                        );
                      }}
                      item={item}
                      index={index}
                      nodes={nodes}
                      busy={busy}
                      review={(body) =>
                        run(async () => {
                          await api(
                            `/exam-imports/${exam._id}/items/${item._id}/review`,
                            body,
                          );
                          await load(exam._id);
                          if (
                            (body as { action?: string }).action === "approve"
                          )
                            await onApproved();
                          setNotice("نتیجه بررسی ذخیره شد.");
                        })
                      }
                    />
                  )}
                </PagedList>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
function ReviewItem({
  item,
  selected,
  onSelected,
  index,
  nodes,
  busy,
  review,
}: {
  item: ExamImportItem;
  selected: boolean;
  onSelected: (value: boolean) => void;
  index: number;
  nodes: Node[];
  busy: boolean;
  review: (body: unknown) => Promise<void>;
}) {
  const [sourceZoom, setSourceZoom] = useState(false);
  const [q, setQ] = useState(item.question),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(""),
    [originalNumber, setOriginalNumber] = useState(
      item.originalNumber ? String(item.originalNumber) : "",
    );
  const valid =
    q.statement.trim().length >= 3 &&
    !!q.reference.trim() &&
    (q.classification !== "topic" || !!q.topicId) &&
    (q.type !== "choice" ||
      (q.options.length >= 2 && q.options.includes(q.reference))) &&
    questionVisualsSchema.safeParse(q.visuals ?? []).success;
  if (item.state !== "pending")
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        سؤال {fa(index + 1)} ·{" "}
        {item.state === "approved" ? "تأیید و وارد بانک شد" : "رد شد"}
      </div>
    );
  return (
    <details className="glass-panel min-w-0 p-5" open>
      <summary className="cursor-pointer font-bold">
        پیش‌نویس سؤال {fa(index + 1)} · نیازمند بررسی
      </summary>
      <div className="mt-4 grid gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelected(e.target.checked)}
          />
          انتخاب برای بررسی گروهی
        </label>
        {item.extraction && (
          <>
            <p className="text-xs text-slate-500">
              روش: {item.extraction.method} · اطمینان OCR:{" "}
              {item.extraction.confidence === null
                ? "محاسبه نشده"
                : `${item.extraction.confidence.toFixed(1)} از ۱۰۰`}{" "}
              · تطبیق: {item.extraction.answerMatch.status}
            </p>
            {item.extraction.regions.map((region, i) => (
              <a
                key={`page-${i}`}
                className="text-xs text-blue-700 underline"
                target="_blank"
                rel="noreferrer"
                href={`/api/exam-imports/${item.examId}/pages/question/${region.page}`}
              >
                اصل کامل صفحه {fa(region.page)}
              </a>
            ))}
            {item.extraction.warnings.map((w) => (
              <p
                key={w}
                className="rounded-lg bg-amber-50/60 p-2 text-xs text-amber-800"
              >
                {w}
              </p>
            ))}
            {item.extraction.answerMatch.matches.map((match, i) => (
              <a
                key={i}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 underline"
                href={`/api/exam-imports/${item.examId}/pages/answer/${match.page}`}
              >
                کلید سؤال {fa(match.number)}، گزینه {fa(match.option)}؛ صفحه{" "}
                {fa(match.page)}
              </a>
            ))}
          </>
        )}
      </div>
      <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-3 lg:sticky lg:top-3 lg:self-start">
          <h4 className="text-sm font-bold">اصل سؤال از PDF</h4>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSourceZoom(!sourceZoom)}
          >
            {sourceZoom ? "اندازه عادی" : "بزرگ‌نمایی تصویر"}
          </Button>
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-blue-100 bg-white p-3">
            <div className={sourceZoom ? "min-w-[1100px]" : ""}>
              <QuestionPresentation
                statement="تصویر منبع؛ فرمول‌ها را با متن مقابل تطبیق دهید"
                visuals={item.question.visuals}
              />
            </div>
          </div>
        </div>
        <form
          className="mt-5 grid min-w-0 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void review({
              action: "approve",
              confirmed: true,
              question: q,
              ...(originalNumber
                ? { originalNumber: Number(originalNumber) }
                : {}),
            });
          }}
        >
          <Field title={`صورت سؤال ${index + 1}`}>
            <textarea
              required
              minLength={3}
              maxLength={5000}
              className={`${style} min-h-28`}
              value={q.statement}
              onChange={(e) => {
                setQ({ ...q, statement: e.target.value });
                setConfirmed(false);
              }}
            />
          </Field>
          <Field title={`شماره سؤال در دفترچه ${index + 1} (اختیاری)`}>
            <input
              type="number"
              min={1}
              max={10000}
              className={style}
              value={originalNumber}
              onChange={(e) => {
                setOriginalNumber(e.target.value);
                setConfirmed(false);
              }}
            />
          </Field>
          <Field title={`روش پاسخ سؤال ${index + 1}`}>
            <select
              className={style}
              value={q.type}
              onChange={(e) => {
                setQ({ ...q, type: e.target.value });
                setConfirmed(false);
              }}
            >
              <option value="essay">تشریحی با بررسی معلم</option>
              <option value="numeric">عددی</option>
              <option value="choice">چندگزینه‌ای</option>
              <option value="short">پاسخ کوتاه</option>
            </select>
          </Field>
          {q.type === "choice" && (
            <Field title={`گزینه‌های سؤال ${index + 1} (هر خط یک گزینه)`}>
              <textarea
                className={style}
                value={q.options.join("\n")}
                onChange={(e) => {
                  setQ({
                    ...q,
                    options: e.target.value.split("\n").filter(Boolean),
                  });
                  setConfirmed(false);
                }}
              />
            </Field>
          )}
          <Field title={`پاسخ مرجع سؤال ${index + 1}`}>
            <textarea
              required
              maxLength={2000}
              className={`${style} min-h-20`}
              value={q.reference}
              onChange={(e) => {
                setQ({ ...q, reference: e.target.value });
                setConfirmed(false);
              }}
            />
          </Field>
          <Field title={`درجه سختی سؤال ${index + 1}`}>
            <select
              className={style}
              value={q.difficulty ?? ""}
              onChange={(e) =>
                setQ({
                  ...q,
                  difficulty: (e.target.value ||
                    undefined) as typeof q.difficulty,
                })
              }
            >
              <option value="">تعیین نشده</option>
              <option value="easy">آسان</option>
              <option value="medium">متوسط</option>
              <option value="hard">سخت</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={q.classification === "topic"}
              onChange={(e) => {
                setQ({
                  ...q,
                  classification: e.target.checked ? "topic" : "free",
                  topicId: undefined,
                });
                setConfirmed(false);
              }}
            />
            اتصال این سؤال به مبحث درسی
          </label>
          {q.classification === "topic" && (
            <TopicSelector
              context={`سؤال ${index + 1}`}
              nodes={nodes}
              value={q.topicId ?? ""}
              onChange={(topicId) => {
                setQ({ ...q, topicId: topicId || undefined });
                setConfirmed(false);
              }}
            />
          )}
          <details>
            <summary className="cursor-pointer text-sm text-[#233B8F]">
              افزودن یا اصلاح نمودار، شکل و فرمول
            </summary>
            <div className="mt-3">
              <VisualEditor
                value={q.visuals ?? []}
                disabled={busy}
                onChange={(visuals) => {
                  setQ({ ...q, visuals });
                  setConfirmed(false);
                }}
              />
            </div>
          </details>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-3 text-xs text-slate-500">پیش‌نمایش دانش‌آموز</p>
            <QuestionPresentation statement={q.statement} visuals={q.visuals} />
          </div>
          <label className="flex items-start gap-2 text-sm leading-7">
            <input
              type="checkbox"
              className="mt-2"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            متن، پاسخ، تقسیم سؤال و شکل‌های لازم را با PDF تطبیق داده و صحت را
            تأیید می‌کنم.
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy || q.statement.trim().length < 3}
            onClick={() =>
              void review({
                action: "save",
                question: q,
                ...(originalNumber
                  ? { originalNumber: Number(originalNumber) }
                  : {}),
              })
            }
          >
            ذخیره اصلاحات سؤال {fa(index + 1)}
          </Button>
          <Button disabled={busy || !valid || !confirmed}>
            تأیید و ورود سؤال {fa(index + 1)} به بانک
          </Button>
        </form>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void review({ action: "defer" })}
      >
        انتقال به بازبینی بعدی
      </Button>
      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
        <Field title={`دلیل رد سؤال ${index + 1}`}>
          <input
            maxLength={500}
            className={style}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={busy || reason.trim().length < 3}
          onClick={() => void review({ action: "reject", reason })}
        >
          رد پیش‌نویس سؤال {fa(index + 1)}
        </Button>
      </div>
    </details>
  );
}
