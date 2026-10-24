"use client";
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
  return (
    <>
      <section className="glass-panel p-[26px] max-[650px]:p-5 grid gap-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-block rounded-full border border-[#19b7ae33] bg-[#19b7ae14] px-3 py-1.5 text-[11px] text-[#096c67]">
            سؤال {fa(qi + 1)} از {fa(active.questions!.length)}
          </span>
          <h2 className="text-[19px] font-bold">{active.title}</h2>
          <small className="text-xs leading-loose text-slate-500">
            پاسخ‌ها در سرور ثبت می‌شوند
          </small>
        </div>
        <progress
          aria-label="پیشرفت پاسخ‌گویی مأموریت"
          value={
            active.questions!.filter((q) => active.progress[q._id].attempts > 0)
              .length
          }
          max={active.questions!.length}
          className="w-full accent-[#19b7ae]"
        />
        <p className="practice-sheet px-5 py-6 text-[21px] leading-[2.2] whitespace-pre-wrap">{q.statement}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/assignments/" + active._id + "/attempts", {
                questionId: q._id,
                answer,
                expectedAttempt: p.attempts + 1,
              });
              localStorage.removeItem(
                "draft:" + me._id + ":" + active._id + ":" + q._id,
              );
              await reloadActive();
              setNotice("پاسخ شما ثبت شد.");
            });
          }}
          className="grid gap-[18px]"
        >
          <Field title="پاسخ شما">
            {q.type === "choice" ? (
              <select
                required
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  localStorage.setItem(
                    "draft:" + me._id + ":" + active._id + ":" + q._id,
                    e.target.value,
                  );
                }}
                className="w-full min-h-[46px] glass-field p-3"
              >
                <option value="">انتخاب پاسخ</option>
                {q.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
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
            )}
          </Field>
          <small className="text-xs leading-loose text-slate-500">
            تلاش ثبت‌شده: {fa(p.attempts)} از {fa(active.policy.maxAttempts)} ·
            راهنمایی استفاده‌شده: {fa(p.hints)} از{" "}
            {fa(active.policy.independent ? 0 : active.policy.maxHints)}
          </small>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || p.attempts >= active.policy.maxAttempts}>
              ثبت و بررسی پاسخ
            </Button>
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
        {ev && (
          <div
            className={clsx(
              "rounded-[14px] p-3.5 leading-[1.9]",
              ev.result === "incorrect"
                ? "bg-rose-50 text-rose-800"
                : "bg-indigo-50 text-[#233b8f]",
            )}
          >
            {stateLabel[ev.result]} ·{" "}
            {last!.hintsUsed ? "با دریافت کمک" : "بدون دریافت کمک"}
          </div>
        )}
        {active.hints
          ?.filter((h) => h.questionVersionId === q._id)
          .map((h) => (
            <div
              key={h._id}
              className="glass-note p-3.5 leading-[1.9]"
            >
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
                {h.provider === "ollama"
                  ? `انتخاب همیار محلی (${h.model}) از راهنماهای تأییدشده`
                  : h.provider === "teacher-solution"
                    ? "پاسخ مرجع با اجازه صریح معلم"
                    : "راهنمای تأییدشده معلم · حالت آزمایشی Mock"}
              </small>
            </div>
          ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={qi === 0}
            onClick={() => {
              const next = qi - 1;
              setQi(next);
              setAnswer(
                localStorage.getItem(
                  "draft:" +
                    me._id +
                    ":" +
                    active._id +
                    ":" +
                    active.questions![next]._id,
                ) ?? "",
              );
            }}
          >
            سؤال قبلی
          </Button>
          <Button
            variant="outline"
            disabled={qi === active.questions!.length - 1}
            onClick={() => {
              const next = qi + 1;
              setQi(next);
              setAnswer(
                localStorage.getItem(
                  "draft:" +
                    me._id +
                    ":" +
                    active._id +
                    ":" +
                    active.questions![next]._id,
                ) ?? "",
              );
            }}
          >
            سؤال بعدی
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/assignments/" + active._id + "/complete", {});
                setActive(await api("/assignments/" + active._id));
                setReport(await api("/assignments/" + active._id + "/report"));
                await refresh();
                setPage("report");
              })
            }
          >
            پایان مأموریت و دریافت گزارش
          </Button>
        </div>
      </section>
      <p className="text-xs leading-loose text-slate-500">
        پیش‌نویس پاسخ روی همین مرورگر حفظ می‌شود. برای ثبت نهایی، اتصال به سرور
        لازم است.
      </p>
    </>
  );
}
