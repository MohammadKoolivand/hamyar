import { createHash } from "node:crypto";

export class PdfInputError extends Error {}
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_PDF_BYTES * 2 + 128 * 1024;

export function checkPdf(file: File, label: string) {
  if (!file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > MAX_PDF_BYTES)
    throw new PdfInputError(`فایل ${label} باید PDF و حداکثر ۱۰ مگابایت باشد.`);
  if (file.type && !["application/pdf", "application/octet-stream"].includes(file.type))
    throw new PdfInputError(`نوع فایل ${label} معتبر نیست.`);
}
export async function pdfPages(file: File) {
  checkPdf(file, "آزمون");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-")
    throw new PdfInputError("امضای PDF معتبر نیست.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({
    data: bytes, isEvalSupported: false, useSystemFonts: false,
    disableFontFace: true, stopAtErrors: true,
  });
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    deadline = setTimeout(() => reject(new PdfInputError("پردازش PDF بیش از حد طول کشید.")), 30000);
  });
  try {
    const document = await Promise.race([loading.promise, timeout]);
    if (document.numPages > 40)
      throw new PdfInputError("دفترچه نباید بیش از ۴۰ صفحه داشته باشد.");
    const pages: string[] = [];
    let total = 0;
    for (let p = 1; p <= document.numPages; p++) {
      const page = await Promise.race([document.getPage(p), timeout]);
      const content = await Promise.race([page.getTextContent(), timeout]);
      const lines: string[] = [];
      let current = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        current += item.str + (item.hasEOL ? "\n" : " ");
      }
      for (const line of current.split(/\r?\n/)) {
        const cleaned = line.replace(/\s+/g, " ").trim();
        if (cleaned) lines.push(cleaned);
      }
      const text = lines.join("\n").slice(0, 25000);
      total += text.length;
      if (total > 170000) throw new PdfInputError("متن PDF بیش از حد طولانی است.");
      pages.push(text);
      page.cleanup();
    }
    return { pages, hash, pageCount: document.numPages, filename: file.name.slice(0, 180) };
  } catch (error) {
    if (error instanceof PdfInputError) throw error;
    throw new PdfInputError("PDF قابل خواندن نیست؛ فایل را بررسی کنید.");
  } finally {
    if (deadline) clearTimeout(deadline);
    await loading.destroy().catch(() => {});
  }
}
