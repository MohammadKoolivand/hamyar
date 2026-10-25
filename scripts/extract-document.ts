import { writeDocumentResult } from "../src/server/imports/document-engine";
try {
  await writeDocumentResult(process.argv[2], process.argv[3]);
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message.slice(0, 200)
      : "Document processing failed",
  );
  process.exitCode = 1;
}
