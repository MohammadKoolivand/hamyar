"use client";
import { useRef, useState, type TextareaHTMLAttributes } from "react";
import { Underline } from "lucide-react";
import { toggleQuestionUnderline } from "@/lib/question-formatting";

type Props = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (text: string) => void;
};
export function QuestionTextInput({ value, onChange, ...props }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  function underline() {
    const el = input.current;
    if (!el) return;
    const result = toggleQuestionUnderline(
      value,
      el.selectionStart,
      el.selectionEnd,
    );
    if (!result) {
      setMessage("ابتدا بخشی از متن سؤال را انتخاب کنید.");
      return;
    }
    if (props.maxLength && result.text.length > props.maxLength) {
      setMessage("طول متن از حد مجاز بیشتر می‌شود.");
      return;
    }
    setMessage("");
    onChange(result.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  }
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={props.disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={underline}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs text-[#233B8F]"
          title="انتخاب متن و سپس زیرخط؛ Ctrl+U یا Command+U"
        >
          <Underline size={15} /> زیرخط متن انتخاب‌شده
        </button>
        <span className="text-xs text-slate-500">
          متن را انتخاب کنید؛ دوباره زدن دکمه، زیرخط را برمی‌دارد.
        </span>
      </div>
      <textarea
        {...props}
        ref={input}
        value={value}
        onChange={(e) => {
          setMessage("");
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          props.onKeyDown?.(e);
          if (
            !e.defaultPrevented &&
            (e.ctrlKey || e.metaKey) &&
            e.key.toLowerCase() === "u"
          ) {
            e.preventDefault();
            underline();
          }
        }}
      />
      {message && (
        <p role="status" className="text-xs text-amber-800">
          {message}
        </p>
      )}
    </div>
  );
}
