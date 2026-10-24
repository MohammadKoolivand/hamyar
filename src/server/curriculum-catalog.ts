import { createHash } from "node:crypto";
import catalog from "../data/iran-secondary-curriculum.json";
import type { Context } from "./context";
import type { AnyBulkWriteOperation, ClientSession } from "mongodb";
import type { Row } from "./db";
type CatalogTopic = {
  title: string;
  basis: string;
  identityTitle?: string;
  previousTitle?: string;
};
export const curriculumCatalog = catalog;
const grades: Record<number, string> = {
  7: "هفتم",
  8: "هشتم",
  9: "نهم",
  10: "دهم",
  11: "یازدهم",
  12: "دوازدهم",
};
export const trackLabels: Record<string, string> = {
  common: "مشترک متوسطه اول",
  mathematics: "ریاضی و فیزیک",
  experimental: "علوم تجربی",
  humanities: "علوم انسانی",
  islamic: "علوم و معارف اسلامی",
};
// UUIDv5: stable teacher-scoped catalog identities preserve references and make concurrent import safe.
export function catalogId(ownerId: string, key: string) {
  const digest = createHash("sha1")
    .update(Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex"))
    .update(ownerId + ":hamyar-curriculum:" + key)
    .digest();
  digest[6] = (digest[6] & 15) | 80;
  digest[8] = (digest[8] & 63) | 128;
  const h = digest.subarray(0, 16).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function catalogNodes(ownerId: string, bookIds: string[]) {
  const rows = new Map<string, Record<string, unknown> & { _id: string }>();
  function add(
    key: string,
    title: string,
    kind: string,
    parentKey?: string,
    extra: object = {},
  ) {
    const row = {
      _id: catalogId(ownerId, key),
      ownerId,
      catalogKey: key,
      catalogVersion: catalog.version,
      title,
      kind,
      ...(parentKey ? { parentId: catalogId(ownerId, parentKey) } : {}),
      ...extra,
    };
    rows.set(key, row);
    return key;
  }
  const root = add("iran", "نظام آموزشی ایران", "system");
  for (const book of catalog.books.filter((b) => bookIds.includes(b.id))) {
    const level = add(
      book.grade < 10 ? "lower" : "upper",
      book.grade < 10 ? "متوسطه اول" : "متوسطه دوم",
      "level",
      root,
    );
    const grade = add(
      "grade:" + book.grade,
      "پایه " + grades[book.grade],
      "grade",
      level,
    );
    const bookKey = add(
      "book:" + book.id,
      `${book.title} — ${book.tracks.map((t) => trackLabels[t]).join(" / ")}`,
      "course",
      grade,
      {
        catalogBookId: book.id,
        subject: book.subject,
        tracks: book.tracks,
        program: book.program,
        source: book.source,
      },
    );
    for (const chapter of book.chapters) {
      const key = add(
        `book:${book.id}/chapter:${chapter.order}`,
        `فصل ${chapter.order.toLocaleString("fa-IR")}: ${chapter.title}`,
        "chapter",
        bookKey,
        { catalogBookId: book.id, order: chapter.order },
      );
      chapter.topics.forEach((topic: CatalogTopic, index) =>
        add(
          `${key}/topic:${topic.identityTitle ?? topic.title}`,
          topic.title,
          "topic",
          key,
          {
            catalogBookId: book.id,
            order: index + 1,
            sourceBasis: topic.basis,
            ...(topic.previousTitle
              ? { previousCatalogTitle: topic.previousTitle }
              : {}),
          },
        ),
      );
    }
  }
  return [...rows.values()];
}
export async function importCatalog(
  ctx: Context,
  ownerId: string,
  bookIds: string[],
  session: ClientSession,
) {
  const rows = catalogNodes(ownerId, bookIds);
  if (!rows.length) return { created: 0, preserved: 0 };
  const result = await ctx.c("curriculum").bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { _id: row._id, ownerId },
        update: { $setOnInsert: row },
        upsert: true,
      },
    })),
    { session, ordered: true },
  );
  // Refresh catalog-owned provenance. Never replace teacher-authored titles/content.
  const refresh = rows.flatMap<AnyBulkWriteOperation<Row>>((row) => {
    if (row.kind === "course")
      return [
        {
          updateOne: {
            filter: { _id: row._id, ownerId },
            update: {
              $set: {
                source: row.source,
                program: row.program,
                catalogVersion: catalog.version,
              },
            },
          },
        },
      ];
    if (row.previousCatalogTitle)
      return [
        {
          updateOne: {
            filter: { _id: row._id, ownerId, title: row.previousCatalogTitle },
            update: {
              $set: {
                title: row.title,
                sourceBasis: row.sourceBasis,
                catalogVersion: catalog.version,
              },
            },
          },
        },
      ];
    return [];
  });
  const refreshed = refresh.length
    ? await ctx.c("curriculum").bulkWrite(refresh, { session, ordered: true })
    : null;
  return {
    updated: refreshed?.modifiedCount ?? 0,
    created: result.upsertedCount,
    preserved: rows.length - result.upsertedCount,
    books: bookIds.length,
  };
}
