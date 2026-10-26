"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { LearningDashboard } from "./learning-dashboard";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Brand } from "@/components/ui/brand";
export function ParentDashboard({
  me,
  onLogout,
}: {
  me: User;
  onLogout: () => Promise<void>;
}) {
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
    <main className="mx-auto grid w-full content-start gap-5 p-5 sm:p-8">
      <header className="glass-header flex h-fit self-start flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-6 sm:py-3">
        <div>
          <Brand showTagline />
          <h1 className="mt-3 text-2xl font-bold text-[#1F3F97]">پنل اولیا</h1>
          <p className="mt-2 text-sm">
            {me.name}، روند تمرین فرزندتان را دنبال کنید.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void onLogout().catch((e) => setError(e.message))}
        >
          خروج
        </Button>
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
    </main>
  );
}
