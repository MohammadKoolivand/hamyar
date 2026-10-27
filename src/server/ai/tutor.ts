import { assessHint, HINT_SAFETY_VERSION } from "./hint-safety";
import { z } from "zod";
import type { Context } from "../context";
import type { Row } from "../db";
import type { HintProvider, HintOutput } from "./types";
const output = z
  .object({
    text: z.string().min(1).max(2000),
    provider: z.string().max(80),
    model: z.string().max(120),
    promptVersion: z.string().max(80),
    focus: z.enum(["start", "concept", "review"]),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .strict();
export async function guide(
  ctx: Context,
  provider: HintProvider,
  a: Row,
  q: Row,
  level: number,
): Promise<HintOutput & { requestId: string }> {
  const maxLevel = a.policy.maxHintLevel ?? 3;
  if (a.policy.independent || level < 1 || level > maxLevel)
    ctx.fail(409, "این سطح راهنمایی مجاز نیست");
  const previous = await ctx
    .c("hintEvents")
    .find({ assignmentId: a._id, questionVersionId: q._id })
    .sort({ level: 1 })
    .toArray();
  const work = await ctx
    .c("attempts")
    .find({ assignmentId: a._id, questionVersionId: q._id })
    .sort({ sequence: -1 })
    .limit(1)
    .next();
  if (level === 3 && !work) ctx.fail(409, "ابتدا روش حل خود را ثبت کنید");
  const requestId = ctx.id();
  if (level === 4) {
    if (!a.policy.allowFullSolution) ctx.fail(409, "نمایش پاسخ کامل مجاز نیست");
    return {
      text: q.reference,
      provider: "teacher-solution",
      model: "teacher-reference",
      promptVersion: "explicit-solution-v1",
      focus: "review",
      requestId,
    };
  }
  const bank: { level: number; text: string }[] =
    q.hintBank ??
    q.hints.map((text: string, i: number) => ({ level: i + 1, text }));
  let candidates = bank
    .filter((item) => item.level === level)
    .map((item) => item.text)
    .filter(
      (text) =>
        assessHint(
          { reference: q.reference, type: q.type, options: q.options },
          text,
          q.origin === "ai_reviewed" &&
            q.hintSafetyVersion !== HINT_SAFETY_VERSION,
        ) === "clear",
    )
    .filter((text) => !previous.some((h) => h.text === text));
  // Before any submitted attempt, keep the first teacher-approved introductory hint only.
  if (!work) candidates = candidates.slice(0, 1);
  if (!candidates.length)
    ctx.fail(409, "راهنمای تأییدشده دیگری در این سطح وجود ندارد");
  const skills = await ctx
    .c("curriculum")
    .find({
      _id: { $in: q.skillIds ?? [] },
      ownerId: a.teacherId,
      kind: "skill",
    })
    .toArray();
  const subjects: string[] = [];
  let parent = q.topicId;
  for (let i = 0; parent && i < 9; i++) {
    const node = await ctx
      .c("curriculum")
      .findOne({ _id: parent, ownerId: a.teacherId });
    if (!node) break;
    subjects.push(node.title);
    parent = node.parentId;
  }
  await ctx.c("aiRequests").insertOne({
    _id: requestId,
    assignmentId: a._id,
    questionVersionId: q._id,
    configuredProvider: provider.name,
    state: "pending",
    createdAt: ctx.now(),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      provider.hint({
        approvedHint: candidates[0],
        level,
        context: {
          question: q.statement,
          subjects,
          skills: skills.map((s) => s.title),
          submittedWork: work?.answer,
          previousHints: previous.map((h) => h.text),
          allowedLevel: level,
          remainingAllowance: a.policy.maxHints - a.progress[q._id].hints,
          candidates,
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("timeout")),
          Number(process.env.AI_TIMEOUT_MS ?? 30000),
        );
      }),
    ]);
    const result = output.parse(
      typeof raw === "string"
        ? {
            text: raw,
            provider: provider.name,
            model: "approved-hints",
            promptVersion: "approved-hints-v1",
            focus: "concept",
          }
        : raw,
    );
    if (!candidates.includes(result.text))
      throw new Error("Unapproved model output");
    await ctx.c("aiRequests").updateOne(
      { _id: requestId },
      {
        $set: {
          state: "generated",
          provider: result.provider,
          model: result.model,
          promptVersion: result.promptVersion,
          usage: result.usage ?? null,
          finishedAt: ctx.now(),
        },
      },
    );
    return { ...result, requestId };
  } catch {
    await ctx
      .c("aiRequests")
      .updateOne(
        { _id: requestId },
        { $set: { state: "unavailable", finishedAt: ctx.now() } },
      );
    ctx.fail(
      503,
      "همیار در دسترس نیست یا خروجی مجاز نبود؛ پاسخ‌های شما محفوظ‌اند",
    );
    throw new Error("unreachable");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
