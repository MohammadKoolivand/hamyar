"use client";
import { MultiFilter } from "@/components/ui/multi-filter";
import { ExamImportScreen } from "./exam-import-screen";
import { DifficultyGauge } from "@/components/ui/difficulty-gauge";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PagedList } from "@/components/ui/paged-list";
import { QuestionPresentation } from "@/components/question-presentation";
import {
  sourceCategories,
  sourceCategory,
  sourceSummary,
} from "@/lib/question-source";
import { MAX_MISSION_QUESTIONS } from "@/lib/mission-limits";
import { api } from "@/lib/api";
import { difficultyLabels } from "@/lib/difficulty";
import { fa } from "@/lib/presentation";
import type { Question, Node } from "@/lib/types";

const types = {
  choice: "چندگزینه‌ای",
  numeric: "عددی",
  short: "پاسخ کوتاه",
  essay: "تشریحی",
  symbolic: "عبارت و معادله",
};
export function QuestionPicker({
  questions,
  selected,
  onChange,
  disabled = false,
  onRefresh,
}: {
  questions: Question[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [quotas, setQuotas] = useState({ easy: 0, medium: 20, hard: 0 });
  const automatic = useRef<HTMLDialogElement>(null);
  const importer = useRef<HTMLDialogElement>(null);
  const [importNodes, setImportNodes] = useState<Node[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [collection, setCollection] = useState<string[]>([]);
  const [guided, setGuided] = useState(false);
  const [preview, setPreview] = useState<Question>();
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const collectionKey = (q: Question) =>
    q.source?.sourceUrl || q.source?.sourceTitle || "";
  const scoped = questions.filter(
    (q) =>
      (!category.length || category.includes(sourceCategory(q.source))) &&
      (!type.length || type.includes(q.type)),
  );
  const collections = [
    ...new Map(
      scoped
        .filter((q) => collectionKey(q))
        .map((q) => [
          collectionKey(q),
          q.source?.sourceTitle || sourceSummary(q.source),
        ]),
    ).entries(),
  ];
  const visible = scoped.filter(
    (q) =>
      (!collection.length || collection.includes(collectionKey(q))) &&
      (!guided || (!!q.hints?.length && !!q.skillIds?.length)) &&
      `${q.statement} ${q.source?.sourceTitle ?? ""}`.includes(search.trim()),
  );
  const select = (ids: string[]) => {
    const unique = [...new Set(ids)];
    if (unique.length > MAX_MISSION_QUESTIONS) {
      setError(
        `هر مأموریت حداکثر ${fa(MAX_MISSION_QUESTIONS)} سؤال می‌پذیرد؛ مجموعه را با فیلتر محدود کنید.`,
      );
      return false;
    }
    setError("");
    onChange(unique);
    return true;
  };
  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);
  return (
    <div
      className="grid min-w-0 gap-4"
      role="group"
      aria-label="انتخاب سؤال‌های مأموریت"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <MultiFilter
          label="دسته‌بندی سؤال برای مأموریت"
          disabled={disabled}
          value={category}
          onChange={(v) => {
            setCategory(v);
            setCollection([]);
          }}
          options={[
            ...sourceCategories.map((c): [string, string] => [c.id, c.label]),
            ["unknown", "دسته‌بندی‌نشده"],
          ]}
        />
        <MultiFilter
          label="نوع سؤال برای مأموریت"
          disabled={disabled}
          value={type}
          onChange={(v) => {
            setType(v);
            setCollection([]);
          }}
          options={Object.entries(types)}
        />
        <MultiFilter
          label="منابع / مجموعه‌ها"
          disabled={disabled}
          value={collection}
          onChange={setCollection}
          options={collections}
        />
        <Field title="جست‌وجوی سؤال برای مأموریت">
          <input
            className="glass-field min-h-11 w-full p-3"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={disabled || selecting}
          onClick={() => automatic.current?.showModal()}
        >
          انتخاب خودکار با تعداد و سختی
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={async () => {
            try {
              setImportNodes(await api<Node[]>("/curriculum"));
              importer.current?.showModal();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          افزودن سؤال از PDF یا عکس
        </Button>
      </div>
      <dialog
        ref={automatic}
        className="m-auto max-h-[85dvh] w-[min(560px,94vw)] overflow-y-auto rounded-3xl border border-blue-100 bg-white p-5 text-[#1F2937] shadow-2xl backdrop:bg-slate-900/30"
        aria-label="تنظیم انتخاب خودکار"
      >
        <div dir="rtl" className="grid gap-4">
          <div className="flex justify-between gap-3">
            <h3 className="font-bold">ترکیب سؤال‌های مأموریت</h3>
            <Button
              type="button"
              variant="outline"
              onClick={() => automatic.current?.close()}
            >
              بستن
            </Button>
          </div>
          <p className="text-sm text-slate-600">
            از منابع و دسته‌های انتخاب‌شده در فیلترهای همین صفحه، بدون تکرار
            انتخاب می‌شود.
          </p>
          {Object.entries(difficultyLabels).map(([key, label]) => (
            <Field title={`تعداد سؤال ${label}`} key={key}>
              <input
                type="number"
                min={0}
                max={MAX_MISSION_QUESTIONS}
                className="glass-field min-h-11 w-full p-3"
                value={quotas[key as keyof typeof quotas]}
                onChange={(e) =>
                  setQuotas({ ...quotas, [key]: Number(e.target.value) })
                }
              />
            </Field>
          ))}
          <p className="text-sm">
            جمع: {fa(Object.values(quotas).reduce((a, b) => a + b, 0))} سؤال ·
            سقف {fa(MAX_MISSION_QUESTIONS)}
          </p>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <Button
            type="button"
            disabled={disabled || selecting || !visible.length}
            onClick={async () => {
              setSelecting(true);
              setError("");
              try {
                const result = await api<{ questionVersionIds: string[] }>(
                  "/questions/select",
                  { candidateIds: visible.map((q) => q._id), quotas },
                );
                if (select(result.questionVersionIds))
                  automatic.current?.close();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setSelecting(false);
              }
            }}
          >
            {selecting
              ? "در حال انتخاب…"
              : "اعمال ترکیب و جایگزینی انتخاب فعلی"}
          </Button>
        </div>
      </dialog>
      {mounted &&
        createPortal(
          <dialog
            ref={importer}
            className="m-auto max-h-[92dvh] w-[min(1100px,96vw)] overflow-y-auto rounded-3xl border border-blue-100 bg-[#F8FAFC] p-4 text-[#1F2937] shadow-2xl backdrop:bg-slate-900/30"
            aria-label="ورود فایل برای مأموریت"
          >
            <div dir="rtl" className="grid gap-4">
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                onClick={() => importer.current?.close()}
              >
                بازگشت به مأموریت
              </Button>
              <ExamImportScreen
                embedded
                nodes={importNodes}
                onApproved={async () => {
                  await onRefresh?.();
                }}
                onUseQuestions={async (ids) => {
                  await onRefresh?.();
                  if (select([...selected, ...ids])) importer.current?.close();
                }}
              />
            </div>
          </dialog>,
          document.body,
        )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={guided}
          onChange={(e) => setGuided(e.target.checked)}
        />
        فقط سؤال‌های دارای راهنما و مهارت
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !visible.length}
          onClick={() => select([...selected, ...visible.map((q) => q._id)])}
        >
          افزودن کل مجموعه ({fa(visible.length)} سؤال)
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !selected.length}
          onClick={() => select([])}
        >
          پاک‌کردن انتخاب‌ها
        </Button>
        <span className="text-sm text-teal-700" role="status">
          {fa(selected.length)} سؤال انتخاب شده
        </span>
      </div>
      <p className="text-xs leading-6 text-slate-500">
        افزودن کل مجموعه، همهٔ نتایج فیلتر فعلی در تمام صفحه‌ها را اضافه می‌کند؛
        انتخاب‌های قبلی حفظ می‌شوند.
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {!visible.length && (
        <p className="text-sm text-slate-500">سؤالی با این فیلتر پیدا نشد.</p>
      )}
      <PagedList items={visible} label="انتخاب سؤال" pageSize={10}>
        {(q) => (
          <div
            key={q._id}
            className="glass-option flex min-w-0 flex-wrap items-center gap-3 p-3"
          >
            <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(q._id)}
                onChange={(e) =>
                  select(
                    e.target.checked
                      ? [...selected, q._id]
                      : selected.filter((id) => id !== q._id),
                  )
                }
                className="size-5 shrink-0 accent-[#233B8F]"
              />
              <span className="min-w-0">
                <span className="line-clamp-2">{q.statement}</span>
                <span className="text-xs text-teal-700">
                  <DifficultyGauge value={q.difficulty} />
                  {q.difficultyAssessment?.needsReview ? " · برآورد اولیه" : ""}
                </span>
              </span>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreview(q)}
              aria-label={`مشاهده سؤال ${q.statement.slice(0, 60)}`}
            >
              <Eye size={16} />
              مشاهده
            </Button>
          </div>
        )}
      </PagedList>
      <dialog
        ref={dialog}
        onCancel={() => setPreview(undefined)}
        onClose={() => setPreview(undefined)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPreview(undefined);
        }}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[min(900px,94vw)] overflow-y-auto rounded-3xl border border-blue-100 bg-white/95 p-5 text-[#1F2937] shadow-2xl backdrop:bg-slate-900/30 backdrop:backdrop-blur-sm"
        aria-labelledby="question-preview-title"
      >
        {preview && (
          <div className="grid gap-4" dir="rtl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="question-preview-title" className="font-bold">
                مشاهده سؤال
              </h3>
              <Button
                type="button"
                variant="outline"
                aria-label="بستن مشاهده سؤال"
                onClick={() => setPreview(undefined)}
              >
                <X size={18} />
              </Button>
            </div>
            <p className="text-xs text-teal-700">
              {sourceSummary(preview.source)}
            </p>
            <QuestionPresentation
              statement={preview.statement}
              visuals={preview.visuals}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {preview.options.map((option, i) => (
                <p key={i} className="glass-option p-3 text-sm">
                  {fa(i + 1)}. {option}
                </p>
              ))}
            </div>
            <Button
              type="button"
              disabled={disabled}
              onClick={() =>
                select(
                  selected.includes(preview._id)
                    ? selected.filter((id) => id !== preview._id)
                    : [...selected, preview._id],
                )
              }
            >
              {selected.includes(preview._id)
                ? "حذف از مأموریت"
                : "افزودن به مأموریت"}
            </Button>
          </div>
        )}
      </dialog>
    </div>
  );
}
