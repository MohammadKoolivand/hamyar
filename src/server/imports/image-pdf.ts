import sharp from "sharp";

/** Normalize a raster upload into the existing private PDF/OCR pipeline. */
export async function imageToPdf(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: 24_000_000, failOn: "error" });
  const metadata = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error("تصویر تک‌صفحه‌ای PNG، JPEG یا WebP لازم است");
  const { data, info } = await image
    .rotate()
    .toColourspace("srgb")
    .flatten({ background: "white" })
    .resize({
      width: 3000,
      height: 4000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 95 })
    .toBuffer({ resolveWithObject: true });
  const width = info.width,
    height = info.height;
  const pageWidth = 595,
    pageHeight = 842;
  const scale = Math.min(pageWidth / width, pageHeight / height);
  const drawWidth = width * scale,
    drawHeight = height * scale;
  const content = `q ${drawWidth} 0 0 ${drawHeight} ${(pageWidth - drawWidth) / 2} ${(pageHeight - drawHeight) / 2} cm /Image1 Do Q`;
  const objects = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Image1 4 0 R >> >> /Contents 5 0 R >>`,
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`,
      ),
      data,
      Buffer.from("\nendstream"),
    ]),
    Buffer.from(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    ),
  ];
  const parts = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  let length = parts[0].length;
  objects.forEach((object, i) => {
    offsets.push(length);
    const bytes = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      object,
      Buffer.from("\nendobj\n"),
    ]);
    parts.push(bytes);
    length += bytes.length;
  });
  parts.push(
    Buffer.from(
      `xref\n0 6\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
        .join(
          "",
        )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(parts);
}
