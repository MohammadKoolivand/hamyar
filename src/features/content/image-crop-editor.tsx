"use client";
import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";
import { Crop, Check, X, RotateCcw } from "lucide-react";
import type { QuestionVisual } from "@/lib/question-visuals";
import { QuestionVisualView } from "@/components/question-presentation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
type ImageVisual = Extract<QuestionVisual, { kind: "image" }>;
const full = { x: 0, y: 0, width: 100, height: 100 };
export function ImageCropEditor({
  value,
  onChange,
  autoOpen = false,
}: {
  value: ImageVisual;
  onChange: (v: ImageVisual) => void;
  autoOpen?: boolean;
}) {
  const [active, setActive] = useState(autoOpen);
  const [crop, setCrop] = useState(value.crop ?? full);
  const drag = useRef<{
    x: number;
    y: number;
    id: number;
    previous: typeof full;
  } | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const point = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(99, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(99, ((e.clientY - r.top) / r.height) * 100)),
    };
  };
  const finish = (e: PointerEvent<HTMLDivElement>, cancel = false) => {
    if (drag.current?.id !== e.pointerId) return;
    if (cancel) setCrop(drag.current.previous);
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <div className="grid min-w-0 gap-3">
      {!active ? (
        <div className="relative">
          <QuestionVisualView visual={value} />
          <Button
            type="button"
            variant="outline"
            aria-label="کراپ تصویر"
            className="absolute start-3 top-6 bg-white shadow-md"
            onClick={() => {
              setCrop(value.crop ?? full);
              setActive(true);
            }}
          >
            <Crop size={20} />
            کراپ
          </Button>
        </div>
      ) : (
        <fieldset className="grid min-w-0 gap-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
          <legend className="px-2 text-sm font-bold">برش تصویر</legend>
          <p className="text-xs leading-6 text-slate-600">
            روی تصویر بکشید تا محدودهٔ برش انتخاب شود؛ با ماوس یا لمس. برای
            تنظیم دقیق می‌توانید عددها را هم تغییر دهید.
          </p>
          <div
            ref={surface}
            role="group"
            aria-label="انتخاب محدوده برش تصویر"
            dir="ltr"
            className="relative touch-none cursor-crosshair select-none overflow-hidden rounded-xl bg-white"
            onPointerDown={(e) => {
              if (!e.isPrimary || e.button !== 0) return;
              e.preventDefault();
              const p = point(e);
              drag.current = { ...p, id: e.pointerId, previous: crop };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const start = drag.current;
              if (!start || start.id !== e.pointerId) return;
              const p = point(e);
              const x = Math.min(start.x, p.x),
                y = Math.min(start.y, p.y);
              setCrop({
                x,
                y,
                width: Math.max(1, Math.abs(p.x - start.x)),
                height: Math.max(1, Math.abs(p.y - start.y)),
              });
            }}
            onPointerUp={(e) => finish(e)}
            onPointerCancel={(e) => finish(e, true)}
          >
            <Image
              unoptimized
              draggable={false}
              src={`/api/question-assets/${value.assetId}`}
              alt="تصویر اصلی برای انتخاب برش"
              width={value.width}
              height={value.height}
              className="pointer-events-none h-auto w-full"
            />
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={`M0 0H100V100H0Z M${crop.x} ${crop.y}v${crop.height}h${crop.width}v-${crop.height}Z`}
                fill="rgba(15,23,42,0.5)"
                fillRule="evenodd"
              />
              <rect
                x={crop.x}
                y={crop.y}
                width={crop.width}
                height={crop.height}
                fill="none"
                stroke="#19B7AE"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {[0, 1].flatMap((a) =>
                [0, 1].map((b) => (
                  <rect
                    key={`${a}${b}`}
                    x={crop.x + crop.width * a - 0.6}
                    y={crop.y + crop.height * b - 0.6}
                    width="1.2"
                    height="1.2"
                    fill="white"
                  />
                )),
              )}
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["x", "y", "width", "height"] as const).map((key, i) => (
              <Field
                key={key}
                title={
                  [
                    "فاصله از چپ (%)",
                    "فاصله از بالا (%)",
                    "عرض برش (%)",
                    "ارتفاع برش (%)",
                  ][i]
                }
              >
                <input
                  type="number"
                  dir="ltr"
                  min={key === "x" || key === "y" ? 0 : 1}
                  max={
                    key === "x" || key === "y"
                      ? 99
                      : key === "width"
                        ? 100 - crop.x
                        : 100 - crop.y
                  }
                  step="any"
                  required
                  className="glass-field min-h-11 w-full p-2"
                  value={crop[key]}
                  onChange={(e) => {
                    const next = {
                      ...crop,
                      [key]: Math.max(
                        key === "x" || key === "y" ? 0 : 1,
                        Math.min(
                          key === "x" || key === "y" ? 99 : 100,
                          Number(e.target.value),
                        ),
                      ),
                    };
                    next.width = Math.min(next.width, 100 - next.x);
                    next.height = Math.min(next.height, 100 - next.y);
                    setCrop(next);
                  }}
                />
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                onChange({ ...value, crop });
                setActive(false);
              }}
            >
              <Check size={18} />
              اعمال برش
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActive(false);
                setCrop(value.crop ?? full);
              }}
            >
              <X size={18} />
              انصراف از برش
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCrop(full)}
            >
              <RotateCcw size={18} />
              بازگرداندن تصویر کامل
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            پس از اعمال برش، «ذخیره نسخه جدید» را بزنید تا در بانک سؤال ذخیره
            شود.
          </p>
        </fieldset>
      )}
    </div>
  );
}
