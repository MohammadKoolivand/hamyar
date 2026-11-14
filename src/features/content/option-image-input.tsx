"use client";
import { useState } from "react";
import type { QuestionOptionImage } from "@/lib/question-visuals";
import { QuestionVisualView } from "@/components/question-presentation";
import { ImageCropEditor } from "./image-crop-editor";

/** An image belongs to a specific answer option, not to the whole question. */
export function OptionImageInput({
  index,
  value,
  onChange,
}: {
  index: number;
  value: QuestionOptionImage | null;
  onChange: (next: QuestionOptionImage | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File) {
    if (busy) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("تصویر باید PNG، JPG یا WebP و حداکثر ۵ مگابایت باشد.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/question-assets", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("بارگذاری تصویر انجام نشد");
      const result = await response.json();
      if (result.kind !== "image" || typeof result.assetId !== "string")
        throw new Error("پاسخ بارگذاری معتبر نیست");
      onChange({ ...result, caption: `تصویر گزینه ${index + 1}` });
    } catch {
      setError("بارگذاری تصویر انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid min-w-0 gap-2 rounded-xl border border-dashed border-slate-200 p-3"
      onPaste={(event) => {
        const file = Array.from(event.clipboardData.files).find((f) => f.type.startsWith("image/"));
        if (file) { event.preventDefault(); void upload(file); }
      }}
    >
      <label className="text-xs text-slate-600" htmlFor={`option-image-${index}`}>
        تصویر گزینه {index + 1} (اختیاری؛ امکان Paste تصویر هم وجود دارد)
      </label>
      <input id={`option-image-${index}`} type="file" accept="image/png,image/jpeg,image/webp"
        disabled={busy} aria-label={`بارگذاری تصویر گزینه ${index + 1}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
        className="w-full min-w-0 text-xs"
      />
      {busy && <p role="status" className="text-xs">در حال بارگذاری تصویر…</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {value && (
        <div className="grid gap-2">
          <div className="max-w-sm"><QuestionVisualView visual={value} /></div>
          <ImageCropEditor value={value} onChange={onChange} />
          <button type="button" onClick={() => onChange(null)}
            className="justify-self-start rounded-lg border border-rose-200 px-3 py-2 text-xs text-rose-700">
            حذف تصویر این گزینه
          </button>
        </div>
      )}
    </div>
  );
}
