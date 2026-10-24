"use client";
import { useEffect, useState } from "react";
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
  "w-full rounded-xl border border-slate-300 bg-white p-3 focus:outline-2 focus:outline-[#233B8F]";
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
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const refresh = () =>
    api<QuestionDraft[]>("/question-drafts").then(setDrafts);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
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
    <section className="grid gap-4 glass-panel p-5">
      <h2 className="text-lg font-bold">
        تولید سؤال با هوش مصنوعی و بررسی معلم
      </h2>
      <p className="text-sm leading-loose text-slate-600">
        مدل محلی فقط پیش‌نویس می‌سازد. صحت، تناسب سنی و راهنماها را بررسی و
        اصلاح کنید؛ پیش از تأیید شما هیچ پیش‌نویسی وارد بانک یا مأموریت نمی‌شود.
        تولید واقعی به Ollama نیاز دارد.
      </p>
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
            await api("/question-drafts/generate", {
              topicId: topic,
              type,
              brief,
            });
            await refresh();
            setNotice("پیش‌نویس برای بررسی آماده است.");
          });
        }}
      >
        <Field title="مبحث تولید سؤال">
          <select
            className={input}
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
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
        <Button disabled={busy}>
          {busy ? "در حال انجام…" : "تولید یک پیش‌نویس با مدل محلی"}
        </Button>
      </form>
      <h3 className="font-bold">صف بررسی سؤال‌های تولیدشده</h3>
      {!drafts.length && (
        <p className="text-sm text-slate-500">پیش‌نویس بررسی‌نشده‌ای ندارید.</p>
      )}
      {drafts.map((d) => (
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
      ))}
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
  const [q, setQ] = useState(draft.question),
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
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void approve(q);
        }}
      >
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
        <Button disabled={busy || !confirmed}>
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
