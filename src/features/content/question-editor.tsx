"use client";
import { useEffect, useRef, useState } from "react";
import type { QuestionInput } from "@/server/domain";
import { normalizeQuestionTextFields } from "@/lib/persian-question-text";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  MathText,
  QuestionPresentation,
} from "@/components/question-presentation";
import { QuestionTextInput } from "@/components/question-text-input";
import { VisualEditor } from "./visual-editor";
import { TopicSelector } from "./topic-selector";
import type { Node } from "@/lib/types";
const style = "glass-field min-h-11 w-full p-3 text-sm";
export function QuestionEditor({
  versionId,
  nodes,
  cropOpen = false,
  onClose,
  onSaved,
}: {
  versionId: string;
  nodes: Node[];
  cropOpen?: boolean;
  onClose: () => void;
  onSaved: () => Promise<unknown> | void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState<QuestionInput>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const examQuestion = Boolean(
    value &&
    ((value as QuestionInput & { origin?: string; originalOrigin?: string })
      .origin === "exam_import_reviewed" ||
      (
        value as QuestionInput & {
          origin?: string;
          originalOrigin?: string;
        }
      ).originalOrigin === "exam_import_reviewed"),
  );
  const change = (next: QuestionInput) => {
    setValue(next);
    setDirty(true);
  };
  const close = () => {
    if (
      !busy &&
      (!dirty ||
        saved ||
        window.confirm("تغییرات ذخیره نشده کنار گذاشته شوند؟"))
    )
      onClose();
  };
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    api<QuestionInput>(`/questions/${versionId}`)
      .then((v) => {
        if (active) setValue(normalizeQuestionTextFields(v));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [versionId]);
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="question-editor-title"
      dir="rtl"
      className="fixed inset-0 m-auto max-h-[92dvh] w-[min(960px,95vw)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-slate-900/40 sm:p-8"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="question-editor-title" className="text-xl font-bold">
          ویرایش سؤال
        </h2>
        <Button type="button" variant="outline" disabled={busy} onClick={close}>
          بستن
        </Button>
      </div>
      <p className="mb-5 text-sm leading-7 text-slate-500">
        گزینه‌ها را در کادرهای جدا وارد کن؛ فرمول LaTeX را داخل $...$ بنویس تا
        پیش‌نمایشش را ببینی. برای حذف عکس، در بخش «نمودار، شکل و فرمول سؤال» روی
        «حذف این محتوای سؤال» بزن. نسخهٔ جدید در بانک سؤال ذخیره می‌شود.
        تمرین‌های قبلی نسخهٔ قبلی را حفظ می‌کنند. پس از تغییر گزینه‌ها، پاسخ
        صحیح و راهنماها را دوباره بررسی کنید.
      </p>
      {error && (
        <p
          role="alert"
          className="my-3 rounded-xl bg-rose-50 p-3 text-rose-700"
        >
          {error}
        </p>
      )}
      {!value && !error && <p role="status">در حال دریافت سؤال…</p>}
      {saved ? (
        <div role="status" className="rounded-xl bg-teal-50 p-4">
          نسخهٔ جدید ذخیره شد.
          <Button
            type="button"
            onClick={async () => {
              try {
                await onSaved();
                onClose();
              } catch {
                setError("ذخیره انجام شد؛ برای دریافت فهرست دوباره تلاش کنید.");
              }
            }}
          >
            بازگشت به بانک سؤال
          </Button>
        </div>
      ) : (
        value && (
          <form
            className="grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api(`/questions/${versionId}/revise`, value);
                setSaved(true);
                setDirty(false);
                await onSaved();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "ذخیره انجام نشد");
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="grid min-w-0 gap-5">
              <Field title="متن سؤال">
                <QuestionTextInput
                  required
                  minLength={3}
                  maxLength={5000}
                  rows={5}
                  className={style}
                  value={value.statement}
                  onChange={(statement) => change({ ...value, statement })}
                />
              </Field>
              <section className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.classification !== "free"}
                    onChange={(e) =>
                      change({
                        ...value,
                        classification: e.target.checked ? "topic" : "free",
                        topicId: undefined,
                        skillIds: [],
                      })
                    }
                  />
                  اتصال این سؤال به مبحث درسی
                </label>
                {value.classification !== "free" && (
                  <TopicSelector
                    nodes={nodes}
                    context="ویرایش سؤال"
                    topicLabel="مبحث درسی سؤال"
                    value={value.topicId ?? ""}
                    onChange={(topicId) =>
                      change({
                        ...value,
                        classification: "topic",
                        topicId: topicId || undefined,
                        skillIds: [],
                      })
                    }
                  />
                )}
              </section>
              <div className="grid gap-4 sm:grid-cols-2">
                {examQuestion ? (
                  <p className="self-end rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                    درجه سختی: تعیین نشده؛ پس از پاسخ واقعی دانش‌آموزان محاسبه
                    می‌شود.
                  </p>
                ) : (
                  <Field title="درجه سختی">
                    <select
                      className={style}
                      value={value.difficulty ?? ""}
                      onChange={(e) =>
                        change({
                          ...value,
                          difficulty: (e.target.value ||
                            undefined) as QuestionInput["difficulty"],
                        })
                      }
                    >
                      <option value="">تعیین نشده</option>
                      <option value="easy">آسان</option>
                      <option value="medium">متوسط</option>
                      <option value="hard">سخت</option>
                    </select>
                  </Field>
                )}
                <Field title="سال سؤال">
                  <input
                    className={style}
                    type="number"
                    min={1300}
                    max={1500}
                    value={value.year ?? ""}
                    onChange={(e) =>
                      change({
                        ...value,
                        year: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </Field>
              </div>
              {value.type === "choice" ? (
                <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                  <legend>گزینه‌ها و پاسخ صحیح</legend>
                  {value.options.map((option, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Field title={`گزینه ${i + 1}`}>
                        <textarea
                          required
                          maxLength={2000}
                          dir="auto"
                          placeholder={"مثلاً: $\\sqrt{2}$ یا $\\frac{a}{b}$"}
                          className={style}
                          value={option}
                          onChange={(e) =>
                            change({
                              ...value,
                              options: value.options.map((o, j) =>
                                j === i ? e.target.value : o,
                              ),
                              reference:
                                value.reference === option
                                  ? e.target.value
                                  : value.reference,
                            })
                          }
                        />
                        <p className="mt-2 text-xs leading-6 text-slate-500">
                          فرمول را داخل $...$ بنویس؛ نمونه:{" "}
                          <code dir="ltr">
                            $\sqrt{"{"}2{"}"}$
                          </code>
                        </p>
                        {option.trim() && (
                          <div className="rounded-lg bg-slate-50 p-3 text-sm leading-8">
                            <span className="text-xs text-slate-500">
                              پیش‌نمایش:{" "}
                            </span>
                            <MathText text={option} />
                          </div>
                        )}
                      </Field>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="correct-answer"
                          checked={value.reference === option}
                          required
                          onChange={() =>
                            change({ ...value, reference: option })
                          }
                        />
                        پاسخ صحیح
                      </label>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={value.options.length >= 8}
                      onClick={() =>
                        change({ ...value, options: [...value.options, ""] })
                      }
                    >
                      افزودن گزینه
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={value.options.length <= 2}
                      onClick={() => {
                        const options = value.options.slice(0, -1);
                        change({
                          ...value,
                          options,
                          reference: options.includes(value.reference)
                            ? value.reference
                            : "",
                        });
                      }}
                    >
                      حذف آخرین گزینه
                    </Button>
                  </div>
                </fieldset>
              ) : (
                <Field title="پاسخ مرجع">
                  <textarea
                    className={style}
                    required
                    maxLength={2000}
                    value={value.reference}
                    onChange={(e) =>
                      change({ ...value, reference: e.target.value })
                    }
                  />
                </Field>
              )}
              <VisualEditor
                cropOpen={cropOpen}
                value={value.visuals ?? []}
                onChange={(visuals) => change({ ...value, visuals })}
              />
              {(value.visuals ?? []).some(
                (visual) => visual.kind === "image",
              ) && (
                <Field title="جای تصویر نسبت به متن سؤال">
                  <select
                    className={style}
                    value={value.visualLayout ?? "below"}
                    onChange={(e) =>
                      change({
                        ...value,
                        visualLayout: e.target.value as "below" | "beside",
                      })
                    }
                  >
                    <option value="below">زیر متن سؤال</option>
                    <option value="beside">کنار متن سؤال</option>
                  </select>
                </Field>
              )}
              {value.hints.map((hint, i) => (
                <Field key={i} title={`راهنمای ${i + 1}`}>
                  <textarea
                    className={style}
                    required
                    maxLength={1000}
                    value={hint}
                    onChange={(e) =>
                      change({
                        ...value,
                        hints: value.hints.map((h, j) =>
                          i === j ? e.target.value : h,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <section className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
                <h3 className="text-sm font-bold text-[#233B8F]">
                  پیش‌نمایش سؤال برای دانش‌آموز
                </h3>
                <div className="grid gap-4 rounded-2xl border border-blue-200 bg-white/80 p-5">
                  <QuestionPresentation
                    statement={value.statement}
                    visuals={value.visuals}
                    visualLayout={value.visualLayout}
                    options={
                      value.type === "choice" ? value.options : undefined
                    }
                  />
                </div>
              </section>
              <Button type="submit">
                {busy ? "در حال ذخیره…" : "ذخیره نسخه جدید"}
              </Button>
            </fieldset>
          </form>
        )
      )}
    </dialog>
  );
}
