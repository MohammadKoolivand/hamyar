import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { type TextLine } from "./layout";
const exec = promisify(execFile);
export interface DocumentPage {
  page: number;
  width: number;
  height: number;
  imageFile: string;
  lines: TextLine[];
  method: "text" | "ocr" | "hybrid";
  warnings: string[];
  milliseconds: number;
  engine: { pdfjs: string; ocrModelsSha256: string | null };
}
export async function verifyOcrModels() {
  const root = resolve(process.env.OCR_DATA_DIR ?? ".private/ocr");
  const lock = JSON.parse(
    await readFile(resolve("config/ocr-models.lock.json"), "utf8"),
  ) as { files: { name: string; sha256: string }[] };
  for (const file of lock.files) {
    const data = await readFile(join(root, file.name));
    if (createHash("sha256").update(data).digest("hex") !== file.sha256)
      throw new Error("OCR model checksum mismatch");
  }
  return root;
}
export function parseTsv(tsv: string, page: number): TextLine[] {
  const groups = new Map<
    string,
    {
      words: string[];
      x: number;
      y: number;
      r: number;
      b: number;
      conf: number[];
    }
  >();
  for (const row of tsv.split("\n").slice(1)) {
    const c = row.split("\t");
    if (c.length < 12 || c[0] !== "5" || !c[11]?.trim()) continue;
    const key = c.slice(1, 5).join(":");
    const [x, y, w, h, conf] = c.slice(6, 11).map(Number);
    if (![x, y, w, h, conf].every(Number.isFinite)) continue;
    const group = groups.get(key) ?? {
      words: [],
      x,
      y,
      r: x + w,
      b: y + h,
      conf: [],
    };
    group.words.push(c.slice(11).join("\t"));
    group.x = Math.min(group.x, x);
    group.y = Math.min(group.y, y);
    group.r = Math.max(group.r, x + w);
    group.b = Math.max(group.b, y + h);
    if (conf >= 0) group.conf.push(conf);
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({
    page,
    text: g.words.join(" "),
    x: g.x,
    y: g.y,
    width: g.r - g.x,
    height: g.b - g.y,
    confidence: g.conf.length
      ? g.conf.reduce((a, b) => a + b, 0) / g.conf.length
      : null,
    method: "ocr",
  }));
}
export async function processDocument(
  file: string,
  directory: string,
  onPage?: (page: DocumentPage) => Promise<void>,
) {
  const { getDocument, OPS, Util, version } =
    await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = await readFile(file);
  if (
    bytes.length > 20 * 1024 * 1024 ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw new Error("Invalid PDF");
  const loading = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
    maxImageSize: 12_000_000,
    verbosity: 0,
  });
  const doc = await loading.promise;
  const pages: DocumentPage[] = [];
  let outputBytes = 0;
  try {
    if (doc.numPages > 100) throw new Error("PDF exceeds 100 pages");
    for (let page = 1; page <= doc.numPages; page++) {
      const start = Date.now();
      const p = await doc.getPage(page);
      const viewport = p.getViewport({ scale: 1 });
      const scale = 1600 / Math.max(viewport.width, viewport.height);
      const width = Math.round(viewport.width * scale),
        height = Math.round(viewport.height * scale);
      const content = await p.getTextContent();
      const grouped = new Map<number, TextLine[]>();
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        const y = (viewport.height - item.transform[5]) * scale;
        const line: TextLine = {
          page,
          text: item.str,
          x: item.transform[4] * scale,
          y: Math.max(
            0,
            y - (item.height || Math.abs(item.transform[3])) * scale,
          ),
          width: item.width * scale,
          height: Math.max(
            1,
            (item.height || Math.abs(item.transform[3])) * scale,
          ),
          method: "text",
          confidence: null,
        };
        const k =
          [...grouped.keys()].find(
            (key) => Math.abs(key - line.y) < Math.max(3, line.height * 0.4),
          ) ?? line.y;
        grouped.set(k, [...(grouped.get(k) ?? []), line]);
      }
      let lines = [...grouped.values()].map((ls) => {
        const rtl = ls.some((l) => /[\u0600-\u06ff]/.test(l.text));
        ls.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
        return {
          ...ls[0],
          text: (() => {
            const chunks: string[] = [];
            for (let i = 0; i < ls.length; i++) {
              if (i > 0) {
                const gap = rtl
                  ? ls[i - 1].x - ls[i].x - ls[i].width
                  : ls[i].x - ls[i - 1].x - ls[i - 1].width;
                if (gap > Math.max(2, ls[i].height * 0.18)) chunks.push(" ");
              }
              if (rtl && /^[0-9۰-۹٠-٩]+$/.test(ls[i].text)) {
                const run = [ls[i]];
                while (
                  i + 1 < ls.length &&
                  /^[0-9۰-۹٠-٩]+$/.test(ls[i + 1].text)
                )
                  run.push(ls[++i]);
                chunks.push(...run.reverse().map((l) => l.text));
              } else chunks.push(ls[i].text);
            }
            return chunks.join("").normalize("NFKC").replace(/ھ/g, "ه");
          })(),
          x: Math.min(...ls.map((l) => l.x)),
          width:
            Math.max(...ls.map((l) => l.x + l.width)) -
            Math.min(...ls.map((l) => l.x)),
        };
      });
      const imageFile = `page-${page}.png`;
      await exec(
        process.env.PDFTOPPM_BIN ?? "pdftoppm",
        [
          "-f",
          String(page),
          "-l",
          String(page),
          "-scale-to",
          "1600",
          "-png",
          "-singlefile",
          file,
          join(directory, `page-${page}`),
        ],
        {
          timeout: 45000,
          maxBuffer: 512 * 1024,
          env: {
            NODE_ENV: process.env.NODE_ENV ?? "production",
            PATH: process.env.PATH ?? "/usr/bin:/bin",
            OMP_THREAD_LIMIT: "1",
          },
        },
      );
      const warnings: string[] = [];
      let method: DocumentPage["method"] = "text";
      const text = lines.map((l) => l.text).join(" ");
      const bad =
        text.length < 30 ||
        [...text].filter((c) => c === "�" || c.charCodeAt(0) < 9).length >
          text.length * 0.02;
      if (bad) {
        const data = await verifyOcrModels();
        const cleaned = join(directory, `ocr-${page}.png`);
        await sharp(join(directory, imageFile), {
          limitInputPixels: 12_000_000,
        })
          .greyscale()
          .normalize()
          .toFile(cleaned);
        let { stdout } = await exec(
          process.env.TESSERACT_BIN ?? "tesseract",
          [
            basename(cleaned),
            "stdout",
            "--tessdata-dir",
            data,
            "-l",
            process.env.OCR_LANG ?? "fas",
            "--psm",
            "3",
            "-c",
            "tessedit_create_tsv=1",
          ],
          {
            cwd: directory,
            timeout: 60000,
            maxBuffer: 3 * 1024 * 1024,
            encoding: "utf8",
            env: {
              NODE_ENV: process.env.NODE_ENV ?? "production",
              PATH: process.env.PATH ?? "/usr/bin:/bin",
              OMP_THREAD_LIMIT: "1",
            },
          },
        );
        if (parseTsv(stdout, page).length < 12) {
          const retry = await exec(
            process.env.TESSERACT_BIN ?? "tesseract",
            [
              basename(cleaned),
              "stdout",
              "--tessdata-dir",
              data,
              "-l",
              process.env.OCR_LANG ?? "fas",
              "--psm",
              "6",
              "-c",
              "tessedit_create_tsv=1",
            ],
            {
              cwd: directory,
              timeout: 60000,
              maxBuffer: 3 * 1024 * 1024,
              encoding: "utf8",
              env: {
                NODE_ENV: process.env.NODE_ENV ?? "production",
                PATH: process.env.PATH,
                OMP_THREAD_LIMIT: "1",
              },
            },
          );
          if (
            parseTsv(retry.stdout, page).reduce(
              (n, l) => n + l.text.length,
              0,
            ) > parseTsv(stdout, page).reduce((n, l) => n + l.text.length, 0)
          )
            stdout = retry.stdout;
        }
        lines = parseTsv(stdout, page);
        method = "ocr";
        warnings.push("OCR: فرمول و ترتیب متن را با اصل صفحه تطبیق دهید");
      } else {
        const operators = await p.getOperatorList();
        let matrix = [1, 0, 0, 1, 0, 0];
        const stack: number[][] = [];
        let regionIndex = 0;
        for (let i = 0; i < operators.fnArray.length; i++) {
          const fn = operators.fnArray[i];
          const args = operators.argsArray[i];
          if (fn === OPS.save) stack.push([...matrix]);
          else if (fn === OPS.restore)
            matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
          else if (fn === OPS.transform) matrix = Util.transform(matrix, args);
          else if (
            fn === OPS.paintImageXObject ||
            fn === OPS.paintInlineImageXObject
          ) {
            const corners = [
              [0, 0],
              [1, 0],
              [0, 1],
              [1, 1],
            ].map((point) =>
              viewport.convertToViewportPoint(
                matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
                matrix[1] * point[0] + matrix[3] * point[1] + matrix[5],
              ),
            );
            const left = Math.max(
              0,
              Math.floor(Math.min(...corners.map((p) => p[0])) * scale),
            );
            const top = Math.max(
              0,
              Math.floor(Math.min(...corners.map((p) => p[1])) * scale),
            );
            const rw = Math.min(
              width - left,
              Math.ceil(
                (Math.max(...corners.map((p) => p[0])) -
                  Math.min(...corners.map((p) => p[0]))) *
                  scale,
              ),
            );
            const rh = Math.min(
              height - top,
              Math.ceil(
                (Math.max(...corners.map((p) => p[1])) -
                  Math.min(...corners.map((p) => p[1]))) *
                  scale,
              ),
            );
            if (rw < 150 || rh < 100 || regionIndex >= 8) continue;
            const covered = lines
              .filter(
                (l) =>
                  l.x >= left &&
                  l.y >= top &&
                  l.x < left + rw &&
                  l.y < top + rh,
              )
              .reduce((n, l) => n + l.text.length, 0);
            if (covered > 20) continue; // Reuse an existing text layer rather than OCRing it again.
            const modelDir = await verifyOcrModels();
            const cropFile = join(
              directory,
              `region-${page}-${regionIndex++}.png`,
            );
            await sharp(join(directory, imageFile))
              .extract({ left, top, width: rw, height: rh })
              .greyscale()
              .normalize()
              .toFile(cropFile);
            const { stdout } = await exec(
              process.env.TESSERACT_BIN ?? "tesseract",
              [
                basename(cropFile),
                "stdout",
                "--tessdata-dir",
                modelDir,
                "-l",
                process.env.OCR_LANG ?? "fas",
                "--psm",
                "3",
                "-c",
                "tessedit_create_tsv=1",
              ],
              {
                cwd: directory,
                timeout: 60000,
                maxBuffer: 3 * 1024 * 1024,
                encoding: "utf8",
                env: {
                  NODE_ENV: process.env.NODE_ENV ?? "production",
                  PATH: process.env.PATH,
                  OMP_THREAD_LIMIT: "1",
                },
              },
            );
            const found = parseTsv(stdout, page).map((l) => ({
              ...l,
              x: l.x + left,
              y: l.y + top,
            }));
            lines.push(...found);
            method = "hybrid";
            warnings.push(
              "نواحی تصویری فاقد لایه متن با OCR خوانده شدند؛ شکل و فرمول نیازمند بررسی است",
            );
          }
        }
      }
      outputBytes += (await stat(join(directory, imageFile))).size;
      if (outputBytes > 100 * 1024 * 1024)
        throw new Error("Rendered output exceeds 100 MiB");
      const result: DocumentPage = {
        engine: {
          pdfjs: version,
          ocrModelsSha256:
            method === "text"
              ? null
              : createHash("sha256")
                  .update(
                    await readFile(resolve("config/ocr-models.lock.json")),
                  )
                  .digest("hex"),
        },
        page,
        width,
        height,
        imageFile,
        lines,
        method,
        warnings,
        milliseconds: Date.now() - start,
      };
      pages.push(result);
      if (onPage) await onPage(result);
      p.cleanup();
    }
    return pages;
  } finally {
    await loading.destroy();
  }
}
export async function writeDocumentResult(file: string, directory: string) {
  const pages = await processDocument(file, directory, async (page) => {
    await writeFile(
      join(directory, "progress.json"),
      JSON.stringify({
        stage: page.method === "ocr" ? "ocr" : "reading",
        page: page.page,
      }),
    );
  });
  await writeFile(join(directory, "result.json"), JSON.stringify(pages));
}
