import type { Difficulty } from "@/lib/difficulty";
import { difficultyLabels } from "@/lib/difficulty";

/** Ordinal difficulty only: no fabricated score or statistical precision. */
export function DifficultyGauge({ value }: { value?: Difficulty }) {
  const point =
    value === "easy" ? [22, 35] : value === "hard" ? [66, 35] : [44, 20];
  const label = value ? difficultyLabels[value] : "تعیین نشده";
  return (
    <span
      role="img"
      aria-label={`درجه سختی: ${label}`}
      title={`درجه سختی: ${label}`}
      className="inline-flex shrink-0 flex-col items-center rounded-xl border border-blue-100/80 bg-white/60 px-2 py-1 shadow-sm backdrop-blur-md"
    >
      <svg viewBox="0 0 88 57" className="h-12 w-20" aria-hidden="true">
        <path
          d="M12 46 A32 32 0 0 1 28 18.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          className={value ? "text-teal-400" : "text-slate-200"}
        />
        <path
          d="M31 16.8 A32 32 0 0 1 57 16.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          className={value ? "text-amber-400" : "text-slate-200"}
        />
        <path
          d="M60 18.3 A32 32 0 0 1 76 46"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          className={value ? "text-rose-400" : "text-slate-200"}
        />
        {value && (
          <path
            d={`M44 46 L${point[0]} ${point[1]}`}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-[#233B8F]"
          />
        )}
        <circle cx="44" cy="46" r="4" className="fill-[#233B8F]" />
      </svg>
      <span className="text-[10px] leading-4 text-slate-600">
        {value ? "درجه سختی" : "تعیین نشده"}
      </span>
    </span>
  );
}
