import { visualKind } from "../../lib/question-visuals";
import type { AvalaiClient } from "../ai/avalai";
import type { FastifyInstance } from "fastify";
import type { ClientSession } from "mongodb";
import { z } from "zod";
import type { Context } from "../context";
import { questionSchema, type QuestionInput } from "../domain";
import type { QuestionGenerator } from "../ai/question-generator";
export async function validateQuestion(
  ctx: Context,
  ownerId: string,
  b: QuestionInput,
) {
  if (b.topicId) {
    const topic = await ctx.owned("curriculum", b.topicId, ownerId);
    if (topic.kind !== "topic") ctx.fail(400, "مبحث را انتخاب کنید");
  }
  for (const visual of b.visuals ?? [])
    if (visual.kind === "image")
      await ctx.owned("questionAssets", visual.assetId, ownerId);
  for (const sid of b.skillIds) {
    const s = await ctx.owned("curriculum", sid, ownerId);
    if (s.kind !== "skill") ctx.fail(400, "مهارت معتبر نیست");
  }
}
export async function persistQuestion(
  ctx: Context,
  ownerId: string,
  b: QuestionInput,
  session: ClientSession,
  provenance: object = { origin: "human" },
) {
  const qid = ctx.id(),
    vid = ctx.id();
  await ctx
    .c("questions")
    .insertOne({ _id: qid, ownerId, currentVersionId: vid }, { session });
  const row = {
    _id: vid,
    questionId: qid,
    ownerId,
    version: 1,
    verifiedBy: ownerId,
    verifiedAt: ctx.now(),
    ...b,
    ...provenance,
  };
  await ctx.c("questionVersions").insertOne(row, { session });
  await ctx.boundary("after_question_version_insert");
  return row;
}
export function registerAuthoring(
  app: FastifyInstance,
  ctx: Context,
  generator?: QuestionGenerator,
  avalai?: AvalaiClient,
) {
  app.get("/api/question-drafts", async (r) => {
    const u = await ctx.user(r, "teacher");
    return ctx
      .c("questionDrafts")
      .find({ ownerId: u._id, state: "pending_review" })
      .sort({ createdAt: -1 })
      .toArray();
  });
  app.post(
    "/api/question-drafts/generate",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (r) => {
      const u = await ctx.user(r, "teacher");
      const b = z
        .object({
          topicId: z.string().uuid(),
          skillIds: z.array(z.string().uuid()).max(10).default([]),
          brief: z.string().trim().min(5).max(1000),
          visualKind: visualKind.optional(),
          type: z.enum(["numeric", "choice", "short", "essay"]),
        })
        .parse(r.body);
      const key = r.headers["idempotency-key"];
      if (
        key !== undefined &&
        (typeof key !== "string" || !/^[-\w:]{8,128}$/.test(key))
      )
        ctx.fail(400, "کلید درخواست معتبر نیست");
      if (typeof key === "string") {
        const cached = await ctx.c("operations").findOne({
          _id: ctx.hash(JSON.stringify([u._id, "question-generation", key])),
        });
        if (cached) {
          if (cached.requestHash !== ctx.hash(JSON.stringify(b)))
            ctx.fail(409, "این کلید برای درخواست دیگری استفاده شده است");
          return cached.response;
        }
      }
      const savedSettings = await ctx.c("aiSettings").findOne({ _id: u._id });
      const useAvalai =
        savedSettings?.provider === "avalai" || (!generator && avalai);
      const selectedModel =
        savedSettings?.model ?? process.env.AVALAI_AUTHOR_MODEL;
      const selectedGenerator = useAvalai
        ? selectedModel && avalai?.configured
          ? avalai.generator(selectedModel)
          : undefined
        : generator;
      if (!selectedGenerator)
        ctx.fail(
          503,
          "تولید سؤال آماده نیست؛ مدل را در تنظیمات انتخاب کنید و اتصال AvvalAI را پیکربندی کنید.",
        );
      await validateQuestion(ctx, u._id, {
        ...b,
        statement: "draft",
        reference: "0",
        options: [],
        hints: [],
        tolerance: 0,
      });
      const topic = await ctx.owned("curriculum", b.topicId, u._id),
        curriculum: string[] = [];
      let node = topic;
      for (let i = 0; i < 12 && node.parentId; i++) {
        node = await ctx.owned("curriculum", node.parentId, u._id);
        curriculum.unshift(node.title);
      }
      const requestId = ctx.id();
      await ctx.c("aiRequests").insertOne({
        _id: requestId,
        ownerId: u._id,
        purpose: "question_authoring",
        configuredProvider: selectedGenerator!.provider ?? "configured",
        ...(useAvalai ? { configuredModel: selectedModel } : {}),
        state: "pending",
        createdAt: ctx.now(),
      });
      try {
        const output = await selectedGenerator!.generate({
          topic: topic.title,
          curriculum,
          brief: b.brief,
          type: b.type,
          ...(b.visualKind ? { visualKind: b.visualKind } : {}),
        });
        await ctx.c("aiRequests").updateOne(
          { _id: requestId },
          {
            $set: {
              state: "generated",
              provider: output.provider,
              model: output.model,
              promptVersion: output.promptVersion,
              ...(output.usage ? { usage: output.usage } : {}),
            },
          },
        );
        // Drafts are untrusted authoring material. Keep a structurally bounded draft
        // with explicit correction flags; only approval may pass the full grading schema.
        const candidate = {
          ...output.question,
          ...(b.visualKind && b.visualKind !== "none"
            ? { visualKind: b.visualKind }
            : {}),
          topicId: b.topicId,
          skillIds: b.skillIds,
          type: b.type,
          tolerance: 0,
        };
        const checked = questionSchema.safeParse(candidate);
        const question = checked.success ? checked.data : candidate;
        const validationIssues = checked.success
          ? []
          : checked.error.issues.map((issue) => issue.message);
        return ctx.atomic(
          r,
          u._id,
          "question-generation",
          b,
          async (session) => {
            const row = {
              _id: ctx.id(),
              ownerId: u._id,
              state: "pending_review",
              question,
              validationIssues,
              provider: output.provider,
              model: output.model,
              promptVersion: output.promptVersion,
              requestId,
              createdAt: ctx.now(),
            };
            await ctx.c("questionDrafts").insertOne(row, { session });
            await ctx.c("aiRequests").updateOne(
              { _id: requestId },
              {
                $set: {
                  state: "committed",
                  provider: output.provider,
                  model: output.model,
                  promptVersion: output.promptVersion,
                  ...(output.usage ? { usage: output.usage } : {}),
                },
              },
              { session },
            );
            return row;
          },
        );
      } catch (error) {
        await ctx
          .c("aiRequests")
          .updateOne(
            { _id: requestId },
            { $set: { state: "unavailable", finishedAt: ctx.now() } },
          );
        if (error instanceof z.ZodError)
          ctx.fail(502, "خروجی مدل معتبر نبود؛ هیچ سؤالی به بانک افزوده نشد.");
        throw Object.assign(
          new Error("تولید سؤال انجام نشد؛ دوباره تلاش کنید."),
          { statusCode: 503 },
        );
      }
    },
  );
  app.post("/api/question-drafts/:did/approve", async (r) => {
    const u = await ctx.user(r, "teacher"),
      { did } = r.params as { did: string };
    const b = z
      .object({ question: questionSchema, confirmed: z.literal(true) })
      .parse(r.body);
    await validateQuestion(ctx, u._id, b.question);
    return ctx.atomic(
      r,
      u._id,
      `approve-question:${did}`,
      b,
      async (session) => {
        const draft = await ctx
          .c("questionDrafts")
          .findOne({ _id: did, ownerId: u._id }, { session });
        if (!draft) ctx.fail(404, "پیش‌نویس یافت نشد");
        if (draft!.state !== "pending_review")
          ctx.fail(409, "این پیش‌نویس قبلاً تعیین تکلیف شده است");
        const requiredKind = draft!.question.visualKind;
        if (
          requiredKind &&
          requiredKind !== "none" &&
          !b.question.visuals?.some((v) => v.kind === requiredKind)
        )
          ctx.fail(
            400,
            "محتوای تصویری درخواست‌شده باید پیش از تأیید اضافه شود",
          );
        const approvedQuestion = questionSchema.parse({
          ...b.question,
          ...(requiredKind ? { visualKind: requiredKind } : {}),
        });
        const row = await persistQuestion(
          ctx,
          u._id,
          approvedQuestion,
          session,
          {
            origin: "ai_reviewed",
            sourceDraftId: did,
            provider: draft!.provider,
            model: draft!.model,
            promptVersion: draft!.promptVersion,
          },
        );
        await ctx.c("questionDrafts").updateOne(
          { _id: did },
          {
            $set: {
              state: "approved",
              questionVersionId: row._id,
              reviewedBy: u._id,
              reviewedAt: ctx.now(),
            },
          },
          { session },
        );
        await ctx.c("auditLogs").insertOne(
          {
            _id: ctx.id(),
            actorId: u._id,
            action: "approve_ai_question",
            resourceId: did,
            createdAt: ctx.now(),
          },
          { session },
        );
        return row;
      },
    );
  });
  app.post("/api/question-drafts/:did/reject", async (r) => {
    const u = await ctx.user(r, "teacher"),
      { did } = r.params as { did: string },
      b = z
        .object({ reason: z.string().trim().min(3).max(1000) })
        .parse(r.body);
    return ctx.atomic(
      r,
      u._id,
      `reject-question:${did}`,
      b,
      async (session) => {
        const draft = await ctx
          .c("questionDrafts")
          .findOne({ _id: did, ownerId: u._id }, { session });
        if (!draft) ctx.fail(404, "یافت نشد");
        if (draft!.state === "approved")
          ctx.fail(409, "سؤال قبلاً تأیید شده است");
        await ctx.c("questionDrafts").updateOne(
          { _id: did },
          {
            $set: {
              state: "rejected",
              reason: b.reason,
              reviewedBy: u._id,
              reviewedAt: ctx.now(),
            },
          },
          { session },
        );
        return { ok: true };
      },
    );
  });
}
