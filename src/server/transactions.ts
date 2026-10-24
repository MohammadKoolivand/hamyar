import type { ClientSession, Db } from "mongodb";
import type { FastifyRequest } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { collection } from "./db";
export interface WriteHooks {
  boundary?: (name: string) => Promise<void>;
}
export async function requireTransactions(db: Db) {
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "MongoDB replica set required; see README transaction setup",
    );
}
export async function transaction<T>(
  db: Db,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  return db.client.withSession((session) =>
    session.withTransaction(() => work(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    }),
  );
}
function fail(message: string): never {
  throw Object.assign(new Error(message), { statusCode: 409 });
}
export function writes(db: Db, hooks: WriteHooks = {}) {
  const boundary = async (name: string) => {
    await hooks.boundary?.(name);
  };
  async function atomic<T>(
    r: FastifyRequest,
    actorId: string,
    scope: string,
    body: unknown,
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const supplied = r.headers["idempotency-key"];
    if (
      supplied !== undefined &&
      (typeof supplied !== "string" || !/^[-\w:]{8,128}$/.test(supplied))
    )
      throw Object.assign(new Error("کلید تکرار درخواست معتبر نیست"), {
        statusCode: 400,
      });
    const key = supplied ?? randomUUID(),
      digest = (s: string) => createHash("sha256").update(s).digest("hex");
    const operationId = digest(JSON.stringify([actorId, scope, key])),
      requestHash = digest(JSON.stringify(body));
    const result = await transaction(db, async (session) => {
      const previous = await collection(db, "operations").findOne(
        { _id: operationId },
        { session },
      );
      if (previous) {
        if (previous.requestHash !== requestHash)
          fail("این کلید قبلاً برای درخواست دیگری استفاده شده");
        return previous.response as T;
      }
      const response = await work(session);
      await boundary("before_operation_record");
      await collection(db, "operations").insertOne(
        {
          _id: operationId,
          actorId,
          scope,
          requestHash,
          response,
          createdAt: new Date().toISOString(),
        },
        { session },
      );
      return response;
    });
    await boundary("after_commit"); // Tests can simulate losing the HTTP response after a durable commit.
    return result;
  }
  return {
    atomic,
    transaction: <T>(work: (session: ClientSession) => Promise<T>) =>
      transaction(db, work),
    boundary,
  };
}
