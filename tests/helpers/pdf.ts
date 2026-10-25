// Minimal genuine PDF with text; no dependency on external fixture downloads.
export function textPdf(lines: string[], padding = 0) {
  const content =
    "BT /F1 12 Tf 50 750 Td " +
    lines
      .map(
        (line, i) =>
          `${i ? "0 -24 Td " : ""}(${line.replace(/[\\()]/g, "\\$&")}) Tj`,
      )
      .join("\n") +
    " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n" + (padding ? "%" + ".".repeat(padding) + "\n" : "");
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const start = Buffer.byteLength(pdf);
  pdf +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}
