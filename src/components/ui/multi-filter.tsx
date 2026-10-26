"use client";
export function MultiFilter({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: [string, string][];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <details className="relative min-w-0 rounded-xl border border-blue-100 bg-white/70">
      <summary className="cursor-pointer p-3 text-sm">
        {label} ·{" "}
        {value.length
          ? `${value.length.toLocaleString("fa-IR")} انتخاب`
          : "همه"}
      </summary>
      <div className="grid max-h-60 gap-2 overflow-y-auto border-t border-blue-100 p-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([])}
          className="justify-self-start text-xs text-blue-700"
        >
          همه / پاک‌کردن فیلتر
        </button>
        {options.map(([id, text]) => (
          <label key={id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.includes(id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, id]
                    : value.filter((v) => v !== id),
                )
              }
              className="size-4 accent-[#233B8F]"
            />
            {text}
          </label>
        ))}
      </div>
    </details>
  );
}
