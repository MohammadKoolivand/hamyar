import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Context } from "../context";
import { discoverySettingsId, discoveryOption } from "../discovery-settings";
import {
  discoveryKeys,
  type DiscoverySettings,
} from "../../lib/discovery-settings";

const text = z.string().trim().min(1).max(200);
const parents = z
  .object({
    level: text.optional(),
    grade: text.optional(),
    book: text.optional(),
    chapter: text.optional(),
    topic: text.optional(),
  })
  .strict();
const input = z
  .object({
    revision: z.number().int().min(0),
    key: z.enum(discoveryKeys),
    action: z.enum(["label", "save", "archive"]),
    label: text.optional(),
    option: z
      .object({
        id: z.string().max(40).optional(),
        value: text,
        label: text,
        parents: parents.default({}),
        active: z.boolean().default(true),
        order: z.number().int().min(0).max(100000).default(0),
      })
      .strict()
      .optional(),
    id: z.string().max(40).optional(),
  })
  .strict();

export function registerDiscoverySettings(app: FastifyInstance, ctx: Context) {
  async function read() {
    const row = await ctx
      .c("siteSettings")
      .findOne({ _id: discoverySettingsId });
    if (!row) ctx.fail(503, "تنظیمات فیلترها آماده نیست");
    return row! as unknown as DiscoverySettings;
  }
  app.get("/api/discovery-filters", async () => {
    const settings = await read();
    return {
      revision: settings.revision,
      fields: settings.fields.map((field) => ({
        ...field,
        options: field.options.filter((option) => option.active),
      })),
    };
  });
  app.get("/api/admin/discovery-filters", async (r) => {
    await ctx.user(r, "super_admin");
    return read();
  });
  app.post("/api/admin/discovery-filters", async (r) => {
    const actor = await ctx.user(r, "super_admin"),
      body = input.parse(r.body);
    return ctx.transaction(async (session) => {
      const row = await ctx
        .c("siteSettings")
        .findOne({ _id: discoverySettingsId }, { session });
      if (!row || row.revision !== body.revision)
        ctx.fail(409, "تنظیمات تغییر کرده است؛ دوباره دریافت کنید");
      const settings = row! as unknown as DiscoverySettings;
      const fields = structuredClone(settings.fields),
        field = fields.find((field) => field.key === body.key)!;
      if (body.action === "label") {
        if (!body.label) ctx.fail(400, "عنوان فیلتر را وارد کنید");
        field.label = body.label!;
      } else if (body.action === "archive") {
        const option = field.options.find((option) => option.id === body.id);
        if (!option) ctx.fail(404, "گزینه یافت نشد");
        option!.active = false;
      } else {
        if (!body.option) ctx.fail(400, "گزینه را مشخص کنید");
        const value = body.option!;
        if (value.id) {
          const option = field.options.find((option) => option.id === value.id);
          if (!option) ctx.fail(404, "گزینه یافت نشد");
          if (option!.value !== value.value)
            ctx.fail(
              400,
              "مقدار اصلی قابل تغییر نیست؛ عنوان نمایشی را ویرایش کنید",
            );
          Object.assign(option!, {
            label: value.label,
            active: value.active,
            order: value.order,
          });
        } else {
          if (field.options.length >= 10000)
            ctx.fail(400, "تعداد گزینه‌ها بیش از حد مجاز است");
          const option = {
            ...discoveryOption(
              body.key,
              value.value,
              value.parents,
              value.order,
            ),
            label: value.label,
            active: value.active,
          };
          if (field.options.some((existing) => existing.id === option.id))
            ctx.fail(
              409,
              "این گزینه قبلاً ثبت شده است؛ همان گزینه را ویرایش کنید",
            );
          field.options.push(option);
        }
      }
      const result = await ctx
        .c("siteSettings")
        .updateOne(
          { _id: discoverySettingsId, revision: body.revision },
          {
            $set: { fields, updatedAt: ctx.now(), updatedBy: actor._id },
            $inc: { revision: 1 },
          },
          { session },
        );
      if (!result.matchedCount) ctx.fail(409, "تنظیمات هم‌زمان تغییر کرده است");
      await ctx
        .c("auditLogs")
        .insertOne(
          {
            _id: ctx.id(),
            actorId: actor._id,
            action: `discovery_filter_${body.action}`,
            resourceId: body.key,
            createdAt: ctx.now(),
          },
          { session },
        );
      return { revision: body.revision + 1, fields };
    });
  });
}
