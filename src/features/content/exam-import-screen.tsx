"use client";
import { normalizeQuestionTextFields } from "@/lib/persian-question-text";
import { HistoricalExamSources, historicalExamLabel } from "./historical-exam-sources";
import type { HistoricalExamAsset } from "@/lib/historical-exam-sources";
import { QuestionTextInput } from "@/components/question-text-input";
import { PagedList } from "@/components/ui/paged-list";
import { useEffect, useState } from "react";
import { FileText, UploadCloud, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { AppLink } from "@/components/app-link";
import { api } from "@/lib/api";
import { calculateExamProgress, countUniqueApprovedQuestions, estimateLegacyQuestionCount } from "@/lib/exam-import-progress";
import { fa } from "@/lib/presentation";
import { SourceEditor } from "./source-editor";
import { TopicSelector } from "./topic-selector";
import { VisualEditor } from "./visual-editor";
import { QuestionPresentation } from "@/components/question-presentation";
import {
  type QuestionVisual,
  questionVisualsSchema,
} from "@/lib/question-visuals";
import {
  MAX_PDF_BYTES,
  type ExamImport,
  type ExamImportItem,
} from "@/lib/exam-import";
import type { QuestionSource } from "@/lib/question-source";
import { detailedExamCatalog, mockExamProviders, examCatalogEntry, examCatalogSections, examCatalogValidIds } from "@/lib/exam-catalog";
import type { Node } from "@/lib/types";
const style = "glass-field min-h-11 w-full min-w-0 p-3";
type Detail = ExamImport & {
  items: ExamImportItem[];
  sourcePages?: { page: number }[];
};
export function ExamImportScreen({
  nodes,
  onApproved,
  embedded = false,
  onUseQuestions,
  currentUserId,
  superAdmin = false,
}: {
  nodes: Node[];
  onApproved: () => Promise<void>;
  embedded?: boolean;
  onUseQuestions?: (ids: string[]) => Promise<void>;
  currentUserId?: string;
  superAdmin?: boolean;
}) {
  const [list, setList] = useState<ExamImport[]>([]),
    [exam, setExam] = useState<Detail | null>(null);
  const [title, setTitle] = useState(""),
    [subject, setSubject] = useState(""),
    [grade, setGrade] = useState(""),
    [track, setTrack] = useState(""),
    [year, setYear] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [listCategoryFilter, setListCategoryFilter] = useState("");
  const [source, setSource] = useState<QuestionSource | undefined>({
    family: "school",
    administration: "final",
  });
  const showTrack = Number(grade) >= 10 || source?.family === "konkur";
  const progressEvidence = exam?.statistics
    ? exam.statistics.expectedCountConfidence
      ? {
          expectedQuestionCount: exam.statistics.expectedQuestionCount ?? null,
          expectedCountConfidence: exam.statistics.expectedCountConfidence,
        }
      : estimateLegacyQuestionCount({
          keyEntries: exam.statistics.keys,
          hasAnswerFile: Boolean(exam.files?.answer),
          failedAnswerPages: exam.statistics.failedPages?.filter((page) => page.kind === "answer").length ?? 0,
        })
    : { expectedQuestionCount: null, expectedCountConfidence: "unknown" as const };
  const importProgress = calculateExamProgress({
    ...progressEvidence,
    approved: countUniqueApprovedQuestions((exam?.items ?? []).map((item) => ({
      _id: item._id, state: item.state,
      originalNumber: item.originalNumber,
      detectedNumber: item.extraction?.detectedNumber,
      questionVersionId: item.questionVersionId,
    }))),
    extracted: exam?.items.length ?? 0,
  });
  const hasPublicFiles = Boolean(exam?.publicFiles?.question || exam?.publicFiles?.answer);
  const canPublishPublicFiles = Boolean(
    exam?.state === "review" && exam.files?.question &&
    exam.categoryIds?.length && !exam.sourceDeletedAt,
  );
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
    if (!embedded) history.replaceState(null, "", `/exam-import?exam=${id}`);
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
  async function setPublicFiles(published: boolean) {
    if (!exam || !superAdmin) return;
    if (published && !window.confirm(
      "دفترچه و در صورت بارگذاری، کلید پاسخ به‌صورت عمومی کنار آزمون قرار می‌گیرند و همه کاربران می‌توانند آن‌ها را مشاهده یا دانلود کنند. فقط در صورت داشتن مجوز انتشار فایل‌ها ادامه دهید.",
    )) return;
    await run(async () => {
      await api(`/admin/exam-imports/${exam._id}/public-files`, { published });
      await load(exam._id);
      await loadList();
      setNotice(published
        ? "فایل‌های انتخاب‌شده در کنار آزمون منتشر شدند."
        : "انتشار عمومی فایل‌های آزمون برداشته شد.");
    });
  }
  useEffect(() => {
    let alive = true;
    const restored =
      !embedded && new URLSearchParams(location.search).get("exam");
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
      const image = /\.(png|jpe?g|webp)$/i.test(file.name);
      if (
        file.size === 0 ||
        file.size > MAX_PDF_BYTES ||
        (!image &&
          (!/\.pdf$/i.test(file.name) ||
            (await file.slice(0, 5).text()) !== "%PDF-"))
      )
        throw new Error(
          "فایل PDF یا عکس PNG، JPEG، WebP معتبر تا ۲۰ مگابایت لازم است.",
        );
      const contentType = image
        ? /\.png$/i.test(file.name)
          ? "image/png"
          : /\.webp$/i.test(file.name)
            ? "image/webp"
            : "image/jpeg"
        : "application/pdf";
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
            "Content-Type": contentType,
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
            ورود PDF یا عکس سؤال
          </h2>
          <p className="max-w-2xl text-sm leading-8 text-slate-600">
            ۱. انتخاب درس و فایل · ۲. استخراج متن · ۳. بازبینی و تأیید
            تک‌سؤال‌ها. پیش از تأیید شما هیچ سؤالی به بانک اضافه نمی‌شود.
          </p>
        </div>
        {!embedded && (
          <AppLink
            href="/content"
            className="flex items-center gap-1 text-sm text-[#233B8F]"
          >
            <ArrowRight className="size-4" />
            بانک سؤال
          </AppLink>
        )}
      </div>
      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer p-4 font-semibold text-indigo-900">
          انتخاب از آرشیو آزمون‌های سال‌های گذشته (PDF سؤال و کلید)
        </summary>
        <div className="p-3">
          <HistoricalExamSources onChoose={(asset: HistoricalExamAsset) => {
            setTitle(historicalExamLabel(asset));
            setSubject(asset.subject.slice(0, 100));
            const match = asset.examId.match(/-(\d{4})-/);
            if (match) setYear(match[1]);
            if (asset.examId.startsWith("konkur-")) {
              setSource({ family: "konkur", organizer: "سازمان سنجش", ...(match ? { academicYear: match[1] } : {}) });
              if (asset.examId.endsWith("-math")) setTrack("ریاضی و فیزیک");
              else if (asset.examId.endsWith("-experimental")) setTrack("علوم تجربی");
              else setTrack("");
              setGrade("12");
            } else {
              setSource({ family: "school", administration: "final" });
              setGrade("12");
              setTrack("");
            }
            setNotice("مشخصات اولیه از آرشیو انتخاب شد. PDF را پس از بررسی مجوز و عنوان، دستی بارگذاری کنید.");
          }} />
        </div>
      </details>
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
      {exam && onUseQuestions && (
        <Button
          type="button"
          disabled={
            busy ||
            !exam.items.some(
              (i) => i.state === "approved" && i.questionVersionId,
            )
          }
          onClick={() =>
            void run(async () => {
              await onUseQuestions(
                exam.items
                  .filter((i) => i.state === "approved" && i.questionVersionId)
                  .map((i) => i.questionVersionId!),
              );
            })
          }
        >
          افزودن سؤال‌های تأییدشده به مأموریت (
          {fa(
            exam.items.filter(
              (i) => i.state === "approved" && i.questionVersionId,
            ).length,
          )}
          )
        </Button>
      )}
      {!exam ? (
        <>
          <form
            className="glass-panel grid min-w-0 gap-5 p-5 sm:p-7"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void run(async () => {
                if (!source) throw new Error("دسته آزمون را انتخاب کنید.");
                const row = await api<ExamImport>("/exam-imports", {
                  title: title.trim() || `${subject} · ${year || "آزمون جدید"}`,
                  subject,
                  ...(grade ? { grade } : {}),
                  ...(showTrack && track ? { track } : {}),
                  ...(year ? { year: Number(year) } : {}),
                  source,
                  categoryIds,
                  ocrLanguage,
                });
                await load(row._id);
                await loadList();
              });
            }}
          >
            <h3 className="font-bold">آزمون جدید</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="درس آزمون">
                <select
                  required
                  className={style}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">انتخاب درس</option>
                  {[
                    ...new Set([
                      "ریاضی",
                      "فیزیک",
                      "علوم تجربی",
                      "شیمی",
                      "زیست‌شناسی",
                      "فارسی",
                      "عربی",
                      "زبان انگلیسی",
                      "دینی",
                      "مطالعات اجتماعی",
                      "چنددرس",
                      ...nodes
                        .filter((n) => ["subject", "course"].includes(n.kind))
                        .map((n) => n.title),
                      "سایر",
                    ]),
                  ].map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title="سال آزمون (اختیاری)">
                <select
                  className={style}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">تعیین نشده</option>
                  {Array.from({ length: 41 }, (_, i) => 1410 - i).map((y) => (
                    <option key={y} value={y}>
                      {y.toLocaleString("fa-IR", { useGrouping: false })}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title="پایه (اختیاری)">
                <select
                  className={style}
                  value={grade}
                  onChange={(e) => {
                    setGrade(e.target.value);
                    setTrack("");
                  }}
                >
                  <option value="">چندپایه / تعیین نشده</option>
                  {Array.from({ length: 6 }, (_, i) => String(i + 7)).map(
                    (g) => (
                      <option key={g} value={g}>
                        پایه {fa(Number(g))}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              {showTrack && (
                <Field title="رشته یا گروه (اختیاری)">
                  <select
                    className={style}
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                  >
                    <option value="">مشترک / تعیین نشده</option>
                    {[
                      "ریاضی و فیزیک",
                      "علوم تجربی",

                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            <details className="rounded-xl border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm text-[#233B8F]">
                عنوان دلخواه و زبان اسکن (اختیاری)
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field title="عنوان آزمون">
                  <input
                    maxLength={150}
                    className={style}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="در صورت خالی‌بودن خودکار ساخته می‌شود"
                  />
                </Field>
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
              </div>
            </details>
            <fieldset className="grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
              <legend className="px-2 font-bold text-indigo-900">فهرست آزمون‌ها · انتخاب موردی</legend>
              <p className="text-xs leading-6 text-slate-600">
                هر آزمون را از دسته‌های آماده تیک بزنید. برای یک آزمون مشخص،
                برچسب‌های مرتبط را انتخاب کنید؛ این تیک‌ها همراه اطلاعات آزمون در بانک ذخیره می‌شوند.
                فقط متوسطه اول و رشته‌های ریاضی و تجربی متوسطه دوم در این نسخه هستند.
              </p>
              <label className="grid gap-2 text-sm">
                جست‌وجوی سال، برگزارکننده یا پایه
                <input className={style} value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="مثلاً ماز، ۱۴۰۴، دوازدهم یا ریاضی" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {examCatalogSections.map((section) => (
                  <details key={section.id} className="rounded-xl border border-slate-200 bg-white p-3" open={section.id === "konkur" ? true : undefined}>
                    <summary className="cursor-pointer font-semibold text-slate-800">
                      {section.label}
                      <span className="mr-2 text-xs text-slate-500">
                        ({detailedExamCatalog.filter((item) => item.section === section.id).length.toLocaleString("fa-IR")})
                      </span>
                    </summary>
                    <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">
                      {detailedExamCatalog.filter((item) => item.section === section.id && (!catalogSearch.trim() || item.label.includes(catalogSearch.trim()))).map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm hover:bg-indigo-50">
                          <input
                            type="checkbox"
                            className="size-4 accent-indigo-700"
                            checked={categoryIds.includes(item.id)}
                            disabled={busy || (categoryIds.length >= 8 && !categoryIds.includes(item.id))}
                            onChange={(event) => {
                              setCategoryIds((previous) =>
                                event.target.checked
                                  ? examCatalogValidIds([...previous, item.id]) ? [...previous, item.id] : [item.id]
                                  : previous.filter((id) => id !== item.id),
                              );
                              if (event.target.checked) {
                                if (item.year) setYear(String(item.year));
                                if (item.grade) setGrade(item.grade);
                                if (item.track) setTrack(item.track === "mathematics" ? "ریاضی و فیزیک" : "علوم تجربی");
                                if (item.section === "konkur") {
                                  const kind = item.stage ?? "";
                                  const location = kind.includes("international") ? "international" :
                                    kind.includes("domestic") ? "domestic" : undefined;
                                  const session = kind.startsWith("first") ? "نوبت اول" :
                                    kind.startsWith("second") ? "نوبت دوم" :
                                    kind === "morning" ? "صبح" : kind === "afternoon" ? "عصر" : undefined;
                                  const system = kind.includes("old") ? "نظام قدیم" :
                                    kind.includes("new") ? "نظام جدید" : undefined;
                                  const booklet = kind === "booklet-general" ? "دفترچه عمومی" :
                                    kind === "booklet-specific" ? "دفترچه اختصاصی" :
                                    kind === "booklet" && item.provider === "farhangian" ? "دفترچه اختصاصی فرهنگیان" : undefined;
                                  setSource({
                                    family: "konkur", group: item.track,
                                    ...(location ? { location } : {}),
                                    ...(session ? { session } : {}),
                                    ...(system ? { stage: system } : {}),
                                    ...(booklet ? { bookletCode: booklet } : {}),
                                    ...(item.year ? { academicYear: String(item.year) } : {}),
                                    ...(item.provider ? { organizer: item.provider === "azad"
                                      ? "دانشگاه آزاد" : item.provider === "azad-shared"
                                        ? "سازمان سنجش (پذیرش دانشگاه آزاد)" : item.provider === "farhangian"
                                        ? "سازمان سنجش (فرهنگیان)" : "سازمان سنجش" } : {}),
                                  });
                                } else if (item.section === "school") {
                                  const administration = item.id.startsWith("final-") ? "final" : item.id.startsWith("coordinated-") ? "district" : "internal";
                                  setSource({ family: "school", administration, ...(administration === "internal" && item.stage && ["continuous", "chapter", "mid_first", "end_first", "mid_second", "end_second", "remedial"].includes(item.stage) ? { schoolStage: item.stage as "continuous" | "chapter" | "mid_first" | "end_first" | "mid_second" | "end_second" | "remedial" } : {}) });
                                } else if (item.section === "admission") {
                                  setSource({ family: "admission", admission: item.id.includes("sampad-7") ? "sampad7" : item.id.includes("sampad-10") ? "sampad10" : "nemune10" });
                                } else if (item.section === "mock") setSource({
                                  family: "mock",
                                  ...(item.provider ? { organizer: mockExamProviders.find((provider) => provider.id === item.provider)?.name ?? item.provider } : {}),
                                  ...(item.year ? { academicYear: `${item.year}–${item.year + 1}` } : {}),
                                });
                                else if (item.section === "olympiad") setSource({ family: "olympiad" });
                                else setSource({ family: "practice", practice: "teacher" });
                              }
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              {categoryIds.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-live="polite">
                  {categoryIds.map((id) => (
                    <span key={id} className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-900">
                      {examCatalogEntry(id)?.label}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500">تا ۸ برچسب مرتبط قابل انتخاب است. انتخاب یک دسته ناسازگار، برچسب‌های قبلی را جایگزین می‌کند. اگر آزمون شما در فهرست نیست، از مشخصات منبع برای ثبت دقیق آن استفاده کنید.</p>
            </fieldset>
            <SourceEditor
              compact
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
            <h3 className="font-bold">{superAdmin ? "تمام آزمون‌های واردشدهٔ کاربران" : "آزمون‌های ذخیره‌شدهٔ من"}</h3>
            {!list.length && (
              <p className="text-sm text-slate-500">
                هنوز آزمونی ثبت نشده است.
              </p>
            )}
            <label className="grid gap-2 text-sm text-slate-700">
              فیلتر آزمون‌های ثبت‌شده بر اساس دسته
              <select className={style} value={listCategoryFilter} onChange={(e) => setListCategoryFilter(e.target.value)}>
                <option value="">تمام آزمون‌ها</option>
                {examCatalogSections.map((section) => (
                  <optgroup key={section.id} label={section.label}>
                    {detailedExamCatalog.filter((item) => item.section === section.id).map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <PagedList items={list.filter((item) => !listCategoryFilter || item.categoryIds?.includes(listCategoryFilter))} label="آزمون‌های واردشده">
              {(e) => (
                <div
                  key={e._id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"
                >
                  <button
                    disabled={busy}
                    type="button"
                    key={e._id}
                    onClick={() => void run(() => load(e._id))}
                    className="flex flex-1 flex-wrap justify-between gap-2 p-2 text-right"
                  >
                    <span>{e.title}{e.categoryIds?.length ? <span className="mr-2 text-xs text-indigo-700">· {e.categoryIds.map((id) => examCatalogEntry(id)?.label ?? id).join("، ")}</span> : null}{superAdmin && <span className="mr-2 text-xs text-teal-800">· ثبت‌کننده: {e.ownerName ?? "نامشخص"}</span>}</span>
                    <span className="text-xs text-slate-500">
                      {e.state === "review"
                        ? "آماده بازبینی"
                        : "در انتظار فایل / پردازش"}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || e.state === "processing" || (!!currentUserId && e.ownerId !== currentUserId)}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `آزمون «${e.title}» از فهرست حذف شود؟ سؤال‌های تأییدشده‌ی بانک حفظ می‌شوند.`,
                        )
                      )
                        return;
                      void run(async () => {
                        const response = await fetch(
                          `/api/exam-imports/${e._id}`,
                          { method: "DELETE" },
                        );
                        if (!response.ok)
                          throw new Error(
                            (await response.json()).message ??
                              "حذف آزمون انجام نشد",
                          );
                        await loadList();
                      });
                    }}
                  >
                    حذف آزمون
                  </Button>
                </div>
              )}
            </PagedList>
          </section>
        </>
      ) : currentUserId && exam.ownerId !== currentUserId ? (
        <section className="glass-panel grid gap-4 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold">{exam.title} · {exam.ownerName ?? "کاربر"}</h3>
            <Button type="button" variant="outline" onClick={() => { setExam(null); void loadList(); }}>بازگشت به فهرست</Button>
          </div>
          <p className="text-sm text-slate-600">نمایش مدیریتی فقط برای مشاهده است. ویرایش، تأیید و حذف سؤال‌های دیگر کاربران از این صفحه مجاز نیست.</p>
          <div className="flex flex-wrap gap-2">
            {exam.files?.question && <a className="rounded-xl border p-3 text-sm" href={`/api/exam-imports/${exam._id}/files/question`} target="_blank" rel="noopener noreferrer">مشاهده فایل سؤال</a>}
            {exam.files?.answer && <a className="rounded-xl border p-3 text-sm" href={`/api/exam-imports/${exam._id}/files/answer`} target="_blank" rel="noopener noreferrer">مشاهده فایل پاسخ‌نامه</a>}
          </div>
          {superAdmin && (
            <section className="grid gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
              <div>
                <h4 className="text-sm font-bold text-sky-950">فایل‌های عمومی کنار آزمون</h4>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                  فایل‌های منتشرشده در فهرست آزمون‌ها برای همه کاربران قابل مشاهده و دانلود هستند.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {exam.publicFiles?.question
                  ? <a className="rounded-lg border bg-white px-3 py-2 text-blue-900 underline" href={`/api/pdf-library/${exam.publicFiles.question.id}/file`} target="_blank" rel="noopener noreferrer">دفترچه PDF منتشرشده</a>
                  : <span className="rounded-lg bg-white px-3 py-2 text-slate-500">دفترچه منتشر نشده</span>}
                {exam.publicFiles?.answer
                  ? <a className="rounded-lg border bg-white px-3 py-2 text-emerald-900 underline" href={`/api/pdf-library/${exam.publicFiles.answer.id}/file`} target="_blank" rel="noopener noreferrer">کلید پاسخ منتشرشده</a>
                  : <span className="rounded-lg bg-white px-3 py-2 text-slate-500">کلید پاسخ منتشر نشده</span>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={busy || (!hasPublicFiles && !canPublishPublicFiles)}
                  variant={hasPublicFiles ? "outline" : "default"}
                  onClick={() => void setPublicFiles(!hasPublicFiles)}>
                  {hasPublicFiles ? "برداشتن انتشار عمومی فایل‌ها" : "انتشار عمومی فایل‌های موجود"}
                </Button>
                {!hasPublicFiles && !canPublishPublicFiles && (
                  <span className="text-xs text-slate-600">
                    برای انتشار، آزمون باید بازبینی شده باشد، دسته‌بندی داشته باشد و PDF دفترچه هنوز موجود باشد.
                  </span>
                )}
              </div>
            </section>
          )}
          <p className="text-sm">تعداد سؤال‌های استخراج‌شده: {fa(exam.items.length)}</p>
          {exam.items.map((item) => <article key={item._id} className="rounded-xl border p-4">
            <p className="text-xs text-slate-500">{item.state === "approved" ? "تأییدشده" : item.state === "pending" ? "در انتظار تأیید" : "ردشده"}</p>
            <QuestionPresentation statement={item.question.statement} options={item.question.type === "choice" ? item.question.options : undefined} visuals={item.question.visuals} />
          </article>)}
        </section>
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
                  if (!embedded) history.replaceState(null, "", "/exam-import");
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
                      accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
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
            {superAdmin && (
            <section className="grid gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
              <div>
                <h4 className="text-sm font-bold text-sky-950">فایل‌های عمومی کنار آزمون</h4>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                  فایل‌های منتشرشده در فهرست آزمون‌ها برای همه کاربران قابل مشاهده و دانلود هستند.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {exam.publicFiles?.question
                  ? <a className="rounded-lg border bg-white px-3 py-2 text-blue-900 underline" href={`/api/pdf-library/${exam.publicFiles.question.id}/file`} target="_blank" rel="noopener noreferrer">دفترچه PDF منتشرشده</a>
                  : <span className="rounded-lg bg-white px-3 py-2 text-slate-500">دفترچه منتشر نشده</span>}
                {exam.publicFiles?.answer
                  ? <a className="rounded-lg border bg-white px-3 py-2 text-emerald-900 underline" href={`/api/pdf-library/${exam.publicFiles.answer.id}/file`} target="_blank" rel="noopener noreferrer">کلید پاسخ منتشرشده</a>
                  : <span className="rounded-lg bg-white px-3 py-2 text-slate-500">کلید پاسخ منتشر نشده</span>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={busy || (!hasPublicFiles && !canPublishPublicFiles)}
                  variant={hasPublicFiles ? "outline" : "default"}
                  onClick={() => void setPublicFiles(!hasPublicFiles)}>
                  {hasPublicFiles ? "برداشتن انتشار عمومی فایل‌ها" : "انتشار عمومی PDF و کلید"}
                </Button>
                {!hasPublicFiles && !canPublishPublicFiles && (
                  <span className="text-xs text-slate-600">
                    برای انتشار، آزمون باید بازبینی شده باشد، دسته‌بندی داشته باشد و PDF دفترچه هنوز موجود باشد.
                  </span>
                )}
              </div>
            </section>
          )}
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
                {exam.job?.stage === "queued" || !exam.job?.stage
                  ? "در انتظار worker؛ پردازش هنوز شروع نشده است."
                  : `مرحله‌ی پردازش: ${exam.job.stage}`}
                {exam.job?.processedPage
                  ? ` · ${fa(exam.job.processedPage)} صفحه پردازش شده${exam.job.totalPages ? ` از ${fa(exam.job.totalPages)}` : ""}`
                  : ""}
                {Boolean(exam.job?.totalPages) && (
                  <div className="mt-3">
                    <progress
                      className="w-full"
                      max={exam.job!.totalPages}
                      value={exam.job?.processedPage ?? 0}
                      aria-label="پیشرفت پردازش صفحات فایل جاری"
                    />
                    <p>
                      پیشرفت فایل جاری:{" "}
                      {fa(
                        Math.round(
                          (100 * (exam.job?.processedPage ?? 0)) /
                            exam.job!.totalPages!,
                        ),
                      )}
                      ٪
                    </p>
                  </div>
                )}
                <p>
                  پیشرفت ذخیره می‌شود و بعد از تازه‌سازی باقی می‌ماند. اگر وضعیت
                  در صف باقی ماند، worker را با دستور npm run worker:exams در
                  ترمینال جدا اجرا کنید.
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
              <section className="grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4" aria-label="پیشرفت خودکار ورود سؤال‌های آزمون">
                <p className="text-sm font-bold text-sky-950">
                  {importProgress.expectedQuestionCount === null
                    ? `${fa(importProgress.approved)} سؤال واردشده · تعداد کل هنوز مشخص نیست`
                    : `${fa(importProgress.approved)} از ${fa(importProgress.expectedQuestionCount)} سؤال واردشده (${fa(importProgress.percent ?? 0)}٪)`}
                </p>
                {importProgress.expectedQuestionCount !== null && (
                  <div role="progressbar" aria-label="درصد سؤال‌های واردشده" aria-valuemin={0}
                    aria-valuemax={importProgress.expectedQuestionCount}
                    aria-valuenow={Math.min(importProgress.approved, importProgress.expectedQuestionCount)}
                    className="h-2.5 overflow-hidden rounded-full bg-white">
                    <div className={`h-full rounded-full ${importProgress.status === "complete" ? "bg-emerald-600" : "bg-sky-700"}`}
                      style={{ width: `${importProgress.percent ?? 0}%` }} />
                  </div>
                )}
                <p className="text-xs leading-6 text-slate-600">
                  شمار سؤال‌های واردشده بر اساس سؤال‌های یکتای تأییدشده در بانک است، نه OCR.
                  {importProgress.expectedCountConfidence === "key_complete"
                    ? " تعداد کل از کلید شماره‌دار پاسخ‌نامه به‌صورت خودکار محاسبه شده است."
                    : importProgress.expectedCountConfidence === "numbering_estimate"
                      ? " تعداد کل از شماره‌گذاری یا آرشیو پاسخ‌ها برآورد شده؛ تیک کامل قطعی صادر نمی‌شود."
                      : " برای تشخیص تعداد کل، دفترچه کامل و ترجیحاً پاسخ‌نامه شماره‌دار لازم است."}
                </p>
              </section>
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
            {exam.statistics?.keyWarnings.map((w, i) => (
              <p key={`${w}-${i}`} className="text-sm text-amber-800">
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
              <div
                role={exam.statistics?.failedPages?.length ? "alert" : "status"}
                className="rounded-xl bg-amber-50 p-4 text-sm leading-8 text-amber-900"
              >
                {!!exam.statistics?.failedPages?.length && (
                  <strong className="block">
                    استخراج ناقص — صفحات سالم آماده‌ی بازبینی‌اند
                  </strong>
                )}
                <p>{exam.extractionNotice}</p>
                {!!exam.statistics?.failedPages?.length && (
                  <a
                    className="underline underline-offset-4"
                    href="#manual-exam-question"
                  >
                    افزودن دستی سؤال‌های صفحات خوانده‌نشده
                  </a>
                )}
              </div>
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
                    e.stopPropagation();
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
                      id="manual-exam-question"
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
                    متن، شکل، گزینه و کلید همه‌ی موارد انتخاب‌شده را بررسی
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
                      sourcePages={exam.sourcePages ?? []}
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
  sourcePages,
  item,
  selected,
  onSelected,
  index,
  nodes,
  busy,
  review,
}: {
  sourcePages: { page: number }[];
  item: ExamImportItem;
  selected: boolean;
  onSelected: (value: boolean) => void;
  index: number;
  nodes: Node[];
  busy: boolean;
  review: (body: unknown) => Promise<void>;
}) {
  const [sourceZoom, setSourceZoom] = useState(false);
  const [sourcePage, setSourcePage] = useState(
    String(item.extraction?.regions[0]?.page ?? sourcePages[0]?.page ?? 1),
  );
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [cropSource, setCropSource] = useState(false);
  const [q, setQ] = useState(() => normalizeQuestionTextFields(item.question)),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState(""),
    [originalNumber, setOriginalNumber] = useState(
      item.originalNumber ? String(item.originalNumber) : "",
    );
  const reviewErrors: string[] = [];
  if (q.statement.trim().length < 3)
    reviewErrors.push("صورت سؤال را کامل کنید.");
  if (!q.reference.trim()) reviewErrors.push("پاسخ مرجع را وارد کنید.");
  if (q.classification === "topic" && !q.topicId)
    reviewErrors.push("مبحث درسی را انتخاب کنید یا اتصال به مبحث را بردارید.");
  if (q.type === "choice") {
    if (q.options.length < 2 || q.options.some((option) => !option.trim()))
      reviewErrors.push(
        "حداقل دو گزینه بنویسید؛ هر خط یک گزینه و بدون خط خالی.",
      );
    if (q.reference.trim() && !q.options.includes(q.reference))
      reviewErrors.push(
        "پاسخ مرجع باید دقیقاً متن یکی از گزینه‌ها باشد، نه شماره‌ی گزینه.",
      );
  }
  const visualValidation = questionVisualsSchema.safeParse(q.visuals ?? []);
  if (!visualValidation.success)
    reviewErrors.push(
      "تصویر یا شکل سؤال نامعتبر است؛ در بخش اصلاح شکل، آن را اصلاح یا حذف کنید.",
    );
  const valid = reviewErrors.length === 0;
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
            {item.extraction.warnings.map((w, i) => (
              <p
                key={`${w}-${i}`}
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
            e.stopPropagation();
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
          <Field title="دسترسی سؤال">
            <select
              className={style}
              value={q.visibility ?? "private"}
              onChange={(e) => {
                setQ({
                  ...q,
                  visibility: e.target.value as "private" | "public",
                });
                setConfirmed(false);
              }}
            >
              <option value="private">خصوصی</option>
              <option value="public">عمومی برای همه‌ی دانش‌آموزان</option>
            </select>
          </Field>
          <Field
            title={`صورت سؤال ${index + 1} · فرمول‌ها با LaTeX داخل $...$`}
          >
            <QuestionTextInput
              required
              minLength={3}
              maxLength={5000}
              className={`${style} min-h-28`}
              value={q.statement}
              onChange={(statement) => {
                setQ({ ...q, statement });
                setConfirmed(false);
              }}
            />
            <p className="mt-2 text-xs leading-6 text-slate-500">
              نمونه: <code dir="ltr">$\sqrt&#123;2&#125;$</code> یا{" "}
              <code dir="ltr">$\frac&#123;a&#125;&#123;b&#125;$</code>؛ نتیجه در
              پیش‌نمایش پایین نمایش داده می‌شود.
            </p>
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
            <Field
              title={`گزینه‌های سؤال ${index + 1} · هر خط یک گزینه؛ فرمول با LaTeX داخل $...$`}
            >
              <textarea
                className={style}
                value={q.options.join("\n")}
                onChange={(e) => {
                  setQ({
                    ...q,
                    options: e.target.value.split("\n"),
                  });
                  setConfirmed(false);
                }}
              />
              <p className="mt-2 text-xs leading-6 text-slate-500">
                نمونه‌ی گزینه‌ی فرمولی:{" "}
                <code dir="ltr">$x^2+\sqrt&#123;3&#125;$</code>. نمایش نهایی هر
                گزینه در پیش‌نمایش پایین دیده می‌شود.
              </p>
            </Field>
          )}
          <Field title={`پاسخ مرجع سؤال ${index + 1}`}>
            {q.type === "choice" ? (
              <select
                required
                className={style}
                value={q.options.includes(q.reference) ? q.reference : ""}
                onChange={(e) => {
                  setQ({ ...q, reference: e.target.value });
                  setConfirmed(false);
                }}
              >
                <option value="">گزینه‌ی صحیح را انتخاب کنید</option>
                {q.options.map(
                  (option, optionIndex) =>
                    option.trim() && (
                      <option key={optionIndex} value={option}>
                        گزینه‌ی {fa(optionIndex + 1)}
                      </option>
                    ),
                )}
              </select>
            ) : (
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
            )}
          </Field>
          <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">
            سختی این سؤال پس از ثبت پاسخ واقعی دانش‌آموزان، از صفر تا صد محاسبه
            می‌شود.
          </p>
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
          <details open={cropSource || undefined}>
            <summary className="cursor-pointer text-sm text-[#233B8F]">
              افزودن یا اصلاح نمودار، شکل و فرمول
            </summary>
            <div className="mt-3 grid gap-3">
              <p className="text-xs leading-6 text-slate-600">
                برای شکل پیچیده، تصویر اصلی را نگه دارید. اگر برش ناقص است، صفحه
                اصلی را انتخاب و تصویر را دوباره کراپ کنید؛ متن و گزینه‌ها تغییر
                نمی‌کنند.
              </p>
              {sourcePages.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <Field title="صفحه اصلی PDF">
                    <select
                      className={style}
                      value={sourcePage}
                      disabled={busy || imageBusy}
                      onChange={(e) => setSourcePage(e.target.value)}
                    >
                      {sourcePages.map(({ page }) => (
                        <option key={page} value={page}>
                          صفحه {fa(page)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    type="button"
                    disabled={busy || imageBusy}
                    onClick={async () => {
                      setImageBusy(true);
                      setImageError("");
                      try {
                        const visual = await api<QuestionVisual>(
                          `/exam-imports/${item.examId}/items/${item._id}/source-image`,
                          { page: Number(sourcePage) },
                        );
                        setQ((current) => {
                          const visuals = [...(current.visuals ?? [])];
                          const index = visuals.findIndex(
                            (v) => v.kind === "image",
                          );
                          if (index >= 0) visuals[index] = visual;
                          else if (visuals.length < 3) visuals.push(visual);

                          return { ...current, visuals };
                        });
                        setConfirmed(false);
                        setCropSource(true);
                      } catch (error) {
                        setImageError(
                          error instanceof Error
                            ? error.message
                            : "دریافت تصویر ناموفق بود",
                        );
                      } finally {
                        setImageBusy(false);
                      }
                    }}
                  >
                    {imageBusy
                      ? "دریافت تصویر…"
                      : "جایگزینی تصویر اول از صفحه اصلی"}
                  </Button>
                </div>
              )}
              {imageError && (
                <p role="alert" className="text-sm text-rose-700">
                  {imageError}
                </p>
              )}
              <VisualEditor
                key={
                  cropSource
                    ? q.visuals?.find((v) => v.kind === "image")?.assetId
                    : "original"
                }
                cropOpen={cropSource}
                value={q.visuals ?? []}
                disabled={busy}
                onChange={(visuals) => {
                  setQ({ ...q, visuals });
                  setConfirmed(false);
                }}
              />
              {(q.visuals ?? []).some((visual) => visual.kind === "image") && (
                <Field title="جای شکل کنار متن تایپ‌شده">
                  <select
                    className={style}
                    value={q.visualLayout ?? "below"}
                    disabled={busy}
                    onChange={(e) => {
                      setQ({
                        ...q,
                        visualLayout: e.target.value as "below" | "beside",
                      });
                      setConfirmed(false);
                    }}
                  >
                    <option value="below">زیر متن سؤال</option>
                    <option value="beside">کنار متن سؤال</option>
                  </select>
                </Field>
              )}
            </div>
          </details>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-3 text-xs text-slate-500">پیش‌نمایش دانش‌آموز</p>
            <QuestionPresentation
              statement={q.statement}
              visuals={q.visuals}
              visualLayout={q.visualLayout}
              options={q.type === "choice" ? q.options : undefined}
            />
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
          {reviewErrors.length > 0 && (
            <div
              aria-live="polite"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900"
            >
              <p>برای فعال‌شدن تأیید:</p>
              <ul className="list-inside list-disc">
                {reviewErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {!confirmed && (
            <p className="text-sm text-slate-600">
              پس از تکمیل اطلاعات، تیک تطبیق با PDF را بزنید.
            </p>
          )}
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
