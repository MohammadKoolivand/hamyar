import type { FastifyInstance } from "fastify";
import type { Document, Filter } from "mongodb";
import { z } from "zod";
import { roleSchema } from "../../lib/access";
import type {
  AdminCollectionStat,
  AdminCount,
  AdminRoleCount,
  AdminSystemOverview,
  AdminUserPage,
  AdminUserRow,
} from "../../lib/admin-overview";
import type { Context } from "../context";
import type { Row } from "../db";

function metric(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function escapedSearch(value: string) {
  // Treat admin search as literal text, never as a user-provided regex/operator.
  return value.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
}

type QuestionGroup = {
  _id: { type: string | null; visibility: string | null; verified: boolean };
  count: number;
};

async function currentQuestionGroups(ctx: Context): Promise<QuestionGroup[]> {
  // Count logical questions, not historical questionVersions. Older revisions
  // must not inflate the number of questions in the bank.
  return ctx.c("questions")
    .aggregate<QuestionGroup>([
      {
        $lookup: {
          from: "questionVersions",
          localField: "currentVersionId",
          foreignField: "_id",
          as: "current",
        },
      },
      { $unwind: { path: "$current", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            type: { $ifNull: ["$current.type", "unknown"] },
            visibility: { $ifNull: ["$current.visibility", "private"] },
            verified: { $ne: [{ $type: "$current.verifiedAt" }, "missing"] },
          },
          count: { $sum: 1 },
        },
      },
    ], { maxTimeMS: 12000 })
    .toArray();
}

function collectionSizes(stats: Document | null) {
  return {
    dataBytes: metric(stats?.size),
    storageBytes: metric(stats?.storageSize),
    indexBytes: metric(stats?.totalIndexSize),
  };
}

async function listCollectionStats(ctx: Context): Promise<AdminCollectionStat[]> {
  const names = (
    await ctx.db.listCollections({}, { nameOnly: true }).toArray()
  ).map((item) => item.name).sort((a, b) => a.localeCompare(b));
  const result: AdminCollectionStat[] = [];
  // Bound database command concurrency to keep the administrative page
  // from overwhelming MongoDB, even with many collections.
  for (let i = 0; i < names.length; i += 4) {
    const batch = await Promise.all(names.slice(i, i + 4).map(async (name) => {
      let stats: Document | null = null;
      try {
        stats = await ctx.db.command({ collStats: name, scale: 1, maxTimeMS: 3500 });
      } catch {
        // A read-only application role may lack collStats privilege.
        // Keep the collection listed but mark its storage fields unavailable.
      }
      let documents = metric(stats?.count);
      if (documents === null) {
        try {
          documents = metric(
            await ctx.db.collection(name).estimatedDocumentCount({ maxTimeMS: 3500 }),
          );
        } catch {
          // Never fabricate an unavailable count.
        }
      }
      return { name, documents, ...collectionSizes(stats) };
    }));
    result.push(...batch);
  }
  return result;
}

function sumIfComplete(rows: AdminCollectionStat[], key: "dataBytes" | "storageBytes" | "indexBytes") {
  return rows.every((row) => row[key] !== null)
    ? rows.reduce((total, row) => total + (row[key] ?? 0), 0)
    : null;
}

