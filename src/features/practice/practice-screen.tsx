"use client";
import {
  QuestionPresentation,
  MathText,
} from "@/components/question-presentation";
import { practiceAnswer, feedbackVisible } from "@/lib/practice-answer";
import { clsx } from "clsx";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { fa, stateLabel } from "@/lib/presentation";
import { api } from "@/lib/api";
import type { Assignment, User, Report } from "@/lib/types";
export function PracticeScreen({
  active,
  qi,
  answer,
  me,
  busy,
  setAnswer,
  setQi,
  run,
  reloadActive,
  setNotice,
  setActive,
  setReport,
  refresh,
  setPage,
}: {
  active: Assignment;
  qi: number;
  answer: string;
  me: User;
  busy: boolean;
  setAnswer: (v: string) => void;
  setQi: (v: number) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
  reloadActive: () => Promise<void>;
  setNotice: (v: string) => void;
  setActive: (v: Assignment) => void;
  setReport: (v: Report) => void;
  refresh: () => Promise<void>;
  setPage: (v: string) => void;
}) {
  const q = active.questions![qi],
    p = active.progress[q._id],
    attempts =
      active.attempts?.filter((a) => a.questionVersionId === q._id) ?? [],
    last = attempts.at(-1),
    ev = active.evaluations?.find((e) => e.attemptId === last?._id);
  const finished = ["submitted", "completed", "cancelled"].includes(
    active.state,
  );
  const showFeedback = feedbackVisible(active.policy, active.state);
  async function saveQuestion(index: number) {
    if (finished) return;
    const question = active.questions![index];
    const value =
      index === qi
        ? answer
        : practiceAnswer(active, question._id, localStorage);
    const fresh = await api<Assignment>("/assignments/" + active._id);
    const previous = fresh.attempts
      ?.filter((t) => t.questionVersionId === question._id)
      .sort((x, y) => y.sequence - x.sequence)[0];
    if (
      !value.trim() ||
      value === previous?.answer ||
      fresh.progress[question._id].attempts >= fresh.policy.maxAttempts
    )
      return;
    const result = await api<{ evaluation?: { result: string } }>(
      "/assignments/" + active._id + "/attempts",
      {
        questionId: question._id,
        answer: value,
        expectedAttempt: fresh.progress[question._id].attempts + 1,
      },
    );
    localStorage.removeItem(
      "draft:" + me._id + ":" + active._id + ":" + question._id,
    );
    return result.evaluation?.result;
  }
  const moveQuestion = (next: number) => {
    if (busy || next < 0 || next >= active.questions!.length) return;
    run(async () => {
      const result = await saveQuestion(qi);
      await reloadActive();
      if (showFeedback && result)
        setNotice(`نتیجه سؤال ${fa(qi + 1)}: ${stateLabel[result] ?? result}`);
      setQi(next);
      setAnswer(
        practiceAnswer(active, active.questions![next]._id, localStorage),
      );
    });
  };
  return (
    <>
      <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
            سؤال {fa(qi + 1)} از {fa(active.questions!.length)}
          </span>
          <h2 className="text-[19px] font-bold">{active.title}</h2>
          <small className="text-xs leading-loose text-slate-500">
            پاسخ با رفتن به سؤال بعد یا پایان تمرین ذخیره می‌شود
          </small>
        </div>
        <progress
          aria-label="پیشرفت پاسخ‌گویی مأموریت"
          value={
            active.questions!.filter((q) => active.progress[q._id].attempts > 0)
              .length
          }
          max={active.questions!.length}
          className="hy-practice-progress w-full accent-[#2EC8C3]"
        />
        <div className="practice-sheet min-w-0 px-5 py-6">
          <QuestionPresentation statement={q.statement} visuals={q.visuals} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await saveQuestion(qi);
              await reloadActive();
              setNotice(
                showFeedback
                  ? "پاسخ ذخیره و بررسی شد."
                  : "پاسخ ذخیره شد؛ نتیجه در پایان تمرین نمایش داده می‌شود.",
              );
            });
          }}
          className="grid gap-[18px]"
        >
          {q.type === "choice" ? (
            <fieldset
              disabled={
                busy || finished || p.attempts >= active.policy.maxAttempts
              }
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <legend className="mb-2 text-sm font-medium text-slate-500">
                برای انتخاب پاسخ روی گزینه بزنید
              </legend>
              {q.options.map((option, i) => (
                <label
                  key={i}
                  className="group relative block cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-60"
                >
                  <input
                    type="radio"
                    name={`answer-${q._id}`}
                    value={option}
                    checked={answer === option}
                    required
                    onChange={() => {
                      setAnswer(option);
                      localStorage.setItem(
                        "draft:" + me._id + ":" + active._id + ":" + q._id,
                        option,
                      );
                    }}
                    className="peer sr-only"
                  />
                  <span className="flex h-full min-h-12 items-center gap-3 rounded-xl border border-slate-200/80 bg-white/40 px-3 py-2.5 text-sm leading-7 backdrop-blur-xl transition-colors hover:border-blue-300 hover:bg-blue-50/50 peer-checked:border-blue-400 peer-checked:bg-blue-50/70 peer-checked:text-[#233B8F] peer-checked:shadow-[0_0_0_1px_rgba(96,165,250,0.3),0_4px_18px_rgba(59,130,246,0.1)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-blue-500">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-xs group-has-checked:border-blue-300 group-has-checked:bg-blue-100/80 group-has-checked:text-blue-800"
                    >
                      {fa(i + 1)}
                    </span>
                    <span className="min-w-0 break-words">
                      <MathText text={option} />
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <Field title="پاسخ شما">
              <textarea
                required
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  localStorage.setItem(
                    "draft:" + me._id + ":" + active._id + ":" + q._id,
                    e.target.value,
                  );
                }}
                placeholder="ابتدا خودت تلاش کن…"
                className="w-full min-h-[100px] resize-y glass-field p-3"
              />
            </Field>
          )}
          <small className="text-xs leading-loose text-slate-500">
            {active.policy.feedbackMode === "end"
              ? "نتیجه در پایان تمرین · "
              : "نتیجه پس از ثبت پاسخ · "}
            تلاش ثبت‌شده: {fa(p.attempts)} از {fa(active.policy.maxAttempts)} ·
            راهنمایی استفاده‌شده: {fa(p.hints)} از{" "}
            {fa(active.policy.independent ? 0 : active.policy.maxHints)}
          </small>
          {p.attempts >= active.policy.maxAttempts && (
            <p
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm leading-7 text-amber-900"
            >
              تعداد تلاش مجاز این سؤال تمام شده است. می‌توانید سؤال را مرور کنید
              یا به سؤال بعدی بروید؛ تلاش بیشتر نیاز به مأموریت جدید معلم دارد.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {active.policy.feedbackMode !== "end" && (
              <Button
                disabled={
                  busy ||
                  finished ||
                  p.attempts >= active.policy.maxAttempts ||
                  !answer.trim() ||
                  answer === last?.answer
                }
              >
                ثبت و بررسی پاسخ
              </Button>
            )}
            {active.policy.allowFullSolution &&
              active.policy.maxHintLevel === 4 &&
              !active.policy.independent && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || p.hints >= active.policy.maxHints}
                  onClick={() =>
                    run(async () => {
                      await api("/assignments/" + active._id + "/hints", {
                        questionId: q._id,
                        expectedHintLevel: p.hints + 1,
                        level: 4,
                      });
                      await reloadActive();
                    })
                  }
                >
                  مشاهده پاسخ کامل مجاز
                </Button>
              )}
            <Button
              type="button"
              variant="outline"
              disabled={
                busy ||
                active.policy.independent ||
                active.policy.maxHintLevel === 0 ||
                p.hints >= active.policy.maxHints
              }
              onClick={() =>
                run(async () => {
                  await api("/assignments/" + active._id + "/hints", {
                    questionId: q._id,
                    expectedHintLevel: p.hints + 1,
                  });
                  await reloadActive();
                })
              }
            >
              <Sparkles size={16} />
              درخواست راهنمایی
            </Button>
          </div>
        </form>
        {showFeedback && ev && (
          <div
            className={clsx(
              "rounded-[14px] p-3.5 leading-[1.9]",
              ev.result === "incorrect"
                ? "hy-status-error"
                : "hy-status-success",
            )}
          >
            {stateLabel[ev.result]} ·{" "}
            {last!.hintsUsed ? "با دریافت کمک" : "بدون دریافت کمک"}
          </div>
        )}
        {active.hints
          ?.filter((h) => h.questionVersionId === q._id)
          .map((h) => (
            <div key={h._id} className="glass-note p-3.5 leading-[1.9]">
              {h.text}
              <br />
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(
                      "/assignments/" +
                        active._id +
                        "/hints/" +
                        h._id +
                        "/report",
                      {
                        reason:
                          "این راهنما برای این تمرین نیازمند بررسی معلم است.",
                      },
                    );
                    setNotice("گزارش برای معلم ثبت شد.");
                  })
                }
              >
                گزارش راهنمای نامناسب
              </Button>
              <small className="text-xs leading-loose text-slate-500">
                {h.provider === "avalai"
                  ? `انتخاب راهنما با AvvalAI (${h.model}) از راهنماهای تأییدشده معلم`
                  : h.provider === "ollama"
                    ? `انتخاب همیار محلی (${h.model}) از راهنماهای تأییدشده`
                    : h.provider === "teacher-solution"
                      ? "پاسخ مرجع با اجازه صریح معلم"
                      : "راهنمای تأییدشده معلم · حالت آزمایشی Mock"}
              </small>
            </div>
          ))}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={busy || qi === 0}
              onClick={() => moveQuestion(qi - 1)}
            >
              سؤال قبلی
            </Button>
            <Button
              variant="outline"
              disabled={busy || qi === active.questions!.length - 1}
              onClick={() => moveQuestion(qi + 1)}
            >
              سؤال بعدی
            </Button>
          </div>
          <button
            type="button"
            className="min-h-11 cursor-pointer rounded-lg px-2 text-sm text-slate-500 underline-offset-4 hover:text-[#233B8F] hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              run(async () => {
                for (let i = 0; i < active.questions!.length; i++)
                  await saveQuestion(i);
                await reloadActive();
                const current = await api<Assignment>(
                  "/assignments/" + active._id,
                );
                const missing = current.questions!.findIndex(
                  (question) => !current.progress[question._id].attempts,
                );
                if (
                  missing >= 0 &&
                  !window.confirm(
                    "بعضی سؤال‌ها بی‌پاسخ مانده‌اند. تمرین با ثبت سؤال‌های نزده پایان یابد؟",
                  )
                ) {
                  setQi(missing);
                  setAnswer(
                    practiceAnswer(
                      current,
                      current.questions![missing]._id,
                      localStorage,
                    ),
                  );
                  return;
                }
                await api(
                  "/assignments/" + active._id + "/complete",
                  missing >= 0 ? { allowUnanswered: true } : {},
                );
                setActive(await api("/assignments/" + active._id));
                setReport(await api("/assignments/" + active._id + "/report"));
                await refresh();
                setPage("report");
              })
            }
          >
            پایان تمرین و گزارش
          </button>
        </div>
      </section>
      <p className="text-xs leading-loose text-slate-500">
        پیش‌نویس پاسخ روی همین مرورگر حفظ می‌شود. برای ثبت نهایی، اتصال به سرور
        لازم است.
      </p>
    </>
  );
}
