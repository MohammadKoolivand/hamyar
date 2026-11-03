"use client";
import { Check, Crop } from "lucide-react";
import Image from "next/image";
import { useId, useEffect, useRef, useState } from "react";
import { mathMarkup, questionDisplayText } from "@/lib/math-render";
import {
  questionVisualSchema,
  type QuestionVisual,
} from "@/lib/question-visuals";
export function MathFormula({
  latex,
  inline = false,
}: {
  latex: string;
  inline?: boolean;
}) {
  try {
    return (
      <span
        dir="ltr"
        className={
          inline
            ? "inline-block max-w-full align-middle"
            : "block max-w-full overflow-x-auto py-3 text-center text-xl"
        }
        dangerouslySetInnerHTML={{
          __html: mathMarkup(
            latex.replace(/\\neg\b/g, "\\mathord{\\sim}"),
            !inline,
          ),
        }}
      />
    );
  } catch {
    return (
      <span className="text-sm text-rose-700">
        فرمول نامعتبر: <code dir="ltr">{latex}</code>
      </span>
    );
  }
}
export function MathText({ text }: { text: string }) {
  const pieces = text.split(
    /(<u>[\s\S]{1,5000}?<\/u>|\$\$[\s\S]{1,1000}?\$\$|\$[^$\n]{1,1000}\$|\\\([\s\S]{1,1000}?\\\))/g,
  );
  return (
    <span className="hy-question-text">
      {pieces.map((s, i) =>
        s.startsWith("<u>") && s.endsWith("</u>") ? (
          <u key={i} className="decoration-1 underline-offset-4">
            <MathText text={s.slice(3, -4)} />
          </u>
        ) : s.startsWith("$$") ? (
          <MathFormula key={i} latex={s.slice(2, -2)} />
        ) : s.startsWith("$") ? (
          <MathFormula key={i} latex={s.slice(1, -1)} inline />
        ) : s.startsWith("\\(") ? (
          <MathFormula key={i} latex={s.slice(2, -2)} inline />
        ) : (
          <span key={i}>{questionDisplayText(s)}</span>
        ),
      )}
    </span>
  );
}
const colors = ["#233B8F", "#12867F", "#AE7014", "#983CA7"];
export function QuestionVisualView({ visual }: { visual: QuestionVisual }) {
  const id = useId().replace(/:/g, "");
  const checked = questionVisualSchema.safeParse(visual);
  if (!checked.success)
    return (
      <p role="alert" className="text-sm text-rose-700">
        داده شکل یا نمودار معتبر نیست؛ قبل از تأیید اصلاح کنید.
      </p>
    );
  const v = {
    ...checked.data,
    caption: questionDisplayText(checked.data.caption),
  };
  return (
    <figure
      className="my-3 min-w-0 rounded-2xl border border-slate-200 bg-white p-3"
      aria-label={v.caption}
    >
      {v.kind === "image" ? (
        v.crop ? (
          <svg
            role="img"
            aria-label={v.caption}
            viewBox={`${(v.width * v.crop.x) / 100} ${(v.height * v.crop.y) / 100} ${(v.width * v.crop.width) / 100} ${(v.height * v.crop.height) / 100}`}
            className="h-auto w-full rounded-lg"
            overflow="hidden"
          >
            <title>{v.caption}</title>
            <image
              href={`/api/question-assets/${v.assetId}`}
              width={v.width}
              height={v.height}
            />
          </svg>
        ) : (
          <Image
            unoptimized
            src={`/api/question-assets/${v.assetId}`}
            width={v.width}
            height={v.height}
            alt={v.caption}
            className="h-auto w-full rounded-lg"
          />
        )
      ) : v.kind === "formula" ? (
        <MathFormula latex={v.latex} />
      ) : v.kind === "chart" ? (
        (() => {
          const x = (n: number) =>
              65 + ((n - v.xRange[0]) / (v.xRange[1] - v.xRange[0])) * 375,
            y = (n: number) =>
              260 - ((n - v.yRange[0]) / (v.yRange[1] - v.yRange[0])) * 220;
          return (
            <>
              <svg
                role="img"
                aria-label={v.caption}
                viewBox="0 0 500 325"
                className="mx-auto block w-full max-w-xl"
                direction="ltr"
              >
                <title>{v.caption}</title>
                {Array.from({ length: 6 }, (_, i) => {
                  const xv =
                      v.xRange[0] + (i * (v.xRange[1] - v.xRange[0])) / 5,
                    yv = v.yRange[0] + (i * (v.yRange[1] - v.yRange[0])) / 5;
                  return (
                    <g key={i} fontSize="11" fill="#475569">
                      <path
                        d={`M ${x(xv)} 40 V 260 M 65 ${y(yv)} H 440`}
                        stroke="#e2e8f0"
                      />
                      <text x={x(xv)} y={278} textAnchor="middle">
                        {Number(xv.toPrecision(4))}
                      </text>
                      <text x="56" y={y(yv) + 4} textAnchor="end">
                        {Number(yv.toPrecision(4))}
                      </text>
                    </g>
                  );
                })}
                <path d="M65 40 V260 H440" stroke="#64748b" fill="none" />
                {v.xRange[0] < 0 && v.xRange[1] > 0 && (
                  <path d={`M${x(0)} 40 V260`} stroke="#94a3b8" />
                )}
                {v.yRange[0] < 0 && v.yRange[1] > 0 && (
                  <path d={`M65 ${y(0)} H440`} stroke="#94a3b8" />
                )}
                {v.series.map((s, i) => (
                  <g key={i} stroke={colors[i]} fill={colors[i]}>
                    <polyline
                      fill="none"
                      strokeWidth="2.5"
                      points={s.points
                        .map(([a, b]) => `${x(a)},${y(b)}`)
                        .join(" ")}
                    />
                    {s.points.map(([a, b], j) => (
                      <circle key={j} cx={x(a)} cy={y(b)} r="3" />
                    ))}
                  </g>
                ))}
                <text
                  x="253"
                  y="310"
                  fontSize="13"
                  textAnchor="middle"
                  fill="#334155"
                >
                  {v.xLabel}
                </text>
                <text x="65" y="22" fontSize="13" fill="#334155">
                  {v.yLabel}
                </text>
              </svg>
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                {v.series.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    <svg width="16" height="4" aria-hidden="true">
                      <path d="M0 2 H16" stroke={colors[i]} strokeWidth="3" />
                    </svg>
                    {s.name}
                  </span>
                ))}
              </div>
            </>
          );
        })()
      ) : (
        <svg
          role="img"
          aria-label={v.caption}
          viewBox="-10 -10 120 120"
          className="mx-auto block w-full max-w-md"
          direction="ltr"
        >
          <title>{v.caption}</title>
          <defs>
            <marker
              id={id}
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M0 0 L5 2.5 L0 5 Z" fill="#233B8F" />
            </marker>
          </defs>
          {v.segments.map((s, i) => (
            <g key={i}>
              <line
                x1={s.x1}
                y1={100 - s.y1}
                x2={s.x2}
                y2={100 - s.y2}
                stroke="#233B8F"
                strokeWidth="0.6"
                markerEnd={s.arrow ? `url(#${id})` : undefined}
              />
              <text
                x={(s.x1 + s.x2) / 2}
                y={100 - (s.y1 + s.y2) / 2 - 2}
                textAnchor="middle"
                fontSize="4"
                fill="#334155"
              >
                {s.label}
              </text>
            </g>
          ))}
          {v.circles.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={100 - p.y}
                r={p.r}
                stroke="#12867F"
                strokeWidth="0.6"
                fill="none"
              />
              <text x={p.x} y={100 - p.y} fontSize="4">
                {p.label}
              </text>
            </g>
          ))}
          {v.points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={100 - p.y} r="1" fill="#233B8F" />
              <text x={p.x + 2} y={100 - p.y - 2} fontSize="4" fill="#334155">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      )}
      <figcaption className="mt-2 break-words text-center text-xs leading-6 text-slate-600">
        {v.caption}
      </figcaption>
    </figure>
  );
}
export function QuestionPresentation({
  statement,
  visuals = [],
  visualLayout = "below",
  onCrop,
  options,
  correctReference,
  renderOption,
}: {
  renderOption?: (option: string, index: number) => React.ReactNode;
  options?: string[];
  correctReference?: string;
  statement: string;
  visuals?: QuestionVisual[];
  visualLayout?: "below" | "beside";
  onCrop?: () => void;
}) {
  const statementView = (
    <div className="whitespace-pre-wrap break-words text-sm leading-8">
      <MathText text={statement} />
    </div>
  );
  const visualsView = visuals.map((v, i) => (
    <div key={i} className="relative min-w-0">
      <QuestionVisualView visual={v} />
      {v.kind === "image" && onCrop && (
        <button
          type="button"
          onClick={onCrop}
          aria-label="کراپ تصویر سؤال"
          className="absolute start-3 top-3 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#233B8F] shadow-md"
        >
          <Crop size={20} />
          کراپ
        </button>
      )}
    </div>
  ));
  if (options !== undefined)
    return (
      <div className="grid min-w-0 gap-3">
        {statementView}
        <QuestionOptionsLayout
          options={options}
          correctReference={correctReference}
          renderOption={renderOption}
        >
          {visualsView}
        </QuestionOptionsLayout>
      </div>
    );
  if (visualLayout === "beside" && visuals.length > 0)
    return (
      <div className="grid min-w-0 items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)]">
        {statementView}
        <div className="min-w-0">{visualsView}</div>
      </div>
    );
  return (
    <div className="min-w-0">
      {statementView}
      {visualsView}
    </div>
  );
}

