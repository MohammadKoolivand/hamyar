import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { persistQuestion, validateQuestion } from "./authoring";
import { questionSchema } from "../domain";
export function registerContent(app: FastifyInstance, ctx: Context) {
  const { c, user, owned, id } = ctx;
  app.get("/api/curriculum", async (r) => {
    const u = await user(r, "teacher");
    return c("curriculum").find({ ownerId: u._id }).toArray();
  });
  app.post("/api/curriculum", async (r) => {
    const u = await user(r, "teacher"),
      b = z
        .object({
          title: z.string().min(1).max(150),
          kind: z.enum([
            "system",
            "level",
            "grade",
            "subject",
            "course",
            "chapter",
            "topic",
            "skill",
            "objective",
          ]),
          parentId: z.string().uuid().optional(),
        })
        .parse(r.body);
    if (b.parentId) await owned("curriculum", b.parentId, u._id);
    const row = { _id: id(), ownerId: u._id, ...b };
    await c("curriculum").insertOne(row);
    return row;
  });
  app.get("/api/questions", async (r) => {
    const u = await user(r, "teacher");
    return c("questionVersions").find({ ownerId: u._id }).toArray();
  });
  app.post("/api/questions", async (r) => {
    const u = await user(r, "teacher"),
      b = questionSchema.parse(r.body);
    await validateQuestion(ctx, u._id, b);
    return ctx.atomic(r, u._id, "create-question", b, (session) =>
      persistQuestion(ctx, u._id, b, session),
    );
  });
}
