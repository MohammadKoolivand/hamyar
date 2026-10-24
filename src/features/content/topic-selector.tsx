"use client";
import { AppLink as Link } from "@/components/app-link";
import { useState } from "react";
import type { Node } from "@/lib/types";
import { curriculumTopicChoices } from "@/lib/curriculum";
import { Field } from "@/components/ui/field";
const labels: Record<string, string> = {
  common: "مشترک متوسطه اول",
  mathematics: "ریاضی و فیزیک",
  experimental: "علوم تجربی",
  humanities: "علوم انسانی",
  islamic: "علوم و معارف اسلامی",
  custom: "بدون رشته مشخص",
};
const style =
  "w-full min-w-0 min-h-11 rounded-xl border border-slate-300 bg-white p-3 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-2 focus:outline-[#1F3F97]";
function unique(rows: { id: string; title: string }[]) {
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}
export function TopicSelector({
  nodes,
  value,
  onChange,
  disabled = false,
  context = "تولید سؤال",
  topicLabel,
}: {
  nodes: Node[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  context?: string;
  topicLabel?: string;
}) {
  const [grade, setGrade] = useState(""),
    [track, setTrack] = useState(""),
    [book, setBook] = useState(""),
    [chapter, setChapter] = useState("");
  const choices = curriculumTopicChoices(nodes);
  const chosen = choices.find((c) => c.topic._id === value);
  const activeGrade = chosen?.grade.id ?? grade;
  const activeTrack = chosen
    ? chosen.tracks.includes(track)
      ? track
      : chosen.tracks[0]
    : track;
  const activeBook = chosen?.book.id ?? book;
  const activeChapter = chosen?.chapter.id ?? chapter;
  const grades = unique(choices.map((c) => c.grade));
  const gradeValid = grades.some((g) => g.id === activeGrade);
  const gradeRows = gradeValid
    ? choices.filter((c) => c.grade.id === activeGrade)
    : [];
  const tracks = [...new Set(gradeRows.flatMap((c) => c.tracks))];
  const showTracks = tracks.some((t) => t !== "custom");
  const trackValid = !showTracks || tracks.includes(activeTrack);
  const scoped = trackValid
    ? gradeRows.filter((c) => !showTracks || c.tracks.includes(activeTrack))
    : [];
  const books = unique(scoped.map((c) => c.book));
  const bookValid = books.some((b) => b.id === activeBook);
  const chapters = unique(
    bookValid
      ? scoped.filter((c) => c.book.id === activeBook).map((c) => c.chapter)
      : [],
  );
  const chapterValid = chapters.some((c) => c.id === activeChapter);
  const topics = chapterValid
    ? scoped.filter(
        (c) => c.book.id === activeBook && c.chapter.id === activeChapter,
      )
    : [];
  const selected = topics.some((t) => t.topic._id === value) ? value : "";
  return (
    <fieldset
      className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4"
      disabled={disabled}
    >
      <legend className="px-2 text-sm font-medium">
        انتخاب مرحله‌ای مبحث {context}
      </legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field title={`پایه ${context}`}>
          <select
            className={style}
            required
            value={gradeValid ? activeGrade : ""}
            onChange={(e) => {
              setGrade(e.target.value);
              setTrack("");
              setBook("");
              setChapter("");
              onChange("");
            }}
          >
            <option value="">۱. انتخاب پایه</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
        {showTracks && (
          <Field title={`رشته ${context}`}>
            <select
              className={style}
              required
              disabled={!gradeValid}
              value={trackValid ? activeTrack : ""}
              onChange={(e) => {
                setGrade(activeGrade);
                setTrack(e.target.value);
                setBook("");
                setChapter("");
                onChange("");
              }}
            >
              <option value="">انتخاب رشته</option>
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {labels[t] ?? t}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field title={`درس یا کتاب ${context}`}>
          <select
            className={style}
            required
            disabled={!gradeValid || !trackValid}
            value={bookValid ? activeBook : ""}
            onChange={(e) => {
              setGrade(activeGrade);
              setTrack(activeTrack);
              setBook(e.target.value);
              setChapter("");
              onChange("");
            }}
          >
            <option value="">۲. انتخاب درس یا کتاب</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </Field>
        <Field title={`فصل ${context}`}>
          <select
            className={style}
            required
            disabled={!bookValid}
            value={chapterValid ? activeChapter : ""}
            onChange={(e) => {
              setGrade(activeGrade);
              setTrack(activeTrack);
              setBook(activeBook);
              setChapter(e.target.value);
              onChange("");
            }}
          >
            <option value="">۳. انتخاب فصل</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field title={topicLabel ?? `مبحث ${context}`}>
          <select
            className={style}
            required
            disabled={!chapterValid}
            value={selected}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">۴. انتخاب مبحث</option>
            {topics.map((c) => (
              <option key={c.topic._id} value={c.topic._id}>
                {c.topic.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!choices.length && (
        <p className="text-xs leading-loose text-slate-500">
          ابتدا کتاب یا ساختار موردنظر را در{" "}
          <Link
            href="/resources"
            className="font-medium text-[#233B8F] underline"
          >
            منابع آموزشی
          </Link>{" "}
          اضافه کنید.
        </p>
      )}
      {gradeValid && !showTracks && (
        <p className="text-xs text-slate-500">
          برای ساختارهای شخصی بدون پایه یا فصل، گزینه «بدون … مشخص» در دسترس
          است.
        </p>
      )}
    </fieldset>
  );
}
