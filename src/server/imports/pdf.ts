import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const exec = promisify(execFile);
export async function extractPdfText(
  bytes: Buffer,
): Promise<{ text: string; notice: string }> {
  const directory = await mkdtemp(join(tmpdir(), "hamyar-pdf-"));
  try {
    const file = join(directory, "document.pdf");
    await writeFile(file, bytes, { mode: 0o600 });
    const { stdout } = await exec(
      process.env.PDFTOTEXT_BIN ?? "pdftotext",
      ["-f", "1", "-l", "100", "-layout", "-enc", "UTF-8", file, "-"],
      {
        timeout: 20000,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
        env: { ...process.env },
      },
    );
    const text = stdout.trim().slice(0, 200000);
    return {
      text,
      notice: text
        ? "متن حداکثر ۱۰۰ صفحه استخراج شد. ترتیب فارسی، تقسیم سؤال‌ها، فرمول‌ها و شکل‌ها باید با PDF تطبیق داده شوند؛ شکل‌ها خودکار استخراج نمی‌شوند."
        : "فایل متن قابل استخراج ندارد؛ احتمالاً اسکن است. OCR فعال نیست؛ سؤال‌ها را دستی اضافه کنید.",
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      text: "",
      notice:
        code === "ENOENT"
          ? "ابزار pdftotext روی سرور نصب نیست؛ فایل ذخیره شده و ورود دستی سؤال‌ها در دسترس است."
          : "استخراج متن انجام نشد؛ PDF ممکن است رمزدار، خراب، بسیار بزرگ یا اسکن‌شده باشد. فایل را بررسی کنید یا سؤال‌ها را دستی وارد کنید.",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
