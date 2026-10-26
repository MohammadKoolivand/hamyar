export interface TextLine {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number | null;
  method: "text" | "ocr";
}
export interface Region {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ParsedQuestion {
  number: number | null;
  statement: string;
  options: string[];
  regions: Region[];
  method: "text" | "ocr" | "hybrid";
  confidence: number | null;
  warnings: string[];
}
export interface KeyEntry {
  number: number;
  option: number;
  page: number;
  confidence: number | null;
  method: string;
}
export const digits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
export const normalized = (s: string) =>
  digits(s)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200e\u200f\s]+/g, " ")
    .trim();
const anchor = (s: string) =>
  digits(s).match(
    /^\s*(?:(سؤ?ال|سوال|Question)\s*)?(\d{1,4})(?:\s*([.)\-–ـ:،])\s*|\s+)(.+)/i,
  );
export function parseQuestions(
  lines: TextLine[],
  sizes: Record<number, { width: number; height: number }>,
): ParsedQuestion[] {
  const groups: TextLine[][] = [];
  for (const page of [...new Set(lines.map((l) => l.page))]) {
    const pageLines = lines.filter((l) => l.page === page && l.text.trim());
    const anchors = pageLines.filter((l) => anchor(l.text));
    const width = sizes[page].width;
    // Only split columns with repeated question anchors on both sides; uncertain layouts stay reviewable images.
    const left = anchors.filter((l) => l.x + l.width / 2 < width * 0.46),
      right = anchors.filter((l) => l.x + l.width / 2 > width * 0.54);
    if (
      left.length >= 2 &&
      right.length >= 2 &&
      pageLines.every((l) => l.width < width * 0.78)
    ) {
      for (const side of [false, true])
        groups.push(
          pageLines
            .filter((l) => l.x + l.width / 2 < width / 2 === side)
            .sort((a, b) => a.y - b.y || b.x - a.x),
        );
    } else groups.push(pageLines.sort((a, b) => a.y - b.y || b.x - a.x));
  }
  const result: ParsedQuestion[] = [];
  let current: ParsedQuestion | undefined;
  let collected: TextLine[] = [];
  function finish() {
    if (!current) return;
    for (const page of [...new Set(collected.map((l) => l.page))]) {
      const ls = collected.filter((l) => l.page === page);
      const size = sizes[page];
      const y = Math.max(0, Math.min(...ls.map((l) => l.y)) - 8);
      const bottom = Math.min(
        size.height,
        Math.max(...ls.map((l) => l.y + l.height)) + 12,
      );
      current.regions.push({
        page,
        x: 0,
        y,
        width: size.width,
        height: Math.max(1, bottom - y),
      });
    }
    if (current.options.length !== 4)
      current.warnings.push(
        "گزینه‌های کامل چهارگانه استخراج نشد؛ با تصویر تطبیق دهید",
      );
    if (current.method !== "text")
      current.warnings.push("متن OCR نیازمند تطبیق با تصویر است");
    if (current.regions.length > 1)
      current.warnings.push(
        "سؤال ادامه‌دار یا مرزبندی چندصفحه‌ای نیازمند بررسی است",
      );
    const conf = collected
      .map((l) => l.confidence)
      .filter((v): v is number => v !== null);
    current.confidence = conf.length
      ? conf.reduce((a, b) => a + b, 0) / conf.length
      : null;
    if (current.confidence !== null && current.confidence < 80)
      current.warnings.push("اطمینان OCR کمتر از ۸۰ است");
    current.statement = current.statement.trim().slice(0, 5000);
    result.push(current);
    current = undefined;
    collected = [];
  }
  for (const group of groups)
    for (const line of group) {
      const text = digits(line.text.normalize("NFKC"))
        .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
        .replace(/((?:سؤ?ال|سوال)\s*)[.)]\s*(\d+)/, "$1$2.")
        .trim();
      const a = anchor(text);
      const inline = [
        ...text.matchAll(/(?:^|\s)\(?([1-4]|الف|ب|ج|د)\s*[()\]:،]\s*/g),
      ];
      if (current && inline.length > 1 && !a?.[1]) {
        const parts = inline
          .map((marker, i) => ({
            n: /\d/.test(marker[1])
              ? Number(marker[1])
              : ["الف", "ب", "ج", "د"].indexOf(marker[1]) + 1,
            text: text
              .slice(
                marker.index! + marker[0].length,
                inline[i + 1]?.index ?? text.length,
              )
              .trim(),
          }))
          .sort((a, b) => a.n - b.n);
        if (
          parts.every(
            (p, i) => p.n === current!.options.length + i + 1 && p.text,
          )
        ) {
          current.options.push(...parts.map((p) => p.text));
          collected.push(line);
          current.warnings.push(
            "گزینه‌های کنار هم با تصویر و ترتیب شماره‌ها تطبیق داده شوند",
          );
          continue;
        }
      }
      const opt = text.match(
        /^\s*\(?((?:[1-4]|الف|ب|ج|د))\s*(?:[()\]:،]\s*|\s+)(.+)/,
      );
      if (opt && current && !a?.[1]) {
        const n = /\d/.test(opt[1])
          ? Number(opt[1])
          : ["الف", "ب", "ج", "د"].indexOf(opt[1]) + 1;
        if (n === current.options.length + 1) {
          current.options.push(opt[2]);
          collected.push(line);
          continue;
        }
      }
      // OCR may lose one option marker or turn ')' into '.'. During a partial
      // option block a bare low-number anchor is ambiguous, not a new question.
      // Keep its raw text for review; never invent the missing option(s). Explicit
      // question labels and anchors after a complete block remain valid.
      if (
        current &&
        current.options.length > 0 &&
        current.options.length < 4 &&
        a &&
        !a[1] &&
        Number(a[2]) >= 1 &&
        Number(a[2]) <= 4
      ) {
        current.warnings.push(
          "شماره‌گذاری گزینه‌ها ناقص یا نامطمئن است؛ مرز و گزینه‌ها را بررسی کنید",
        );
        current.options[current.options.length - 1] += "\n" + line.text;
        collected.push(line);
        continue;
      }
      if (a && (a[1] || a[3] || Number(a[2]) > 4)) {
        finish();
        current = {
          number: Number(a[2]),
          statement: a[4],
          options: [],
          regions: [],
          method: line.method,
          confidence: null,
          warnings: ["مرز سؤال، فرمول‌ها و شکل‌ها باید توسط معلم بررسی شوند"],
        };
        collected = [line];
      } else if (current) {
        if (current.options.length)
          current.options[current.options.length - 1] += "\n" + line.text;
        else current.statement += "\n" + line.text;
        collected.push(line);
        if (current.method !== line.method) current.method = "hybrid";
      }
    }
  finish();
  if (!result.length && lines.length) {
    const pages = [...new Set(lines.map((l) => l.page))];
    for (const page of pages) {
      const ls = lines.filter((l) => l.page === page);
      result.push({
        number: null,
        statement: ls
          .map((l) => l.text)
          .join("\n")
          .slice(0, 5000),
        options: [],
        regions: [{ page, x: 0, y: 0, ...sizes[page] }],
        method: ls[0].method,
        confidence: null,
        warnings: ["شماره یا مرز سؤال تشخیص داده نشد؛ صفحه را دستی تقسیم کنید"],
      });
    }
  }
  const numbers = new Map<number, number>();
  for (const q of result)
    if (q.number !== null)
      numbers.set(q.number, (numbers.get(q.number) ?? 0) + 1);
  for (const q of result)
    if (q.number !== null && numbers.get(q.number)! > 1)
      q.warnings.push("شماره سؤال تکراری است");
  if (result.length > 500)
    throw new Error("More than 500 questions; split the document");
  return result;
}
export function parseAnswerKey(lines: TextLine[]): {
  entries: KeyEntry[];
  warnings: string[];
} {
  const entries: KeyEntry[] = [];
  const warnings: string[] = [];
  for (const line of lines) {
    const text = digits(line.text.normalize("NFKC"))
      .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
      .replace(/((?:سؤ?ال|سوال)\s*)[.)]\s*(\d+)/, "$1$2.")
      .trim();
    const explicit =
      /^(?:سؤ?ال|سوال|Question)?\s*(\d{1,4})\s*(?:پاسخ|گزینه|[:=\-.)]|\s)\s*([1-9])\s*$/i.exec(
        text,
      );
    const tokens = text.split(/\s+/);
    const pairs = explicit
      ? [[Number(explicit[1]), Number(explicit[2])]]
      : tokens.length >= 2 &&
          tokens.length % 2 === 0 &&
          tokens.every((t) => /^\d{1,4}$/.test(t))
        ? Array.from({ length: tokens.length / 2 }, (_, i) => [
            Number(tokens[i * 2]),
            Number(tokens[i * 2 + 1]),
          ])
        : [];
    for (const [number, option] of pairs) {
      if (option < 1 || option > 4 || number < 1) {
        warnings.push(`گزینه یا شماره نامعتبر در صفحه ${line.page}`);
        continue;
      }
      entries.push({
        number,
        option,
        page: line.page,
        confidence: line.confidence,
        method: line.method,
      });
    }
  }
  if (!entries.length)
    warnings.push(
      "کلید متنی معتبر شناسایی نشد؛ جدول تصویری یا خانه علامت‌خورده را دستی بررسی کنید",
    );
  return { entries, warnings };
}
export function matchKey(q: ParsedQuestion, entries: KeyEntry[]) {
  const matches = entries.filter((e) => e.number === q.number);
  const warnings: string[] = [];
  let option: number | null = null;
  if (!matches.length)
    warnings.push("پاسخ متناظر با شماره واقعی سؤال پیدا نشد");
  else if (matches.length !== 1)
    warnings.push("شماره کلید تکراری یا متناقض است");
  else if (matches[0].confidence !== null && matches[0].confidence < 85)
    warnings.push("کلید OCR نامطمئن است");
  else if (q.options.length !== 4)
    warnings.push("بدون چهار گزینه نمی‌توان کلید را متصل کرد");
  else option = matches[0].option;
  return {
    option,
    matches,
    warnings,
    status: option === null ? "needs_review" : "matched",
  };
}
