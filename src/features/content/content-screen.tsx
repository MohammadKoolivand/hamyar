"use client";
import { AiAuthoring } from "./ai-authoring";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { fa } from "@/lib/presentation";
import type { Node, Question } from "@/lib/types";

export function ContentScreen({
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
  return (
    <>
      <AiAuthoring nodes={nodes} onApproved={refresh} />
      <div className="grid gap-[22px] min-[951px]:grid-cols-2">
        <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
          <h2 className="text-[19px] font-bold">ساختار آموزشی شما</h2>
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
            className="grid gap-[18px]"
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
            <Field title="زیرمجموعه (اختیاری)">
              <select
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                className="w-full min-h-[46px] glass-field p-3"
              >
                <option value="">مستقل</option>
                {nodes.map((n) => (
                  <option key={n._id} value={n._id}>
                    {n.title} ({n.kind})
                  </option>
                ))}
              </select>
            </Field>
            <Button disabled={busy}>افزودن به ساختار</Button>
          </form>
          <div className="my-2 h-px bg-slate-200" />
          {nodes.map((n) => (
            <div key={n._id} className="flex flex-wrap items-center gap-3">
              <span className="inline-block rounded-full border border-[#2ec8c333] bg-[#2ec8c314] px-3 py-1.5 text-[11px] text-[#08746f]">
                {n.kind}
              </span>
              {n.title}
              <small className="text-xs leading-loose text-slate-500">
                {nodes.find((p) => p._id === n.parentId)?.title}
              </small>
            </div>
          ))}
        </section>
        <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
          <h2 className="text-[19px] font-bold">افزودن سؤال تأییدشده</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("/questions", {
                  topicId: topic,
                  skillIds,
                  statement,
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
                setReference("");
                setHints("");
                setNotice("نسخه ثابت سؤال ذخیره شد.");
                await refresh();
              });
            }}
            className="grid gap-[18px]"
          >
            <Field title="مبحث">
              <select
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full min-h-[46px] glass-field p-3"
              >
                <option value="">انتخاب مبحث</option>
                {nodes
                  .filter((n) => n.kind === "topic")
                  .map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.title}
                    </option>
                  ))}
              </select>
            </Field>
            {nodes.some((n) => n.kind === "skill") && (
              <fieldset className="grid gap-[18px]">
                <legend>مهارت‌های مرتبط (اختیاری)</legend>
                {nodes
                  .filter((n) => n.kind === "skill")
                  .map((n) => (
                    <label
                      key={n._id}
                      className="flex-row items-center flex gap-2 text-[13px] text-slate-600"
                    >
                      <input
                        type="checkbox"
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
            <Field title="صورت سؤال">
              <textarea
                required
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                className="w-full min-h-[100px] resize-y glass-field p-3"
              />
            </Field>
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
                    <option value="equation">معادله خطی با دامنه حقیقی</option>
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
            <Field title="گزینه‌های راهنمایی سطح اول برای انتخاب همیار (اختیاری، هر خط یک راهنما)">
              <textarea
                value={hintAlternatives}
                onChange={(e) => setHintAlternatives(e.target.value)}
                className="min-h-24 glass-field p-3"
              />
            </Field>
            <small className="text-xs leading-loose text-slate-500">
              با ثبت سؤال، صحت محتوا و عدم افشای پاسخ در راهنمایی‌ها را بررسی
              کرده‌اید.
            </small>
            <Button disabled={busy || !topic}>تأیید و ذخیره سؤال</Button>
          </form>
        </section>
        <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px] col-span-full">
          <h2 className="text-[19px] font-bold">
            بانک سؤال خصوصی · {fa(questions.length)} سؤال
          </h2>
          {questions.map((q) => (
            <div
              key={q._id}
              className="grid gap-3 glass-option p-[18px]"
            >
              <p>{q.statement}</p>
              <small className="text-xs leading-loose text-slate-500">
                {nodes.find((n) => n._id === q.topicId)?.title} · {q.type} ·
                نسخه ۱
              </small>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
