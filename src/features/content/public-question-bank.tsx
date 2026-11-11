"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { QuestionPresentation } from "@/components/question-presentation";
import { PagedList } from "@/components/ui/paged-list";
import type { Question } from "@/lib/types";

export function PublicQuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    api<Question[]>("/questions/public")
      .then((rows) => {
        if (active) setQuestions(rows);
      })
      .catch((error) => {
        if (active) setError((error as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const visible = questions.filter((q) => q.statement.includes(search.trim()));
  return (
    <section className="grid gap-4 rounded-2xl border bg-white p-5" dir="rtl">
      <h2 className="text-xl font-bold">بانک سؤال عمومی</h2>
      <label>
        جست‌وجو در سؤال‌های عمومی
        <input
          className="mt-2 w-full rounded-xl border p-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {loading && <p role="status">در حال دریافت سؤال‌ها…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !visible.length && <p>سؤال عمومی‌ای یافت نشد.</p>}
      <PagedList items={visible} label="سؤال‌های عمومی">
        {(q) => (
          <article key={q._id} className="rounded-xl border p-4">
            <QuestionPresentation
              statement={q.statement}
              options={q.options}
              visuals={q.visuals}
              visualLayout={q.visualLayout}
            />
          </article>
        )}
      </PagedList>
    </section>
  );
}
