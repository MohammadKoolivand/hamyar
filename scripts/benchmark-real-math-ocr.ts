/** Benchmark specialist Math OCR using locally obtained real exam PDFs.
 * Usage: MATH_OCR_ENABLED=true ... node --import tsx scripts/benchmark-real-math-ocr.ts manifest.json
 * No PDF or crop image is uploaded. A benchmark with no reference transcription cannot claim accuracy.
 */
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { mathOcrReady, suggestMathLatex, type MathCrop } from "../src/server/imports/math-ocr";

const exec = promisify(execFile);
interface Sample { id: string; pdf: string; page: number; crop: MathCrop; referenceLatex: string; sourceUrl?: string }
async function main() {
  const manifest = process.argv[2];
  if (!manifest) throw new Error("Provide a JSON manifest of labeled real exam crops");
  const samples: Sample[] = JSON.parse(await readFile(resolve(manifest), "utf8"));
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > 50)
    throw new Error("Provide 1 to 50 labeled samples");
  if (!(await mathOcrReady())) throw new Error("Math OCR model disabled or checkpoint missing; benchmark NOT RUN");
  const dir = await mkdtemp(join(tmpdir(), "hodhod-math-benchmark-"));
  const results: { id: string; sha256: string; page: number; predicted?: string; expected?: string; exact?: boolean; error?: string }[] = [];
  try {
    for (const [index, sample] of samples.entries()) {
      if (!sample.referenceLatex?.trim() || !Number.isInteger(sample.page) || sample.page < 1)
        throw new Error("Every real-exam sample needs page and independently transcribed referenceLatex");
      const bytes = await readFile(resolve(sample.pdf));
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw new Error("Not a PDF: " + sample.id);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const prefix = join(dir, String(index));
      try {
        await exec("pdftoppm", ["-f", String(sample.page), "-l", String(sample.page),
          "-scale-to", "1600", "-png", "-singlefile", resolve(sample.pdf), prefix],
          { timeout: 45000, maxBuffer: 64 * 1024 });
        const image = await readFile(prefix + ".png");
        const result = await suggestMathLatex(image, sample.crop);
        const normalize = (s: string) => s.replace(/\s+/g, "");
        results.push({ id: sample.id, sha256, page: sample.page, predicted: result.latex,
          expected: sample.referenceLatex, exact: normalize(result.latex) === normalize(sample.referenceLatex) });
      } catch (error) {
        results.push({ id: sample.id, sha256, page: sample.page,
          error: error instanceof Error ? error.message : "unknown error" });
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const correct = results.filter((item) => item.exact).length;
  const attempted = results.length;
  process.stdout.write(JSON.stringify({
    benchmark: "real_exam_manual_crop_math_ocr_v1", model: "pix2tex", attempted,
    exact: correct, exactFraction: correct / attempted,
    note: "Exact TeX string match is only a proxy; equivalent LaTeX may differ. Human visual review is still required.",
    results,
  }, null, 2) + "\n");
  if (results.some((item) => item.error)) process.exitCode = 1;
}
main().catch((error) => {
  process.stderr.write(String(error) + "\n");
  process.exitCode = 1;
});
