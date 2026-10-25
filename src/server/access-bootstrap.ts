import { z } from "zod";
import type { Context } from "./context";
const inputSchema = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(14).max(128),
  name: z.string().trim().min(2).max(100),
});
export async function bootstrapSuperadmin(ctx: Context, input: unknown) {
  const b = inputSchema.parse(input);
  return ctx.transaction(async (session) => {
    await ctx
      .c("securityLocks")
      .updateOne(
        { _id: "access-management" },
        { $inc: { revision: 1 } },
        { upsert: true, session },
      );
    if (await ctx.c("users").findOne({ role: "super_admin" }, { session }))
      throw new Error(
        "A super administrator already exists; use the authenticated admin panel",
      );
    if (await ctx.c("users").findOne({ email: b.email }, { session }))
      throw new Error(
        "Email already belongs to an existing account; no automatic promotion is allowed",
      );
    const salt = ctx.randomBytes(16).toString("hex"),
      uid = ctx.id();
    await ctx
      .c("users")
      .insertOne(
        {
          _id: uid,
          role: "super_admin",
          name: b.name,
          email: b.email,
          passwordHash:
            salt + ":" + ctx.scryptSync(b.password, salt, 64).toString("hex"),
          createdAt: ctx.now(),
        },
        { session },
      );
    await ctx
      .c("auditLogs")
      .insertOne(
        {
          _id: ctx.id(),
          actorId: uid,
          action: "operator_bootstrap_superadmin",
          resourceId: uid,
          createdAt: ctx.now(),
        },
        { session },
      );
    return uid;
  });
}
