import { loginIdentifierSchema } from "../lib/phone";
import { roleSchema } from "../lib/access";
import type { FastifyRequest } from "fastify";
import type { Db } from "mongodb";
import {
  randomUUID,
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { collection, type Row } from "./db";
import { writes, type WriteHooks } from "./transactions";
const id = () => randomUUID(),
  now = () => new Date().toISOString(),
  hash = (s: string) => createHash("sha256").update(s).digest("hex");
const credentials = z.object({
  email: loginIdentifierSchema,
  password: z.string().min(10).max(128),
});
const fail = (status: number, message: string) => {
  throw Object.assign(new Error(message), { statusCode: status });
};

export function createContext(db: Db, hooks: WriteHooks = {}) {
  const c = (n: string) => collection(db, n);
  async function user(r: FastifyRequest, role?: string) {
    const token = r.cookies.session;
    if (!token) fail(401, "ابتدا وارد شوید");
    const session = await c("sessions").findOne({
      tokenHash: hash(token!),
      expiresAt: { $gt: new Date() },
    });
    if (!session) fail(401, "نشست منقضی شده است");
    const u = await c("users").findOne({ _id: session!.userId });
    if (!u || u.disabledAt) fail(401, "حساب فعال یافت نشد");
    if (!roleSchema.safeParse(u!.role).success)
      fail(403, "نقش حساب معتبر نیست");
    if (role && u!.role !== role) fail(403, "دسترسی مجاز نیست");
    return u!;
  }
  const safe = (u: Row) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified === true,
    phoneVerified: u.phoneVerified === true,
    phone: u.phone,
    role: u.role,
  });
  async function audit(actorId: string, action: string, resourceId: string) {
    await c("auditLogs").insertOne({
      _id: id(),
      actorId,
      action,
      resourceId,
      createdAt: now(),
    });
  }
  async function owned(name: string, key: string, ownerId: string) {
    const row = await c(name).findOne({ _id: key, ownerId });
    if (!row || (name === "curriculum" && row.archivedAt))
      fail(404, "یافت نشد");
    return row!;
  }
  async function assignment(r: FastifyRequest, studentOnly = false) {
    const u = await user(r);
    const { aid } = r.params as { aid: string };
    if (u!.role === "parent") {
      if (studentOnly) fail(403, "دسترسی اولیا فقط برای مشاهده گزارش است");
      const row = await c("assignments").findOne({ _id: aid });
      if (
        !row ||
        !(await c("parentLinks").findOne({
          parentId: u!._id,
          studentId: row.studentId,
          teacherId: row.teacherId,
        }))
      )
        fail(404, "مأموریت یافت نشد");
      return { u: u!, a: row! };
    }
    const a = await c("assignments").findOne({
      _id: aid,
      ...(u.role === "student"
        ? { studentId: u._id }
        : studentOnly
          ? { studentId: u._id }
          : { teacherId: u._id }),
    });
    if (!a) fail(404, "مأموریت یافت نشد");
    return { u, a: a! };
  }
  return {
    ...writes(db, hooks),
    c,
    user,
    safe,
    audit,
    owned,
    assignment,
    id,
    now,
    hash,
    fail,
    credentials,
    randomBytes,
    scryptSync,
    timingSafeEqual,
  };
}
export type Context = ReturnType<typeof createContext>;
