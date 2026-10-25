"use client";
import { PagedList } from "@/components/ui/paged-list";
import { SourceEditor } from "./source-editor";
import type { QuestionSource } from "@/lib/question-source";
import { useEffect, useState } from "react";
import { VisualEditor } from "./visual-editor";
import {
  QuestionPresentation,
  MathText,
} from "@/components/question-presentation";
import {
  questionVisualsSchema,
  type QuestionVisual,
} from "@/lib/question-visuals";
import { TopicSelector } from "./topic-selector";
import { api } from "@/lib/api";
import type { Node } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
type QuestionDraft = {
  _id: string;
  provider: string;
  model: string;
  validationIssues?: string[];
  question: {
    visuals?: QuestionVisual[];
    visualKind?: string;
    source?: QuestionSource;
    difficulty?: string;
    year?: number;
    topicId: string;
    skillIds: string[];
    statement: string;
    reference: string;
    type: string;
    options: string[];
    hints: string[];
  };
};
const input =
  "w-full rounded-xl border border-slate-300 bg-white p-3 focus:outline-2 focus:outline-[#1F3F97]";
export function AiAuthoring({
  nodes,
  onApproved,
}: {
  nodes: Node[];
  onApproved: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]),
    [topic, setTopic] = useState(""),
    [brief, setBrief] = useState(""),
    [type, setType] = useState("numeric"),
    [visualKind, setVisualKind] = useState("none"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [batchCount, setBatchCount] = useState(1);
  const [targetDifficulty, setTargetDifficulty] = useState("medium");
  const [authoringModel, setAuthoringModel] = useState("");
  const refresh = () =>
    api<QuestionDraft[]>("/question-drafts").then(setDrafts);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    api<{ model: string }>("/settings/authoring")
      .then((s) => setAuthoringModel(s.model))
      .catch((e) => setError(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid min-w-0 gap-5">
      <p className="text-sm leading-loose text-slate-600">
        هوش مصنوعی فقط پیش‌نویس می‌سازد. صحت، تناسب سنی و راهنماها را بررسی و
        اصلاح کنید؛ پیش از تأیید شما هیچ پیش‌نویسی وارد بانک یا مأموریت نمی‌شود.
        مدل تولید سؤال را در تنظیمات AvvalAI انتخاب کنید.
      </p>
      <p className="text-xs text-slate-500">
        مدل انتخاب‌شده:{" "}
        <span dir="ltr">{authoringModel || "هنوز انتخاب نشده"}</span>
      </p>
      <a
        href="/settings"
        className="text-sm text-[#233B8F] underline underline-offset-4"
      >
        انتخاب مدل AvvalAI در تنظیمات
      </a>
      {error && (
        <p role="alert" className="text-rose-800">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            let completed = 0;
            try {
              for (let i = 0; i < batchCount; i++) {
                await api("/question-drafts/generate", {
                  topicId: topic,
                  type,
                  brief:
                    batchCount > 1
                      ? `${brief}\nسؤال ${i + 1} از مجموعهٔ ${batchCount} سوالی؛ یک سؤال مستقل و متفاوت طراحی کن.`
                      : brief,
                  difficulty: targetDifficulty,
                  visualKind,
                });
                completed++;
                setNotice(
                  `${completed} از ${batchCount} پیش‌نویس تولید شد؛ تأیید معلم لازم است.`,
                );
              }
            } finally {
              await refresh();
            }
          });
        }}
      >
        <TopicSelector
          nodes={nodes}
          value={topic}
          onChange={setTopic}
          disabled={busy}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field title="تعداد سؤال تولیدی">
            <input
              className={input}
              required
              type="number"
              min={1}
              max={5}
              value={batchCount}
              onChange={(e) => setBatchCount(Number(e.target.value))}
            />
          </Field>
          <Field title="درجه سختی هدف">
            <select
              className={input}
              value={targetDifficulty}
              onChange={(e) => setTargetDifficulty(e.target.value)}
            >
              <option value="easy">آسان</option>
              <option value="medium">متوسط</option>
              <option value="hard">سخت</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          هر بار تا ۵ پیش‌نویس با مدل تنظیم‌شده تولید می‌شود؛ هزینهٔ هر درخواست
          جداست و ورود به بانک نیازمند تأیید شماست. در صورت توقف، موارد تولیدشده
          در صف بررسی می‌مانند.
        </p>
        <Field title="حوزه، پایه و هدف سؤال">
          <textarea
            className={input}
            required
            minLength={5}
            maxLength={1000}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="پایه و سطح دشواری، هدف آموزشی و محدودیت‌های محتوا را بنویسید."
          />
        </Field>
        <Field title="محتوای سؤال تولیدی">
          <select
            className={input}
            value={visualKind}
            onChange={(e) => setVisualKind(e.target.value)}
          >
            <option value="none">متنی</option>
            <option value="chart">دارای نمودار</option>
            <option value="geometry">دارای شکل هندسی یا پیکان</option>
            <option value="formula">دارای فرمول یا معادله</option>
          </select>
        </Field>
        <Field title="نوع سؤال تولیدی">
          <select
            className={input}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="numeric">عددی</option>
            <option value="choice">گزینه‌ای</option>
            <option value="short">متن کوتاه</option>
            <option value="essay">تشریحی با بررسی انسانی</option>
          </select>
        </Field>
        <Button disabled={busy || !topic}>
          {busy ? "در حال انجام…" : "تولید پیش‌نویس سؤال"}
        </Button>
      </form>
      <h3 className="font-bold">صف بررسی سؤال‌های تولیدشده</h3>
      {!drafts.length && (
        <p className="text-sm text-slate-500">پیش‌نویس بررسی‌نشده‌ای ندارید.</p>
      )}
      <PagedList items={drafts} label="پیش‌نویس سؤال">
        {(d) => (
          <DraftReview
            key={d._id}
            draft={d}
            busy={busy}
            approve={(question) =>
              run(async () => {
                await api(`/question-drafts/${d._id}/approve`, {
                  question,
                  confirmed: true,
                });
                await refresh();
                await onApproved();
                setNotice("سؤال پس از تأیید شما به بانک اضافه شد.");
              })
            }
            reject={(reason) =>
              run(async () => {
                await api(`/question-drafts/${d._id}/reject`, { reason });
                await refresh();
                setNotice("پیش‌نویس رد شد.");
              })
            }
          />
        )}
      </PagedList>
    </section>
  );
}
function DraftReview({
  draft,
  busy,
  approve,
  reject,
}: {
  draft: QuestionDraft;
  busy: boolean;
  approve: (q: QuestionDraft["question"]) => Promise<void>;
  reject: (reason: string) => Promise<void>;
}) {
  const [q, setQ] = useState<QuestionDraft["question"]>({
      ...draft.question,
      source: draft.question.source ?? {
        family: "practice" as const,
        practice: "ai" as const,
      },
    }),
    [confirmed, setConfirmed] = useState(false),
    [reason, setReason] = useState("");
  return (
    <article className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4">
      <p className="text-sm">
        پیش‌نویس تأییدنشده · {draft.provider} / {draft.model}
      </p>
      {!!draft.validationIssues?.length && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          نیازمند اصلاح پیش از تأیید: {draft.validationIssues.join("؛ ")}
        </p>
      )}
      <div className="rounded-xl bg-slate-50 p-4">
        <h4 className="mb-3 text-sm font-bold">
          پیش‌نمایش سؤال برای دانش‌آموز
        </h4>
        <QuestionPresentation statement={q.statement} visuals={q.visuals} />
        {q.options.map((option, i) => (
          <p className="text-sm leading-7" key={i}>
            {i + 1}. <MathText text={option} />
          </p>
        ))}
      </div>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void approve(q);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field title="درجه سختی پیشنهادی">
            <select
              className={input}
              value={q.difficulty ?? ""}
              onChange={(e) =>
                setQ({ ...q, difficulty: e.target.value || undefined })
              }
            >
              <option value="">تعیین نشده</option>
              <option value="easy">آسان</option>
              <option value="medium">متوسط</option>
              <option value="hard">سخت</option>
            </select>
          </Field>
          <Field title="سال سؤال پیشنهادی (شمسی)">
            <input
              type="number"
              min={1300}
              max={1500}
              className={input}
              value={q.year ?? ""}
              onChange={(e) =>
                setQ({
                  ...q,
                  year: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </Field>
        </div>
        <SourceEditor
          value={q.source}
          onChange={(source) => setQ({ ...q, source })}
          disabled={busy}
        />
        <Field title="صورت سؤال پیشنهادی">
          <textarea
            required
            className={input}
            value={q.statement}
            onChange={(e) => setQ({ ...q, statement: e.target.value })}
          />
        </Field>
        <Field title="پاسخ مرجع پیشنهادی خصوصی">
          <textarea
            required
            className={input}
            value={q.reference}
            onChange={(e) => setQ({ ...q, reference: e.target.value })}
          />
        </Field>
        {q.type === "choice" && (
          <Field title="گزینه‌های پیشنهادی، هر خط یک گزینه">
            <textarea
              className={input}
              value={q.options.join("\n")}
              onChange={(e) =>
                setQ({ ...q, options: e.target.value.split("\n") })
              }
            />
          </Field>
        )}
        <Field title="راهنماهای پیشنهادی، هر خط یک راهنما">
          <textarea
            className={input}
            value={q.hints.join("\n")}
            onChange={(e) =>
              setQ({ ...q, hints: e.target.value.split("\n").filter(Boolean) })
            }
          />
        </Field>
        <VisualEditor
          value={q.visuals ?? []}
          onChange={(visuals) => {
            setQ({ ...q, visuals });
            setConfirmed(false);
          }}
          disabled={busy}
        />
        <label className="flex items-start gap-2 text-sm leading-loose">
          <input
            required
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          صحت سؤال و پاسخ مرجع، تناسب سنی و عدم افشای جواب در راهنماها را بررسی
          و تأیید می‌کنم.
        </label>
        <Button
          disabled={
            busy ||
            !confirmed ||
            !questionVisualsSchema.safeParse(q.visuals ?? []).success ||
            Boolean(
              q.visualKind &&
              q.visualKind !== "none" &&
              !q.visuals?.some((v) => v.kind === q.visualKind),
            )
          }
        >
          تأیید و افزودن به بانک سؤال
        </Button>
      </form>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void reject(reason);
        }}
      >
        <Field title="دلیل رد پیش‌نویس">
          <input
            className={input}
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Button variant="outline" disabled={busy}>
          رد پیش‌نویس
        </Button>
      </form>
    </article>
  );
}
