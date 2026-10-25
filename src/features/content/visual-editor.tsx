"use client";
import { ImageCropEditor } from "./image-crop-editor";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { QuestionVisualView } from "@/components/question-presentation";
import { visualTemplate, type QuestionVisual } from "@/lib/question-visuals";
const style = "glass-field min-h-11 w-full min-w-0 p-2 text-sm";
export function VisualEditor({
  value,
  onChange,
  disabled = false,
  cropOpen = false,
}: {
  value: QuestionVisual[];
  onChange: (v: QuestionVisual[]) => void;
  disabled?: boolean;
  cropOpen?: boolean;
}) {
  const change = (i: number, v: QuestionVisual) =>
    onChange(value.map((old, j) => (i === j ? v : old)));
  const num = (
    title: string,
    n: number,
    set: (n: number) => void,
    min = -1e6,
    max = 1e6,
  ) => (
    <Field title={title}>
      <input
        className={style}
        required
        type="number"
        step="any"
        min={min}
        max={max}
        dir="ltr"
        value={Number.isFinite(n) ? n : ""}
        onChange={(e) =>
          set(e.target.value === "" ? NaN : Number(e.target.value))
        }
      />
    </Field>
  );
  return (
    <fieldset
      disabled={disabled}
      className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 p-4"
    >
      <legend className="px-2 text-sm font-bold">
        نمودار، شکل و فرمول سؤال
      </legend>
      <p className="text-xs leading-6 text-slate-500">
        حداکثر سه مورد. نمونه‌های شروع را مطابق سؤال تغییر دهید؛ پیش‌نمایش همان
        چیزی است که دانش‌آموز خواهد دید.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["chart", "geometry", "formula"] as const).map((kind, i) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            disabled={disabled || value.length >= 3}
            onClick={() => onChange([...value, visualTemplate(kind)])}
          >
            {["افزودن نمودار", "افزودن شکل", "افزودن فرمول"][i]}
          </Button>
        ))}
      </div>
      {value.map((v, i) => (
        <details
          open
          key={i}
          className="min-w-0 rounded-xl border border-slate-200 p-3"
        >
          <summary className="cursor-pointer text-sm font-medium">
            {i + 1}. {v.caption || "محتوای بدون عنوان"}
          </summary>
          <div className="mt-4 grid min-w-0 gap-4">
            <Field title={`عنوان محتوای ${i + 1}`}>
              <input
                className={style}
                required
                minLength={3}
                maxLength={300}
                value={v.caption}
                onChange={(e) => change(i, { ...v, caption: e.target.value })}
              />
            </Field>
            {v.kind === "image" && (
              <ImageCropEditor
                value={v}
                autoOpen={cropOpen}
                onChange={(next) => change(i, next)}
              />
            )}
            {v.kind === "formula" && (
              <>
                <Field title={`فرمول LaTeX ${i + 1}`}>
                  <textarea
                    className={style}
                    required
                    dir="ltr"
                    maxLength={1000}
                    value={v.latex}
                    onChange={(e) => change(i, { ...v, latex: e.target.value })}
                  />
                </Field>
                <p className="text-xs text-slate-500">
                  مثال:{" "}
                  <code dir="ltr">{String.raw`x = \frac{-b + \sqrt{b^2-4ac}}{2a}`}</code>
                </p>
              </>
            )}
            {v.kind === "chart" && (
              <>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <Field title="عنوان محور افقی و واحد">
                    <input
                      className={style}
                      maxLength={100}
                      value={v.xLabel}
                      onChange={(e) =>
                        change(i, { ...v, xLabel: e.target.value })
                      }
                    />
                  </Field>
                  <Field title="عنوان محور عمودی و واحد">
                    <input
                      className={style}
                      maxLength={100}
                      value={v.yLabel}
                      onChange={(e) =>
                        change(i, { ...v, yLabel: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {num("ابتدای محور افقی", v.xRange[0], (n) =>
                    change(i, { ...v, xRange: [n, v.xRange[1]] }),
                  )}
                  {num("انتهای محور افقی", v.xRange[1], (n) =>
                    change(i, { ...v, xRange: [v.xRange[0], n] }),
                  )}
                  {num("ابتدای محور عمودی", v.yRange[0], (n) =>
                    change(i, { ...v, yRange: [n, v.yRange[1]] }),
                  )}
                  {num("انتهای محور عمودی", v.yRange[1], (n) =>
                    change(i, { ...v, yRange: [v.yRange[0], n] }),
                  )}
                </div>
                {v.series.map((s, j) => (
                  <div
                    key={j}
                    className="grid gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <Field title={`نام خط ${j + 1}`}>
                      <input
                        className={style}
                        maxLength={100}
                        value={s.name}
                        onChange={(e) =>
                          change(i, {
                            ...v,
                            series: v.series.map((old, k) =>
                              j === k ? { ...s, name: e.target.value } : old,
                            ),
                          })
                        }
                      />
                    </Field>
                    <div className="grid max-h-64 gap-3 overflow-y-auto">
                      {s.points.map((p, k) => (
                        <div
                          key={k}
                          className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                        >
                          {num(`x نقطه ${k + 1}`, p[0], (n) =>
                            change(i, {
                              ...v,
                              series: v.series.map((old, l) =>
                                j === l
                                  ? {
                                      ...s,
                                      points: s.points.map((p, m) =>
                                        k === m ? [n, p[1]] : p,
                                      ),
                                    }
                                  : old,
                              ),
                            }),
                          )}
                          {num(`y نقطه ${k + 1}`, p[1], (n) =>
                            change(i, {
                              ...v,
                              series: v.series.map((old, l) =>
                                j === l
                                  ? {
                                      ...s,
                                      points: s.points.map((p, m) =>
                                        k === m ? [p[0], n] : p,
                                      ),
                                    }
                                  : old,
                              ),
                            }),
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            disabled={s.points.length <= 2}
                            aria-label={`حذف نقطه ${k + 1}`}
                            onClick={() =>
                              change(i, {
                                ...v,
                                series: v.series.map((old, l) =>
                                  j === l
                                    ? {
                                        ...s,
                                        points: s.points.filter(
                                          (_, m) => m !== k,
                                        ),
                                      }
                                    : old,
                                ),
                              })
                            }
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={s.points.length >= 80}
                      onClick={() =>
                        change(i, {
                          ...v,
                          series: v.series.map((old, l) =>
                            j === l
                              ? {
                                  ...s,
                                  points: [
                                    ...s.points,
                                    [v.xRange[0], v.yRange[0]],
                                  ],
                                }
                              : old,
                          ),
                        })
                      }
                    >
                      افزودن نقطه به خط
                    </Button>
                  </div>
                ))}
              </>
            )}
            {v.kind === "geometry" && (
              <>
                <p className="text-xs leading-6 text-slate-500">
                  مختصات از ۰ تا ۱۰۰؛ x به راست و y به بالا افزایش می‌یابد.
                  پیکان را برای نمایش نیرو یا بردار فعال کنید.
                </p>
                {(["points", "segments", "circles"] as const).map((key) => (
                  <div
                    key={key}
                    className="grid gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <p className="text-xs font-bold">
                      {
                        {
                          points: "نقطه‌ها",
                          segments: "خط‌ها و پیکان‌ها",
                          circles: "دایره‌ها",
                        }[key]
                      }
                    </p>
                    {v[key].map((p, k) => (
                      <div
                        key={k}
                        className="grid gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(p)
                            .filter(([f]) => f !== "label" && f !== "arrow")
                            .map(([f, n]) => (
                              <div key={f}>
                                {num(
                                  f,
                                  n as number,
                                  (n) =>
                                    change(i, {
                                      ...v,
                                      [key]: v[key].map((old, j) =>
                                        j === k ? { ...old, [f]: n } : old,
                                      ),
                                    }),
                                  0,
                                  100,
                                )}
                              </div>
                            ))}
                        </div>
                        <Field title="برچسب شکل">
                          <input
                            className={style}
                            maxLength={100}
                            value={p.label}
                            onChange={(e) =>
                              change(i, {
                                ...v,
                                [key]: v[key].map((old, j) =>
                                  j === k
                                    ? { ...old, label: e.target.value }
                                    : old,
                                ),
                              })
                            }
                          />
                        </Field>
                        {"arrow" in p && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={p.arrow}
                              onChange={(e) =>
                                change(i, {
                                  ...v,
                                  segments: v.segments.map((old, j) =>
                                    j === k
                                      ? { ...old, arrow: e.target.checked }
                                      : old,
                                  ),
                                })
                              }
                            />
                            نمایش پیکان
                          </label>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            change(i, {
                              ...v,
                              [key]: v[key].filter((_, j) => j !== k),
                            })
                          }
                        >
                          حذف جزء شکل
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={v[key].length >= (key === "circles" ? 10 : 30)}
                      onClick={() =>
                        change(i, {
                          ...v,
                          [key]: [
                            ...v[key],
                            key === "points"
                              ? { x: 50, y: 50, label: "P" }
                              : key === "segments"
                                ? {
                                    x1: 20,
                                    y1: 50,
                                    x2: 80,
                                    y2: 50,
                                    label: "",
                                    arrow: false,
                                  }
                                : { x: 50, y: 50, r: 20, label: "" },
                          ],
                        })
                      }
                    >
                      افزودن{" "}
                      {
                        {
                          points: "نقطه",
                          segments: "خط یا پیکان",
                          circles: "دایره",
                        }[key]
                      }
                    </Button>
                  </div>
                ))}
              </>
            )}
            {v.kind !== "image" && <QuestionVisualView visual={v} />}
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(value.filter((_, j) => i !== j))}
            >
              حذف این محتوای سؤال
            </Button>
          </div>
        </details>
      ))}
    </fieldset>
  );
}
