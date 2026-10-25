"use client";
import { useEffect, useRef, useState } from "react";
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
import { fa } from "@/lib/presentation";
import type { Question } from "@/lib/types";

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
}: {
  questions: Question[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [collection, setCollection] = useState("");
  const [guided, setGuided] = useState(false);
  const [preview, setPreview] = useState<Question>();
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const collectionKey = (q: Question) =>
    q.source?.sourceUrl || q.source?.sourceTitle || "";
  const scoped = questions.filter(
    (q) =>
      (!category || sourceCategory(q.source) === category) &&
      (!type || q.type === type),
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
      (!collection || collectionKey(q) === collection) &&
      (!guided || (!!q.hints?.length && !!q.skillIds?.length)) &&
      `${q.statement} ${q.source?.sourceTitle ?? ""}`.includes(search.trim()),
  );
  const select = (ids: string[]) => {
    const unique = [...new Set(ids)];
    if (unique.length > MAX_MISSION_QUESTIONS) {
      setError(
        `هر مأموریت حداکثر ${fa(MAX_MISSION_QUESTIONS)} سؤال می‌پذیرد؛ مجموعه را با فیلتر محدود کنید.`,
      );
      return;
    }
    setError("");
    onChange(unique);
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
        <Field title="دسته‌بندی سؤال برای مأموریت">
          <select
            className="glass-field min-h-11 w-full p-3"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCollection("");
            }}
          >
            <option value="">همه دسته‌ها</option>
            {sourceCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            <option value="unknown">دسته‌بندی‌نشده</option>
          </select>
        </Field>
        <Field title="نوع سؤال برای مأموریت">
          <select
            className="glass-field min-h-11 w-full p-3"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setCollection("");
            }}
          >
            <option value="">همه نوع‌ها</option>
            {Object.entries(types).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field title="مجموعه یا آزمون">
          <select
            className="glass-field min-h-11 w-full p-3"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="">همه مجموعه‌ها</option>
            {collections.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field title="جست‌وجوی سؤال برای مأموریت">
          <input
            className="glass-field min-h-11 w-full p-3"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>
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
              <span className="line-clamp-2 min-w-0">{q.statement}</span>
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
