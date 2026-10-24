"use client";
import { useId } from "react";
import { mathMarkup } from "@/lib/math-render";
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
        dangerouslySetInnerHTML={{ __html: mathMarkup(latex, !inline) }}
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
    /(\$\$[\s\S]{1,1000}?\$\$|\$[^$\n]{1,1000}\$|\\\([\s\S]{1,1000}?\\\))/g,
  );
  return (
    <>
      {pieces.map((s, i) =>
        s.startsWith("$$") ? (
          <MathFormula key={i} latex={s.slice(2, -2)} />
        ) : s.startsWith("$") ? (
          <MathFormula key={i} latex={s.slice(1, -1)} inline />
        ) : s.startsWith("\\(") ? (
          <MathFormula key={i} latex={s.slice(2, -2)} inline />
        ) : (
          <span key={i}>{s}</span>
        ),
      )}
    </>
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
  const v = checked.data;
  return (
    <figure
      className="my-3 min-w-0 rounded-2xl border border-slate-200 bg-white p-3"
      aria-label={v.caption}
    >
      {v.kind === "formula" ? (
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
}: {
  statement: string;
  visuals?: QuestionVisual[];
}) {
  return (
    <div className="min-w-0">
      <div className="whitespace-pre-wrap break-words text-sm leading-8">
        <MathText text={statement} />
      </div>
      {visuals.map((v, i) => (
        <QuestionVisualView key={i} visual={v} />
      ))}
    </div>
  );
}
