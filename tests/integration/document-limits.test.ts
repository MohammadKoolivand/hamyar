import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processDocument } from "../../src/server/imports/document-engine";

function manyPagePdf(count: number) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${count} /Kids [${Array.from({ length: count }, (_, i) => `${i + 3} 0 R`).join(" ")}] >>`,
    ...Array.from(
      { length: count },
      () =>
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> >>",
    ),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
test("real document reader rejects a genuine 101-page PDF before rasterization and corrupt PDF fails closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hodhod-uat-limits-"));
  try {
    const file = join(dir, "too-many.pdf");
    await writeFile(file, manyPagePdf(101));
    await assert.rejects(processDocument(file, dir), /exceeds 100 pages/);
    const broken = join(dir, "broken.pdf");
    await writeFile(broken, Buffer.from("%PDF-1.4\nbroken"));
    await assert.rejects(processDocument(broken, dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