// Measure rendered mathematical content, rather than counting LaTeX characters.
export function QuestionOptionsLayout({
  options,
  correctReference,
  children,
  renderOption,
}: {
  renderOption?: (option: string, index: number) => React.ReactNode;
  options: string[];
  correctReference?: string;
  children?: React.ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const check = () => {
      if (!container.current) return;
      const widths = Array.from(
        container.current.querySelectorAll<HTMLElement>(
          "[data-option-measure]",
        ),
        (el) => {
          const previous = el.style.cssText;
          el.style.cssText +=
            ";position:absolute;width:max-content;max-width:none;white-space:nowrap";
          const width = el.getBoundingClientRect().width;
          el.style.cssText = previous;
          return width;
        },
      );
      const required =
        (Math.max(0, ...widths) + 56) * options.length +
        Math.max(0, options.length - 1) * 16;
      setCompact(
        options.length > 0 && required <= container.current.clientWidth,
      );
    };
    const observer = new ResizeObserver(check);
    if (container.current) observer.observe(container.current);
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) check();
    });
    check();
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [options]);
  const hasVisuals = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <div
      ref={container}
      className="relative min-w-0"
      data-options-layout={compact ? "row" : "stack"}
    >
      <div
        className={
          !compact && hasVisuals
            ? "grid min-w-0 items-start gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
            : "grid min-w-0 gap-4"
        }
      >
        <section
          aria-label="گزینه‌ها و پاسخ مرجع"
          className="grid min-w-0 gap-3"
          style={
            compact
              ? {
                  gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                }
              : undefined
          }
        >
          {options.map((option, i) =>
            renderOption ? (
              <div key={i} className="min-w-0" data-option-measure>
                {renderOption(option, i)}
              </div>
            ) : (
              <div
                key={i}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-sm leading-7"
              >
                <span className="shrink-0 text-slate-500">
                  {(i + 1).toLocaleString("fa-IR")}.
                </span>
                <span
                  className="min-w-0 flex-1 break-words"
                  dir="auto"
                  data-option-measure
                >
                  <MathText text={option} />
                </span>
                {correctReference === option && (
                  <span
                    role="img"
                    aria-label="پاسخ صحیح"
                    title="پاسخ صحیح"
                    className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-400"
                  >
                    <Check size={10} />
                  </span>
                )}
              </div>
            ),
          )}
          {!options.length && (
            <p className="text-sm text-amber-800">
              گزینه‌ها ثبت نشده‌اند؛ سؤال را ویرایش کنید.
            </p>
          )}
        </section>
        {hasVisuals && (
          <div
            className={
              compact
                ? "w-full min-w-0 justify-self-end md:max-w-[40%]"
                : "min-w-0"
            }
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
