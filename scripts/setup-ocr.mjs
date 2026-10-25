/* global process, fetch, AbortSignal, Buffer, console */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
const lock = JSON.parse(await readFile("config/ocr-models.lock.json", "utf8"));
const directory = process.env.OCR_DATA_DIR ?? resolve(".private/ocr");
await mkdir(directory, { recursive: true, mode: 0o700 });
for (const file of lock.files) {
  let bytes;
  try {
    bytes = await readFile(join(directory, file.name));
  } catch {
    /* The explicitly invoked setup downloads a missing model. */
  }
  if (
    !bytes ||
    createHash("sha256").update(bytes).digest("hex") !== file.sha256
  ) {
    const response = await fetch(file.url, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Download failed: ${file.name}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
      throw new Error(`Checksum mismatch: ${file.name}`);
    await writeFile(join(directory, file.name), bytes, { mode: 0o600 });
  }
  console.log(`Verified ${file.name}: ${file.sha256}`);
}
