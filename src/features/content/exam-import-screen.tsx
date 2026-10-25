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
  const [manual, setManual] = useState("");
  async function loadList() {
    setList(await api<ExamImport[]>("/exam-imports"));
  }
  async function load(id: string) {
    setExam(await api<Detail>(`/exam-imports/${id}`));
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
                });
                await load(row._id);
                await loadList();
              });
            }}
          >
            <h3 className="font-bold">آزمون جدید</h3>
            <div className="grid gap-4 sm:grid-cols-2">
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
                  className="grid min-w-0 gap-3 rounded-xl border border-dashed border-slate-300 p-4"
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <FileText className="size-4" />
                    {kind === "question"
                      ? "دفترچه سؤال‌ها (الزامی)"
                      : "پاسخ‌نامه (اختیاری)"}
                  </span>
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
                <PagedList items={exam.items} label="سؤال‌های آزمون">
                  {(item, index) => (
                    <ReviewItem
                      key={item._id}
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
  index,
  nodes,
  busy,
  review,
}: {
  item: ExamImportItem;
  index: number;
  nodes: Node[];
  busy: boolean;
  review: (body: unknown) => Promise<void>;
}) {
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
      <form
        className="mt-5 grid gap-4"
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
