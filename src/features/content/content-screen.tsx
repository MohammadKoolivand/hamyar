"use client";
import { SourceEditor } from "./source-editor";
import type { QuestionSource } from "@/lib/question-source";
import { VisualEditor } from "./visual-editor";
import {
  questionVisualsSchema,
  type QuestionVisual,
} from "@/lib/question-visuals";
import { CurriculumCatalog } from "./curriculum-catalog";
import { AppLink as Link } from "@/components/app-link";
import { QuestionBank } from "./question-bank";
import { curriculumSkills } from "@/lib/curriculum";
import { TopicSelector } from "./topic-selector";
import { NodeSelector } from "./node-selector";
import { AiAuthoring } from "./ai-authoring";
import { useState, type ReactNode } from "react";
import type React from "react";
import { BookOpen, ChevronDown, Layers3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { fa } from "@/lib/presentation";
import { api } from "@/lib/api";
import type { Node, Question } from "@/lib/types";

export function ContentScreen({
  view = "bank",
  nodes,
  questions,
  busy,
  run,
  refresh,
  setNotice,
  skillIds,
  setSkillIds,
  mathMode,
  setMathMode,
  nodeTitle,
  setNodeTitle,
  nodeKind,
  setNodeKind,
  parent,
  setParent,
  topic,
  setTopic,
  statement,
  setStatement,
  qtype,
  setQtype,
  reference,
  setReference,
  hints,
  setHints,
  options,
  setOptions,
  mathVariables,
  setMathVariables,
  rubric,
  setRubric,
  hintAlternatives,
  setHintAlternatives,
  absoluteTolerance,
  setAbsoluteTolerance,
  relativeTolerance,
  setRelativeTolerance,
}: {
  view?: "bank" | "add" | "resources";
  setNotice: (v: string) => void;
  nodes: Node[];
  questions: Question[];
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  skillIds: string[];
  setSkillIds: React.Dispatch<React.SetStateAction<string[]>>;
  mathMode: "expression" | "equation";
  setMathMode: (v: "expression" | "equation") => void;
  nodeTitle: string;
  setNodeTitle: (v: string) => void;
  nodeKind: string;
  setNodeKind: (v: string) => void;
  parent: string;
  setParent: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
  statement: string;
  setStatement: (v: string) => void;
  qtype: string;
  setQtype: (v: string) => void;
  reference: string;
  setReference: (v: string) => void;
  hints: string;
  setHints: (v: string) => void;
  options: string;
  setOptions: (v: string) => void;
  mathVariables: string;
  setMathVariables: (v: string) => void;
  rubric: string;
  setRubric: (v: string) => void;
  hintAlternatives: string;
  setHintAlternatives: (v: string) => void;
  absoluteTolerance: number;
  setAbsoluteTolerance: (v: number) => void;
  relativeTolerance: number;
  setRelativeTolerance: (v: number) => void;
}) {
  const [visuals, setVisuals] = useState<QuestionVisual[]>([]);
  const [nodeSearch, setNodeSearch] = useState("");
  const [entryMode, setEntryMode] = useState("topic");
  const [source, setSource] = useState<QuestionSource>();
  const [difficulty, setDifficulty] = useState("");
  const [year, setYear] = useState("");
  const availableSkills = topic ? curriculumSkills(nodes, topic) : [];
  const visibleNodes = nodes.filter((n) => n.title.includes(nodeSearch.trim()));
  return (
    <>
      {view === "bank" && (
        <QuestionBank nodes={nodes} questions={questions} onSaved={refresh} />
      )}
      {view !== "bank" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {view === "resources"
              ? "فهرست مشترک کتاب‌ها، فصل‌ها و مباحث برای ثبت سؤال، تولید هوشمند و تمرین‌ها"
              : "سؤال مبحثی، آزاد یا پیش‌نویس با هوش مصنوعی"}
          </p>
          <Link
            href="/content"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#233B8F]"
          >
            بازگشت به بانک سؤال
          </Link>
        </div>
      )}
      {view === "add" && (
        <Link href="/content" className="text-sm text-[#233B8F]">
          بانک سؤال خصوصی · {fa(questions.length)} سؤال
        </Link>
      )}
      {view === "add" && (
        <nav
          aria-label="روش افزودن سؤال"
          className="flex flex-wrap gap-2 rounded-2xl bg-white/80 p-3"
        >
          {[
            ["topic", "سؤال مبحثی"],
            ["free", "سؤال آزاد"],
            ["ai", "با هوش مصنوعی"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={entryMode === id}
              onClick={() => setEntryMode(id)}
              className={`rounded-xl px-5 py-3 text-sm ${entryMode === id ? "bg-[#233B8F] text-white" : "bg-slate-50 text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className="grid min-w-0 gap-3">
        {view === "resources" && (
          <ContentSection
            title="کتاب‌ها و مباحث درسی"
            description="انتخاب پایه و رشته، مرور سرفصل‌ها و افزودن کتاب‌های رسمی"
            icon={<BookOpen className="size-5" />}
          >
            <CurriculumCatalog nodes={nodes} onImported={refresh} />
          </ContentSection>
        )}
        {view === "add" && entryMode === "ai" && (
          <ContentSection
            open
            title="تولید سؤال با هوش مصنوعی و بررسی معلم"
            description="تولید پیش‌نویس، اصلاح و تأیید نهایی پیش از ورود به بانک"
            icon={<Sparkles className="size-5" />}
          >
            <AiAuthoring nodes={nodes} onApproved={refresh} />
          </ContentSection>
        )}
        {view === "resources" && (
          <ContentSection
            title="ساختار آموزشی شما"
            description="افزودن مبحث، مهارت یا ساختار اختصاصی؛ جدا از کتاب‌های رسمی"
            icon={<Layers3 className="size-5" />}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/curriculum", {
                    title: nodeTitle,
                    kind: nodeKind,
                    ...(parent ? { parentId: parent } : {}),
                  });
                  setNodeTitle("");
                  await refresh();
                });
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field title="نوع">
                <select
                  value={nodeKind}
                  onChange={(e) => setNodeKind(e.target.value)}
                  className="w-full min-h-[46px] glass-field p-3"
                >
                  {[
                    ["system", "نظام آموزشی"],
                    ["level", "مقطع"],
                    ["grade", "پایه / برنامه"],
                    ["subject", "درس"],
                    ["course", "دوره"],
                    ["chapter", "فصل"],
                    ["topic", "مبحث"],
                    ["skill", "مهارت"],
                    ["objective", "هدف یادگیری"],
                  ].map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field title="عنوان">
                <input
                  required
                  value={nodeTitle}
                  onChange={(e) => setNodeTitle(e.target.value)}
                  className="w-full min-h-[46px] glass-field p-3"
                />
              </Field>
              <NodeSelector
                nodes={nodes}
                value={parent}
                onChange={setParent}
                disabled={busy}
              />
              <Button disabled={busy}>افزودن به ساختار</Button>
            </form>
            <div className="my-2 h-px bg-slate-200" />
            <Field title="جست‌وجو در ساختار آموزشی">
              <input
                type="search"
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="نام درس، فصل یا مبحث…"
                className="glass-field min-h-11 w-full p-3"
              />
            </Field>
            <div className="grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {visibleNodes.length === 0 && (
                <p className="p-3 text-sm text-slate-500">
                  {nodes.length
                    ? "عنوانی با این جست‌وجو پیدا نشد."
                    : "هنوز ساختار شخصی نساخته‌اید. می‌توانید کتاب‌های آماده را از بخش بالا اضافه کنید."}
                </p>
              )}
              {visibleNodes.map((n) => (
                <div key={n._id} className="flex flex-wrap items-center gap-3">
                  <span className="inline-block rounded-full border border-[#2ec8c333] bg-[#2ec8c314] px-3 py-1.5 text-[11px] text-[#08746f]">
                    {kindLabels[n.kind] ?? n.kind}
                  </span>
                  {n.title}
                  <small className="text-xs leading-loose text-slate-500">
                    {nodes.find((p) => p._id === n.parentId)?.title}
                  </small>
                </div>
              ))}
            </div>
          </ContentSection>
        )}
      </div>
      {view === "add" && entryMode !== "ai" && (
        <div className="mx-auto grid w-full max-w-4xl min-w-0 gap-5">
          <section className="glass-panel grid min-w-0 gap-5 p-5 sm:p-6">
            <div className="space-y-2 border-b border-slate-200/70 pb-4">
              <span className="text-xs font-medium text-teal-700">
                ثبت دستی توسط معلم
              </span>
              <h2 className="text-lg font-bold">افزودن سؤال تأییدشده</h2>
              <p className="text-xs leading-6 text-slate-500">
                مبحث، صورت سؤال و پاسخ مرجع را مشخص کنید؛ راهنماها اختیاری‌اند.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/questions", {
                    ...(entryMode === "free"
                      ? { classification: "free" }
                      : { topicId: topic }),
                    ...(source ? { source } : {}),
                    ...(difficulty ? { difficulty } : {}),
                    ...(year ? { year: Number(year) } : {}),
                    skillIds: entryMode === "free" ? [] : skillIds,
                    statement,
                    ...(visuals.length ? { visuals } : {}),
                    type: qtype,
                    reference,
                    tolerance: absoluteTolerance,
                    relativeTolerance,
                    ...(qtype === "symbolic"
                      ? {
                          mathContext: {
                            variables: mathVariables
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean),
                            domain: "real",
                            mode: mathMode,
                          },
                        }
                      : {}),
                    ...(["short", "essay"].includes(qtype) && rubric.trim()
                      ? {
                          rubric: rubric
                            .split("\n")
                            .filter(Boolean)
                            .map((criterion) => ({ criterion, weight: 1 })),
                        }
                      : {}),
                    hints: hints.split("\n").filter(Boolean),
                    ...(hintAlternatives.trim()
                      ? {
                          hintBank: [
                            ...hintAlternatives
                              .split("\n")
                              .filter(Boolean)
                              .map((text) => ({ level: 1, text })),
                            ...hints
                              .split("\n")
                              .filter(Boolean)
                              .slice(1)
                              .map((text, i) => ({ level: i + 2, text })),
                          ],
                        }
                      : {}),
                    options: options.split("\n").filter(Boolean),
                  });
                  setStatement("");
                  setVisuals([]);
                  setReference("");
                  setHints("");
                  setNotice("نسخه ثابت سؤال ذخیره شد.");
                  await refresh();
                });
              }}
              className="grid gap-[18px]"
            >
              {entryMode === "free" ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  سؤال آزاد بدون اتصال به کتاب یا مبحث ذخیره می‌شود. درجه سختی و
                  سال را می‌توانید مشخص کنید.
                </p>
              ) : (
                <TopicSelector
                  nodes={nodes}
                  value={topic}
                  onChange={(id) => {
                    if (id !== topic) setSkillIds([]);
                    setTopic(id);
                  }}
                  disabled={busy}
                  context="ثبت سؤال"
                  topicLabel="مبحث"
                />
              )}
              {entryMode !== "free" &&
                nodes.some((n) => n.kind === "skill") && (
                  <fieldset className="grid gap-[18px]">
                    <legend>مهارت‌های مرتبط (اختیاری)</legend>
                    {availableSkills.map((n) => (
                      <label
                        key={n._id}
                        className="flex-row items-center flex gap-2 text-[13px] text-slate-600"
                      >
                        <input
                          type="checkbox"
                          disabled={!topic}
                          checked={skillIds.includes(n._id)}
                          onChange={(e) =>
                            setSkillIds(
                              e.target.checked
                                ? [...skillIds, n._id]
                                : skillIds.filter((s) => s !== n._id),
                            )
                          }
                          className="size-5 min-h-5 shrink-0 cursor-pointer accent-[#1f3f97]"
                        />
                        {n.title}
                      </label>
                    ))}
                  </fieldset>
                )}
              <SourceEditor
                value={source}
                onChange={setSource}
                disabled={busy}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="درجه سختی">
                  <select
                    className="glass-field min-h-11 w-full p-3"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    <option value="">تعیین نشده</option>
                    <option value="easy">آسان</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">سخت</option>
                  </select>
                </Field>
                <Field title="سال سؤال (شمسی)">
                  <input
                    type="number"
                    min={1300}
                    max={1500}
                    placeholder="مثلاً ۱۴۰۵"
                    className="glass-field min-h-11 w-full p-3"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </Field>
              </div>
              <Field title="صورت سؤال">
                <textarea
                  required
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  className="w-full min-h-[100px] resize-y glass-field p-3"
                />
              </Field>
              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  افزودن نمودار، شکل یا فرمول به سؤال دستی
                </summary>
                <div className="mt-3">
                  <VisualEditor
                    value={visuals}
                    onChange={setVisuals}
                    disabled={busy}
                  />
                </div>
              </details>
              <Field title="روش پاسخ">
                <select
                  value={qtype}
                  onChange={(e) => setQtype(e.target.value)}
                  className="w-full min-h-[46px] glass-field p-3"
                >
                  {[
                    ["numeric", "عددی قطعی"],
                    ["symbolic", "عبارت / معادله محدود با دامنه حقیقی"],
                    ["choice", "چندگزینه‌ای"],
                    ["short", "متن کوتاه با تطبیق دقیق"],
                    ["essay", "تشریحی با بررسی معلم"],
                  ].map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              {qtype === "numeric" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field title="تلورانس مطلق">
                    <input
                      type="number"
                      min={0}
                      max={1e9}
                      step="any"
                      value={absoluteTolerance}
                      onChange={(e) =>
                        setAbsoluteTolerance(Number(e.target.value))
                      }
                      className="min-h-11 glass-field p-3"
                    />
                  </Field>
                  <Field title="تلورانس نسبی (۰ تا ۱)">
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step="any"
                      value={relativeTolerance}
                      onChange={(e) =>
                        setRelativeTolerance(Number(e.target.value))
                      }
                      className="min-h-11 glass-field p-3"
                    />
                  </Field>
                </div>
              )}
              {qtype === "symbolic" && (
                <div className="grid gap-3">
                  <Field title="نوع پاسخ ریاضی">
                    <select
                      value={mathMode}
                      onChange={(e) =>
                        setMathMode(e.target.value as "expression" | "equation")
                      }
                      className="min-h-11 glass-field p-3"
                    >
                      <option value="expression">
                        عبارت چندجمله‌ای / کسر عددی
                      </option>
                      <option value="equation">
                        معادله خطی با دامنه حقیقی
                      </option>
                    </select>
                  </Field>
                  <Field title="متغیرهای مجاز (جداشده با ویرگول انگلیسی)">
                    <input
                      required
                      value={mathVariables}
                      onChange={(e) => setMathVariables(e.target.value)}
                      dir="ltr"
                      className="min-h-11 glass-field p-3"
                    />
                  </Field>
                  <small className="text-xs text-slate-500">
                    حداکثر سه متغیر، درجه چهار، مخرج ثابت غیرصفر؛ توابع و مخرج
                    متغیر به بررسی معلم می‌روند.
                  </small>
                </div>
              )}
              {["short", "essay"].includes(qtype) && (
                <Field title="معیارهای بررسی معلم (هر خط یک معیار)">
                  <textarea
                    value={rubric}
                    onChange={(e) => setRubric(e.target.value)}
                    className="min-h-24 glass-field p-3"
                  />
                </Field>
              )}
              {qtype === "choice" && (
                <Field title="گزینه‌ها (هر خط یک گزینه)">
                  <textarea
                    required
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    className="w-full min-h-[100px] resize-y glass-field p-3"
                  />
                </Field>
              )}
              <Field title="پاسخ مرجع خصوصی">
                <textarea
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full min-h-[100px] resize-y glass-field p-3"
                />
              </Field>
              <Field title="راهنمایی‌های تأییدشده (هر خط یک راهنما، حداکثر ۳)">
                <textarea
                  value={hints}
                  onChange={(e) => setHints(e.target.value)}
                  className="w-full min-h-[100px] resize-y glass-field p-3"
                />
              </Field>
              <details className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  راهنماهای جایگزین (اختیاری)
                </summary>
                <div className="mt-4">
                  <Field title="گزینه‌های راهنمایی سطح اول برای انتخاب همیار (اختیاری، هر خط یک راهنما)">
                    <textarea
                      value={hintAlternatives}
                      onChange={(e) => setHintAlternatives(e.target.value)}
                      className="min-h-24 glass-field p-3"
                    />
                  </Field>
                </div>
              </details>
              <small className="text-xs leading-loose text-slate-500">
                با ثبت سؤال، صحت محتوا و عدم افشای پاسخ در راهنمایی‌ها را بررسی
                کرده‌اید.
              </small>
              <Button
                disabled={
                  busy ||
                  (entryMode !== "free" && !topic) ||
                  !questionVisualsSchema.safeParse(visuals).success
                }
              >
                تأیید و ذخیره سؤال
              </Button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

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
function ContentSection({
  open,
  title,
  description,
  icon,
  children,
}: {
  open?: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className="group min-w-0 rounded-2xl border border-slate-200/80 bg-white/75 open:bg-white/90"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#233B8F] [&::-webkit-details-marker]:hidden sm:p-5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#233B8F]/5 text-[#233B8F]"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-bold text-slate-800 sm:text-base">
            {title}
          </h2>
          <p className="text-xs leading-6 text-slate-500">{description}</p>
        </div>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="grid min-w-0 gap-4 border-t border-slate-100 p-4 sm:p-5">
        {children}
      </div>
    </details>
  );
}
