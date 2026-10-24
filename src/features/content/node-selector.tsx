"use client";
import type { Node } from "@/lib/types";
import { curriculumAncestors } from "@/lib/curriculum";
import { Field } from "@/components/ui/field";
const kindLabels: Record<string, string> = {
  system: "نظام آموزشی",
  level: "مقطع",
  grade: "پایه",
  subject: "درس",
  course: "کتاب / دوره",
  chapter: "فصل",
  topic: "مبحث",
  skill: "مهارت",
  objective: "هدف یادگیری",
};
export function NodeSelector({
  nodes,
  value,
  onChange,
  disabled = false,
}: {
  nodes: Node[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const path = curriculumAncestors(nodes, value),
    byId = new Map(nodes.map((n) => [n._id, n]));
  const steps: { options: Node[]; selected: string }[] = [];
  const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
  if (path[0] && !roots.some((n) => n._id === path[0]._id)) roots.push(path[0]);
  steps.push({ options: roots, selected: path[0]?._id ?? "" });
  for (let i = 0; i < path.length && i < 16; i++) {
    const seen = new Set(path.slice(0, i + 1).map((n) => n._id));
    const children = nodes.filter(
      (n) => n.parentId === path[i]._id && !seen.has(n._id),
    );
    if (!children.length) break;
    steps.push({ options: children, selected: path[i + 1]?._id ?? "" });
  }
  return (
    <fieldset
      disabled={disabled}
      className="col-span-full grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4"
    >
      <legend className="px-2 text-sm font-medium">
        انتخاب مرحله‌ای والد ساختار (اختیاری)
      </legend>
      <p className="text-xs leading-6 text-slate-500">
        از بخش کلی شروع کنید و تا محل موردنظر ادامه دهید. عنوان جدید زیر آخرین
        بخش انتخاب‌شده ساخته می‌شود؛ انتخاب «مستقل» آن را بدون والد می‌سازد.
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {steps.map((step, i) => (
          <Field key={i} title={`سطح ${i + 1} والد ساختار`}>
            <select
              className="glass-field min-h-11 w-full min-w-0 p-3"
              value={step.selected}
              onChange={(e) =>
                onChange(e.target.value || path[i - 1]?._id || "")
              }
            >
              <option value="">
                {i === 0
                  ? "مستقل (بدون والد)"
                  : "توقف در سطح قبلی / انتخاب بخش بعدی"}
              </option>
              {step.options.map((n) => (
                <option key={n._id} value={n._id}>
                  {n.title} ({kindLabels[n.kind] ?? n.kind})
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      {path.length > 0 && (
        <p className="break-words text-xs leading-6 text-teal-800">
          والد انتخاب‌شده: {path.map((n) => n.title).join(" ← ")}
        </p>
      )}
    </fieldset>
  );
}
