"use client";
import { Field } from "@/components/ui/field";
import {
  initialSource,
  sourceCategory,
  sourceCategories,
  sourceFields,
  type QuestionSource,
} from "@/lib/question-source";
const style = "glass-field min-h-11 w-full min-w-0 p-3 text-sm";
export function SourceEditor({
  value,
  onChange,
  disabled = false,
  hideQuestionNumber = false,
  compact = false,
}: {
  value?: QuestionSource;
  onChange: (value: QuestionSource | undefined) => void;
  disabled?: boolean;
  hideQuestionNumber?: boolean;
  compact?: boolean;
}) {
  const category = sourceCategory(value);
  function update(key: keyof QuestionSource, text: string) {
    if (!value) return;
    const next = { ...value };
    if (!text.trim()) delete next[key];
    else
      Object.assign(next, {
        [key]:
          key === "questionNumber" || key === "sourcePage"
            ? Number(text)
            : text,
      });
    onChange(next);
  }
  return (
    <fieldset
      disabled={disabled}
      className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
    >
      <legend className="px-2 text-sm font-bold text-slate-700">
        منبع و نوع آزمون
      </legend>
      <Field title="دسته‌بندی آزمون / منبع">
        <select
          className={style}
          value={category}
          onChange={(e) => onChange(initialSource(e.target.value))}
        >
          <option value="unknown">دسته‌بندی نشده</option>
          {sourceCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      {value && (
        <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {sourceFields
              .filter(
                (f) =>
                  f.categories.includes(category) && (!compact || f.options),
              )
              .map((f) => (
                <Field key={f.key} title={f.label}>
                  {f.options ? (
                    <select
                      className={style}
                      value={String(value[f.key] ?? "")}
                      onChange={(e) => update(f.key, e.target.value)}
                    >
                      <option value="">تعیین نشده</option>
                      {f.options.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={style}
                      maxLength={
                        f.key === "academicYear"
                          ? 30
                          : f.key === "organizer" || f.key === "subject"
                            ? 150
                            : 100
                      }
                      value={String(value[f.key] ?? "")}
                      placeholder={f.placeholder}
                      onChange={(e) => update(f.key, e.target.value)}
                    />
                  )}
                </Field>
              ))}
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-[#233B8F]">
              مشخصات منبع و دفترچه (اختیاری)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {" "}
              {compact &&
                sourceFields
                  .filter((f) => f.categories.includes(category) && !f.options)
                  .map((f) => (
                    <Field key={f.key} title={f.label}>
                      <input
                        className={style}
                        maxLength={
                          f.key === "academicYear"
                            ? 30
                            : f.key === "organizer" || f.key === "subject"
                              ? 150
                              : 100
                        }
                        value={String(value[f.key] ?? "")}
                        placeholder={f.placeholder}
                        onChange={(e) => update(f.key, e.target.value)}
                      />
                    </Field>
                  ))}
              {[
                ["sourceTitle", "عنوان منبع"],
                ["sourceUrl", "لینک صفحه منبع"],
                ["bookletCode", "کد دفترچه"],
                ["questionNumber", "شماره سؤال در منبع"],
                ["examDate", "تاریخ آزمون (مثال 1405/08/01)"],
                ["publishedDate", "تاریخ انتشار منبع (میلادی)"],
                ["sourcePageUrl", "صفحهٔ معرفی منبع"],
                ["sourcePage", "شماره صفحه در PDF"],
              ]
                .filter(
                  ([key]) => !hideQuestionNumber || key !== "questionNumber",
                )
                .map(([key, label]) => (
                  <Field key={key} title={label}>
                    <input
                      className={style}
                      type={
                        key === "questionNumber" || key === "sourcePage"
                          ? "number"
                          : key === "sourceUrl" || key === "sourcePageUrl"
                            ? "url"
                            : key === "publishedDate"
                              ? "date"
                              : "text"
                      }
                      min={
                        key === "questionNumber" || key === "sourcePage"
                          ? 1
                          : undefined
                      }
                      max={
                        key === "questionNumber" || key === "sourcePage"
                          ? 10000
                          : undefined
                      }
                      maxLength={
                        key === "sourceUrl" || key === "sourcePageUrl"
                          ? 1500
                          : key === "bookletCode"
                            ? 80
                            : 200
                      }
                      value={String(value[key as keyof QuestionSource] ?? "")}
                      onChange={(e) =>
                        update(key as keyof QuestionSource, e.target.value)
                      }
                    />
                  </Field>
                ))}
            </div>
          </details>
          <p className="text-xs leading-6 text-slate-500">
            سال آزمون را در «سال سؤال» وارد کنید. ثبت دسته یا لینک منبع، تأیید
            رسمی‌بودن سؤال نیست؛ سؤال تألیفی یا تولید هوش مصنوعی را عین سؤال
            رسمی معرفی نکنید.
          </p>
        </>
      )}
    </fieldset>
  );
}
