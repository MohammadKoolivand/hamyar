"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { LearningDashboard } from "./learning-dashboard";
import { Field } from "@/components/ui/field";
export function ParentDashboard({ me }: { me: User }) {
  const [children, setChildren] = useState<User[]>([]),
    [child, setChild] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api<User[]>("/children")
      .then((rows) => {
        setChildren(rows);
        setChild(rows[0]?._id ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="grid w-full min-w-0 content-start gap-5">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold text-teal-700">گزارش آموزشی</p>
        <h1 className="mt-1 text-2xl font-bold">گزارش فرزند</h1>
        <p className="mt-2 text-sm text-slate-600">{me.name}، روند تمرین فرزندتان را در این بخش دنبال کنید.</p>
      </header>
      <p className="glass-note p-4 text-sm leading-loose">
        این گزارش شواهد تمرین است و به‌تنهایی میزان توانایی یا ارزش فرزندتان را
        نشان نمی‌دهد. برای تفسیر و تصمیم آموزشی با معلم گفت‌وگو کنید. دسترسی
        اولیا فقط خواندنی و محدود به ارتباط آموزشی دعوت‌کننده است.
      </p>
      {error && <p role="alert">{error}</p>}
      <Field title="انتخاب فرزند">
        <select
          className="glass-field p-3"
          value={child}
          onChange={(e) => setChild(e.target.value)}
        >
          {children.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {!children.length && !error && (
        <p>پس از پذیرش دعوت معتبر معلم، گزارش فرزند اینجا نمایش داده می‌شود.</p>
      )}
      {child && (
        <LearningDashboard
          key={child}
          me={me}
          students={[]}
          subjectId={child}
        />
      )}
    </section>
  );
}
