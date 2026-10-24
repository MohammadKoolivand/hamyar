import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { questionSchema } from "../domain";
export function registerContent(app: FastifyInstance, ctx: Context) {
  const { c, user, owned, id, fail } = ctx;
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
    const topic = await owned("curriculum", b.topicId, u._id);
    if (topic.kind !== "topic") fail(400, "مبحث را انتخاب کنید");
    for (const sid of b.skillIds) {
      const skill = await owned("curriculum", sid, u._id);
      if (skill.kind !== "skill") fail(400, "شناسه مهارت معتبر نیست");
    }
    const qid = id(),
      vid = id();
    await c("questions").insertOne({
      _id: qid,
      ownerId: u._id,
      currentVersionId: vid,
    });
    const q = {
      _id: vid,
      questionId: qid,
      ownerId: u._id,
      version: 1,
      verifiedBy: u._id,
      ...b,
    };
    await c("questionVersions").insertOne(q);
    return q;
  });
}
