import { createHash } from "node:crypto";
import type { Db, ClientSession } from "mongodb";
import { curriculumCatalog, trackLabels } from "./curriculum-catalog";
import { sourceCategories } from "../lib/question-source";
import { taxonomyKeys, type BankTaxonomy } from "../lib/public-bank";
import {
  discoveryKeys,
  type DiscoverySettings,
  type DiscoveryOption,
} from "../lib/discovery-settings";

export const discoverySettingsId = "public-bank-filters";
const settingsCollection = (db: Db) =>
  db.collection<DiscoverySettings & { _id: string }>("siteSettings");
export function discoveryOption(
  key: string,
  value: string,
  parents: Partial<BankTaxonomy> = {},
  order = 0,
): DiscoveryOption {
  const id = createHash("sha256")
    .update(JSON.stringify([key, value, parents]))
    .digest("hex")
    .slice(0, 24);
  return { id, value, label: value, parents, active: true, order };
}
export function defaultDiscoverySettings(): DiscoverySettings {
  const labels = [
    "مقطع",
    "پایه",
    "درس",
    "فصل",
    "مبحث",
    "نوع سؤال / آزمون",
    "درجهٔ سختی",
  ];
  const fields = discoveryKeys.map((key, i) => ({
    key,
    label: labels[i],
    options: [] as DiscoveryOption[],
  }));
  const seen = new Set<string>();
  const add = (
    key: string,
    value: string,
    parents: Partial<BankTaxonomy> = {},
  ) => {
    const field = fields.find((field) => field.key === key)!;
    const option = discoveryOption(key, value, parents, field.options.length);
    if (!seen.has(option.id)) {
      seen.add(option.id);
      field.options.push(option);
    }
  };
  const grades: Record<number, string> = {
    7: "هفتم",
    8: "هشتم",
    9: "نهم",
    10: "دهم",
    11: "یازدهم",
    12: "دوازدهم",
  };
  for (const book of curriculumCatalog.books) {
    const level = book.grade < 10 ? "متوسطه اول" : "متوسطه دوم",
      grade = `پایه ${grades[book.grade]}`;
    const title = `${book.title} — ${book.tracks.map((track) => trackLabels[track]).join(" / ")}`;
    add("level", level);
    add("grade", grade, { level });
    add("book", title, { level, grade });
    for (const chapter of book.chapters) {
      add("chapter", chapter.title, { level, grade, book: title });
      for (const topic of chapter.topics)
        add("topic", topic.title, {
          level,
          grade,
          book: title,
          chapter: chapter.title,
        });
    }
  }
  for (const category of sourceCategories) {
    add("category", category.id);
    fields.find((field) => field.key === "category")!.options.at(-1)!.label =
      category.label;
  }
  for (const [value, label] of [
    ["easy", "ساده"],
    ["medium", "متوسط"],
    ["hard", "سخت"],
    ["unset", "تعیین نشده"],
  ]) {
    add("difficulty", value);
    fields.find((field) => field.key === "difficulty")!.options.at(-1)!.label =
      label;
  }
  return { revision: 0, fields };
}
export async function addDiscoveryPath(
  db: Db,
  ownerId: string,
  topicId: string,
  session?: ClientSession,
) {
  const nodes = await db
    .collection("curriculum")
    .find(
      { ownerId, archivedAt: { $exists: false } },
      { session, projection: { _id: 1, parentId: 1, kind: 1, title: 1 } },
    )
    .toArray();
  const byId = new Map(nodes.map((node) => [String(node._id), node]));
  const path: Partial<BankTaxonomy> = {},
    seen = new Set<string>();
  let node = byId.get(topicId);
  while (node && !seen.has(String(node._id))) {
    seen.add(String(node._id));
    const key =
      node.kind === "course" || node.kind === "subject" ? "book" : node.kind;
    if (taxonomyKeys.includes(key) && !path[key as keyof BankTaxonomy])
      path[key as keyof BankTaxonomy] = node.title;
    node = byId.get(String(node.parentId));
  }
  const parents: Partial<BankTaxonomy> = {};
  for (const key of taxonomyKeys) {
    const value = path[key];
    if (!value) continue;
    const option = discoveryOption(key, value, { ...parents }, 10000);
    await settingsCollection(db).updateOne(
      {
        _id: discoverySettingsId,
        fields: {
          $elemMatch: {
            key,
            options: { $not: { $elemMatch: { id: option.id } } },
          },
        },
      },
      { $push: { "fields.$.options": option }, $inc: { revision: 1 } },
      { session },
    );
    parents[key] = value;
  }
}
export async function initializeDiscoverySettings(db: Db) {
  await settingsCollection(db).updateOne(
    { _id: discoverySettingsId },
    { $setOnInsert: defaultDiscoverySettings() },
    { upsert: true },
  );
  const published = await db
    .collection("questions")
    .aggregate([
      {
        $lookup: {
          from: "questionVersions",
          localField: "currentVersionId",
          foreignField: "_id",
          as: "version",
        },
      },
      { $unwind: "$version" },
      {
        $match: {
          "version.visibility": "public",
          "version.verifiedAt": { $exists: true },
          "version.topicId": { $type: "string" },
        },
      },
      { $project: { ownerId: 1, topicId: "$version.topicId" } },
    ])
    .toArray();
  for (const q of published) await addDiscoveryPath(db, q.ownerId, q.topicId);
}
