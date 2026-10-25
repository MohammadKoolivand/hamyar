import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { z } from "zod";
import { MongoClient } from "mongodb";
import { createContext } from "../src/server/context";
import {
  reviewedSampleSchema,
  importReviewedSamples,
} from "../src/server/imports/reviewed-samples";

const args = process.argv.slice(2);
const manifestPath = args[0];
const ownerId = z.uuid().parse(args[1]);
if (!manifestPath || args.slice(2).some((a) => a !== "--apply"))
  throw new Error(
    "Usage: node --env-file-if-exists=.env --import tsx scripts/import-category-samples.ts MANIFEST TEACHER_UUID [--apply]",
  );
const root = await realpath(dirname(resolve(manifestPath)));
const entries = z
  .array(reviewedSampleSchema)
  .min(1)
  .max(20)
  .parse(JSON.parse(await readFile(manifestPath, "utf8")));
const prepared = await Promise.all(
  entries.map(async (entry) => {
    if (!entry.imageFile) return entry;
    const path = await realpath(resolve(root, entry.imageFile));
    const rel = relative(root, path);
    if (rel.startsWith("..") || isAbsolute(rel))
      throw new Error("Image must be inside manifest directory");
    return { ...entry, image: await readFile(path) };
  }),
);
const client = new MongoClient(
  process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017",
  { serverSelectionTimeoutMS: 5000 },
);
try {
  await client.connect();
  const result = await importReviewedSamples(
    createContext(client.db(process.env.MONGO_DB ?? "hamyar")),
    ownerId,
    prepared,
    args.includes("--apply"),
  );
  console.log(
    JSON.stringify({ apply: args.includes("--apply"), result }, null, 2),
  );
} finally {
  await client.close();
}
