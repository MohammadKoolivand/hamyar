import type { FastifyInstance } from "fastify";
import type { Context } from "../context";
import { z } from "zod";
import { persistQuestion, validateQuestion } from "./authoring";
import {
  curriculumCatalog,
  importCatalog,
  trackLabels,
} from "../curriculum-catalog";
import { questionSchema } from "../domain";
export function registerContent(app: FastifyInstance, ctx: Context) {
  const { c, user, owned, id } = ctx;
  app.get("/api/curriculum/catalog", async (r) => {
    await user(r, "teacher");
    return {
      ...curriculumCatalog,
      trackLabels,
      notice:
        "فهرست فصل‌ها و درس‌ها با ۳۱ PDF رسمی سال ۱۴۰۵–۱۴۰۶ بررسی شده است؛ ۱۹ کتاب ریاضی و فیزیک متوسطه دوم هم تطبیق داده شده‌اند. علوم متوسطه اول فعلاً در سطح کل فصل است. کتاب‌های تکمیلی سمپاد جدا هستند. این تأیید مربوط به سرفصل‌هاست، نه بانک سؤال یا خروجی هوش مصنوعی.",
    };
  });
  app.post("/api/curriculum/catalog/import", async (r) => {
    const u = await user(r, "teacher"),
      b = z
        .object({
          bookIds: z
            .array(z.string())
            .min(1)
            .max(curriculumCatalog.books.length),
        })
        .parse(r.body);
    const ids = [...new Set(b.bookIds)];
    if (
      ids.some((id) => !curriculumCatalog.books.some((book) => book.id === id))
    )
      ctx.fail(400, "کتاب معتبر نیست");
    return ctx.atomic(
      r,
      u._id,
      "curriculum-import",
      { bookIds: ids },
      async (session) => {
        const result = await importCatalog(ctx, u._id, ids, session);
        await ctx.boundary("after_catalog_import");
        await ctx.c("auditLogs").insertOne(
          {
            _id: id(),
            actorId: u._id,
            action: "import_curriculum_catalog",
            resourceId: curriculumCatalog.version,
            createdAt: ctx.now(),
          },
          { session },
        );
        return result;
      },
    );
  });
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
