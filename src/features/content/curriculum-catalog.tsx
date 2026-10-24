"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { Node } from "@/lib/types";
interface Book {
  id: string;
  grade: number;
  title: string;
  subject: string;
  tracks: string[];
  program: string;
  source: { outlineUrl: string; officialEditionVerified: boolean };
  chapters: {
    order: number;
    title: string;
    topics: { title: string; basis: string }[];
  }[];
}
interface Catalog {
  version: string;
  books: Book[];
  trackLabels: Record<string, string>;
  notice: string;
}
const field = "glass-field min-h-11 w-full p-3";
export function CurriculumCatalog({
  nodes,
  onImported,
}: {
  nodes: Node[];
  onImported: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [grade, setGrade] = useState(""),
    [track, setTrack] = useState(""),
    [subject, setSubject] = useState(""),
    [program, setProgram] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Catalog>("/curriculum/catalog")
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  async function importBooks(bookIds: string[]) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{
        created: number;
        preserved: number;
        updated: number;
      }>("/curriculum/catalog/import", { bookIds });
      await onImported();
      setNotice(
        `${result.created.toLocaleString("fa-IR")} عنوان افزوده شد؛ ${result.preserved.toLocaleString("fa-IR")} عنوان موجود حفظ شد؛ ${(result.updated ?? 0).toLocaleString("fa-IR")} عنوان یا منبع فهرست به‌روز شد.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const books =
    catalog?.books.filter(
      (b) =>
        (!grade || b.grade === Number(grade)) &&
        (!track || b.tracks.includes(track)) &&
        (!subject || b.subject === subject) &&
        (!program || b.program === program),
    ) ?? [];
  return (
    <section className="grid min-w-0 gap-4">
      <h2 className="text-lg font-bold">فهرست ریاضی، علوم و فیزیک متوسطه</h2>
      <p className="text-sm leading-loose text-slate-600">
        کتاب ← فصل ← مبحث؛ رشته‌های ریاضی، تجربی، انسانی و معارف. فیزیک متوسطه
        اول در کتاب علوم آمده است. این فهرست سرفصل است؛ خالی بودن تعداد سؤال به
        معنی نبود مبحث نیست.
      </p>
      {error && (
        <p role="alert" className="text-rose-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-teal-50 p-3">
          {notice}
        </p>
      )}
      {catalog && (
        <>
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-loose text-amber-900">
            {catalog.notice}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field title="پایه فهرست">
              <select
                className={field}
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  setTrack("");
                }}
              >
                <option value="">همه پایه‌ها</option>
                {[...new Set(catalog.books.map((b) => b.grade))]
                  .sort((a, b) => a - b)
                  .map((g) => (
                    <option key={g} value={g}>
                      {g.toLocaleString("fa-IR")}
                    </option>
                  ))}
              </select>
            </Field>
            <Field title="رشته فهرست">
              <select
                className={field}
                value={track}
                onChange={(e) => setTrack(e.target.value)}
              >
                <option value="">همه رشته‌ها</option>
                {Object.entries(catalog.trackLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field title="درس فهرست">
              <select
                className={field}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">همه درس‌ها</option>
                <option value="mathematics">ریاضی</option>
                <option value="physics">
                  فیزیک (بخش‌های منتخب علوم در متوسطه اول)
                </option>
                <option value="science">علوم تجربی کامل</option>
              </select>
            </Field>
            <Field title="نوع کتاب فهرست">
              <select
                className={field}
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">عادی و تکمیلی</option>
                <option value="regular">عادی</option>
                <option value="gifted">تکمیلی استعدادهای درخشان</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy || !books.length}
              onClick={() => void importBooks(books.map((b) => b.id))}
            >
              افزودن کتاب‌های این فیلتر به مباحث من
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void importBooks(catalog.books.map((b) => b.id))}
            >
              تکمیل همه مباحث ریاضی، علوم و فیزیک من
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            {books.length.toLocaleString("fa-IR")} کتاب؛ افزودن دوباره عنوان
            تکراری نمی‌سازد؛ منبع رسمی و عنوان‌های اصلاح‌شده فهرست به‌روز
            می‌شوند و ویرایش‌های معلم حفظ می‌شوند.
          </p>
          {!books.length && (
            <p>
              در این ترکیب، کتاب مستقلی در این فهرست ثبت نشده است؛ برای انسانی و
              معارف کتاب فیزیک مستقل اضافه نشده است.
            </p>
          )}
          <div className="grid max-h-[34rem] gap-3 overflow-y-auto">
            {books.map((book) => (
              <details
                className="min-w-0 rounded-xl border border-slate-200 p-3"
                key={book.id}
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {book.title} · پایه {book.grade.toLocaleString("fa-IR")} ·{" "}
                  {book.tracks.map((t) => catalog.trackLabels[t]).join("، ")} ·{" "}
                  {book.chapters.length.toLocaleString("fa-IR")} فصل{" "}
                  {nodes.some((n) => n.catalogBookId === book.id)
                    ? "· افزوده‌شده"
                    : ""}
                </summary>
                <div className="mt-3 grid gap-3">
                  <a
                    href={book.source.outlineUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#233B8F] underline"
                  >
                    {book.source.officialEditionVerified
                      ? "فایل رسمی؛ فهرست فصل‌ها بررسی شده"
                      : "منبع ثانویه؛ چاپ رسمی هنوز تطبیق نشده"}
                  </a>
                  {book.chapters.map((ch) => (
                    <div key={ch.order} className="rounded-xl bg-slate-50 p-3">
                      <h3 className="text-sm font-bold">
                        فصل {ch.order.toLocaleString("fa-IR")}: {ch.title}
                      </h3>
                      <ul className="mt-2 list-inside list-disc text-sm leading-loose">
                        {ch.topics.map((t) => (
                          <li key={t.title}>
                            {t.title}
                            {t.basis === "chapter" && (
                              <span className="text-xs text-slate-500">
                                {" "}
                                (در سطح فصل)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => void importBooks([book.id])}
                  >
                    افزودن این کتاب به مباحث من
                  </Button>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
