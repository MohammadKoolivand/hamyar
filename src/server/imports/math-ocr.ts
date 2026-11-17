import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { mathMarkup } from "../../lib/math-render";

const exec = promisify(execFile);
let modelInFlight = false;
export interface MathCrop { x: number; y: number; width: number; height: number }
export interface MathOcrSuggestion {
  latex: string;
  model: "pix2tex";
  confidence: null;
  requiresHumanReview: true;
  crop: MathCrop;
}

/** Client supplies percentages, never arbitrary filesystem coordinates or paths. */
export function mathCropPixels(crop: MathCrop, width: number, height: number) {
  const all = [crop.x, crop.y, crop.width, crop.height, width, height];
  if (all.some((v) => !Number.isFinite(v)) ||
      width < 24 || height < 24 || width > 4096 || height > 4096 ||
      crop.x < 0 || crop.y < 0 || crop.width < 3 || crop.height < 2 ||
      crop.x + crop.width > 100 || crop.y + crop.height > 100 ||
      crop.width * crop.height > 6500) {
    throw new Error("ناحیه فرمول نامعتبر یا بیش‌ازحد بزرگ است؛ فرمول را جداگانه انتخاب کنید");
  }
  const left = Math.floor(crop.x * width / 100);
  const top = Math.floor(crop.y * height / 100);
  const right = Math.ceil((crop.x + crop.width) * width / 100);
  const bottom = Math.ceil((crop.y + crop.height) * height / 100);
  const box = {
    left, top,
    width: Math.min(width - left, right - left),
    height: Math.min(height - top, bottom - top),
  };
  if (box.width < 24 || box.height < 16)
    throw new Error("برش فرمول برای تشخیص بسیار کوچک است");
  return box;
}
export function parseMathOcrOutput(output: string): string {
  const line = output.trim().split(/\r?\n/).findLast((s) => s.startsWith("MATH_OCR_RESULT:"));
  if (!line) throw new Error("مدل پاسخ معتبر برنگرداند");
  const json: unknown = JSON.parse(line.slice("MATH_OCR_RESULT:".length));
  if (typeof json !== "string") throw new Error("خروجی مدل متنی نیست");
  const latex = json.trim().replace(/^\$\$(.*)\$\$/s, "$1").replace(/^\$(.*)\$$/s, "$1").trim();
  if (!latex || latex.length > 700 || [...latex].some((char) => char.charCodeAt(0) < 32))
    throw new Error("فرمول پیشنهادی معتبر نیست");
  // Parses and rejects dangerous/unrecognized macros. This is syntax validation,
  // NOT evidence of mathematical equivalence to the source image.
  mathMarkup(latex, false);
  return latex;
}
export async function mathOcrReady() {
  if (process.env.MATH_OCR_ENABLED !== "true") return false;
  const checkpoint = process.env.MATH_OCR_CHECKPOINT;
  const config = process.env.MATH_OCR_CONFIG;
  if (!checkpoint || !config) return false;
  try {
    const [a, b] = await Promise.all([stat(resolve(checkpoint)), stat(resolve(config))]);
    return a.isFile() && a.size > 1_000_000 && b.isFile();
  } catch {
    return false;
  }
}
/** On demand only, no writes to the question bank; private page data stays server-side. */
export async function suggestMathLatex(
  pagePng: Buffer,
  crop: MathCrop,
): Promise<MathOcrSuggestion> {
  if (!(await mathOcrReady())) throw new Error("مدل Math OCR روی سرور نصب یا فعال نشده است");
  if (modelInFlight) throw new Error("مدل در حال پردازش درخواست دیگری است؛ دوباره تلاش کنید");
  if (pagePng.byteLength > 25 * 1024 * 1024) throw new Error("تصویر صفحه بیش‌ازحد بزرگ است");
  const metadata = await sharp(pagePng, { limitInputPixels: 16_000_000 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("ابعاد تصویر نامعتبر است");
  const rectangle = mathCropPixels(crop, metadata.width, metadata.height);
  modelInFlight = true;
  let dir: string | undefined;
  try {
    dir = await mkdtemp(join(tmpdir(), "hodhod-math-ocr-"));
    const image = await sharp(pagePng, { limitInputPixels: 16_000_000 })
      .extract(rectangle).flatten({ background: "#ffffff" }).png().toBuffer();
    const file = join(dir, "formula.png");
    await writeFile(file, image, { mode: 0o600 });
    const { stdout } = await exec(
      process.env.MATH_OCR_PYTHON || "python3",
      [resolve("scripts/math-ocr-pix2tex.py"), file,
        resolve(process.env.MATH_OCR_CONFIG!),
        resolve(process.env.MATH_OCR_CHECKPOINT!)],
      {
        timeout: 120_000,
        maxBuffer: 64 * 1024,
        cwd: resolve("."),
        env: {
          NODE_ENV: process.env.NODE_ENV ?? "production",
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          VIRTUAL_ENV: process.env.VIRTUAL_ENV,
          PYTHONNOUSERSITE: "1",
          HF_HUB_OFFLINE: "1",
          TRANSFORMERS_OFFLINE: "1",
          CUDA_VISIBLE_DEVICES: "",
          OMP_NUM_THREADS: "1",
        },
      },
    );
    return {
      latex: parseMathOcrOutput(stdout),
      model: "pix2tex",
      confidence: null,
      requiresHumanReview: true,
      crop,
    };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
    modelInFlight = false;
  }
}