export function registerAdminOverview(app: FastifyInstance, ctx: Context) {
  app.get("/api/admin/system-overview", async (r, reply) => {
    await ctx.user(r, "super_admin");
    reply.header("Cache-Control", "private, no-store");
    const [roleGroups, questionGroups, questionVersions, courses, assignments] =
      await Promise.all([
        ctx.c("users").aggregate<{ _id: string; count: number; active: number }>([
          { $group: {
            _id: "$role",
            count: { $sum: 1 },
            active: { $sum: { $cond: [{ $ifNull: ["$disabledAt", false] }, 0, 1] } },
          } },
        ]).toArray(),
        currentQuestionGroups(ctx),
        ctx.c("questionVersions").estimatedDocumentCount(),
        ctx.c("courses").estimatedDocumentCount(),
        ctx.c("assignments").estimatedDocumentCount(),
      ]);
    const roles: AdminRoleCount[] = roleGroups.map((row) => ({
      role: typeof row._id === "string" ? row._id : "unknown",
      count: row.count,
      active: row.active,
    }));
    const typeTotals = new Map<string, number>();
    const visibilityTotals = new Map<string, number>();
    let verifiedPublicQuestions = 0;
    for (const row of questionGroups) {
      const count = row.count;
      const type = row._id.type || "unknown";
      const visibility = row._id.visibility === "public"
        ? row._id.verified ? "verified_public" : "unverified_public"
        : row._id.visibility === "private" ? "private" : "unknown";
      typeTotals.set(type, (typeTotals.get(type) ?? 0) + count);
      visibilityTotals.set(visibility, (visibilityTotals.get(visibility) ?? 0) + count);
      if (visibility === "verified_public") verifiedPublicQuestions += count;
    }
    const toCounts = (map: Map<string, number>): AdminCount[] =>
      [...map].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

    const collections = await listCollectionStats(ctx);
    let stats: Document | null = null;
    try {
      stats = await ctx.db.command({ dbStats: 1, scale: 1, maxTimeMS: 5000 });
    } catch {
      // Preserve useful counts even without dbStats privilege.
    }
    const dataBytes = metric(stats?.dataSize) ?? sumIfComplete(collections, "dataBytes");
    const storageBytes = metric(stats?.storageSize) ?? sumIfComplete(collections, "storageBytes");
    const indexBytes = metric(stats?.indexSize) ?? sumIfComplete(collections, "indexBytes");
    const database: AdminSystemOverview["database"] = {
      name: ctx.db.databaseName,
      available: dataBytes !== null || storageBytes !== null || indexBytes !== null,
      collections: collections.length,
      documents: metric(stats?.objects) ?? (collections.every((row) => row.documents !== null)
        ? collections.reduce((total, row) => total + (row.documents ?? 0), 0)
        : null),
      dataBytes,
      storageBytes,
      indexBytes,
    };
    const roleCount = (role: string) => roles.find((item) => item.role === role)?.count ?? 0;
    const result: AdminSystemOverview = {
      generatedAt: new Date().toISOString(),
      database,
      totals: {
        users: roles.reduce((sum, item) => sum + item.count, 0),
        activeUsers: roles.reduce((sum, item) => sum + item.active, 0),
        teachers: roleCount("teacher"),
        students: roleCount("student"),
        parents: roleCount("parent"),
        questions: questionGroups.reduce((sum, item) => sum + item.count, 0),
        questionVersions,
        verifiedPublicQuestions,
        courses,
        assignments,
      },
      roles: roles.sort((a, b) => b.count - a.count),
      questionTypes: toCounts(typeTotals),
      questionVisibility: toCounts(visibilityTotals),
      collections,
    };
    return result;
  });

  app.get("/api/admin/system-overview/users", async (r, reply): Promise<AdminUserPage> => {
    await ctx.user(r, "super_admin");
    reply.header("Cache-Control", "private, no-store");
    const input = z.object({
      role: roleSchema.optional(),
      q: z.string().trim().max(60).default(""),
      page: z.coerce.number().int().min(1).max(100000).default(1),
    }).strict().parse(r.query);
    const filter: Filter<Row> = {};
    if (input.role) filter.role = input.role;
    if (input.q) {
      const pattern = new RegExp(escapedSearch(input.q), "i");
      filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
    }
    const pageSize = 20;
    const total = await ctx.c("users").countDocuments(filter, { maxTimeMS: 6000 });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(input.page, totalPages);
    const rows = await ctx.c("users")
      .find(filter)
      .project({ _id: 1, name: 1, role: 1, email: 1, phone: 1, createdAt: 1, disabledAt: 1 })
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .maxTimeMS(6000)
      .toArray();
    const items: AdminUserRow[] = rows.map((row) => ({
      _id: row._id,
      name: typeof row.name === "string" ? row.name : "بدون نام",
      role: typeof row.role === "string" ? row.role : "unknown",
      ...(typeof row.email === "string" ? { email: row.email } : {}),
      ...(typeof row.phone === "string" ? { phone: row.phone } : {}),
      ...(typeof row.createdAt === "string" ? { createdAt: row.createdAt } : {}),
      ...(typeof row.disabledAt === "string" ? { disabledAt: row.disabledAt } : {}),
    }));
    return { items, page, pageSize, total, totalPages };
  });
}
