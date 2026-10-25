import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfPages, PdfInputError } from "../../src/server/exam-pdf";
import { splitExamPages } from "../../src/lib/exam-import";

// Build a minimal valid PDF instead of relying on a third-party exam or copyrighted fixture.
function makePdf(texts: string[]) {
  const escape = (text: string) => text.replace(/[\\()]/g, (value) => "\\" + value);
  const stream = ["BT", "/F1 12 Tf", "50 750 Td", ...texts.flatMap((t, i) => [
    ...(i ? ["0 -26 Td"] : []), `(${escape(t)}) Tj`,
  ]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Root 1 0 R /Size ${offsets.length} >>\nstartxref\n${start}\n%%EOF`;
  return pdf;
}

test("reads a genuine text PDF and extracts numbered drafts without publishing", async () => {
  const file = new File([makePdf([
    "1) What is velocity?", "2) Calculate acceleration.",
  ])], "sample.pdf", { type: "application/pdf" });
  const result = await pdfPages(file);
  assert.equal(result.pageCount, 1);
  const drafts = splitExamPages(result.pages);
  assert.equal(drafts.length, 2);
  assert.match(drafts[0].statement, /velocity/);
  assert.deepEqual(drafts.map((x) => x.number), [1, 2]);
});

test("rejects non-PDF bytes even when file extension is .pdf", async () => {
  const file = new File(["not a PDF"], "fake.pdf", { type: "application/pdf" });
  await assert.rejects(() => pdfPages(file), PdfInputError);
});
