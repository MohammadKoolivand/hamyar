import { backend } from "@/server/backend";
import { PdfInputError, MAX_PDF_BYTES, MAX_UPLOAD_BYTES, pdfPages } from "@/server/exam-pdf";
import { examMetadataSchema, splitExamPages } from "@/lib/exam-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class InputError extends Error { constructor(message: string, public status = 400) { super(message); } }
async function boundedBytes(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("فایل انتخاب نشده است");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new InputError("حجم کل فایل‌ها بیش از حد مجاز است", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
function response(message: string, status: number) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  try {
    const allowed = new URL(process.env.APP_ORIGIN ?? "http://127.0.0.1:5174").origin;
    const origin = request.headers.get("origin");
    if (!origin || origin !== allowed || request.headers.get("sec-fetch-site") === "cross-site")
      throw new InputError("مبدأ درخواست معتبر نیست", 403);
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data;")) throw new InputError("فرمت آپلود معتبر نیست");
    const app = await backend();
    const cookie = request.headers.get("cookie") ?? "";
    const auth = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    if (auth.statusCode !== 200) throw new InputError("ابتدا وارد حساب شوید", 401);
    if (auth.json().role !== "teacher") throw new InputError("فقط معلم می‌تواند آزمون وارد کند", 403);
    const gate = await app.inject({
      method: "POST", url: "/api/exams/upload-permission",
      headers: { cookie, origin: allowed },
      payload: {},
    });
    if (gate.statusCode !== 200)
      throw new InputError(gate.statusCode === 429 ? "تعداد درخواست‌های آپلود بیش از حد مجاز است" : "اجازه آپلود صادر نشد", gate.statusCode);

    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES)
      throw new InputError("حجم فایل‌ها بیش از حد مجاز است", 413);
    const bytes = await boundedBytes(request);
    const formRequest = new Request("http://local.invalid", {
      method: "POST",
      headers: { "content-type": type },
      body: new Uint8Array(bytes).buffer,
    });
    const form = await formRequest.formData();
    const raw = form.get("metadata");
    if (typeof raw !== "string" || raw.length > 5000) throw new InputError("مشخصات آزمون معتبر نیست");
    let metadata: unknown;
    try { metadata = JSON.parse(raw); } catch { throw new InputError("مشخصات آزمون معتبر نیست"); }
    const result = examMetadataSchema.safeParse(metadata);
    if (!result.success) throw new InputError("اطلاعات آزمون ناقص یا نامعتبر است");
    const questions = form.get("questions");
    const answers = form.get("answers");
    if (!(questions instanceof File)) throw new InputError("فایل سؤال‌ها الزامی است");
    if (questions.size > MAX_PDF_BYTES) throw new InputError("PDF بیش از ۱۰ مگابایت است", 413);
    if (answers !== null && !(answers instanceof File)) throw new InputError("پاسخ‌نامه نامعتبر است");
    const primary = await pdfPages(questions);
    const answer = answers instanceof File ? await pdfPages(answers) : null;
    const drafts = splitExamPages(primary.pages);
    if (!drafts.length) throw new InputError(
      "متن قابل استخراج نیست. PDF احتمالاً اسکن‌شده است و به OCR نیاز دارد.", 422,
    );
    const warning = drafts.some((q) => q.confidence === "low")
      ? "مرزبندی سؤال‌ها نامطمئن است؛ قبل از تأیید، متن و تعداد سؤال‌ها را بررسی کنید."
      : primary.pages.some((p) => p.trim().length < 20)
        ? "بعضی صفحه‌ها بدون متن هستند؛ شکل‌ها یا صفحات اسکن‌شده باید دستی بررسی شوند."
        : "شکل‌ها، فرمول‌ها و پاسخ‌ها هنوز نیازمند بررسی دستی هستند.";
    const payload = {
      metadata: result.data, questions: drafts, questionHash: primary.hash,
      questionFile: primary.filename, questionPages: primary.pageCount,
      ...(answer ? {
        answerHash: answer.hash, answerFile: answer.filename,
        answerPreview: answer.pages.join("\n\n").slice(0, 16000),
      } : {}),
      warning,
    };
    const saved = await app.inject({
      method: "POST", url: "/api/exams/import",
      headers: {
        cookie, origin: allowed, "content-type": "application/json",
        ...(request.headers.get("idempotency-key")
          ? { "idempotency-key": request.headers.get("idempotency-key")! } : {}),
      },
      payload,
    });
    return new Response(saved.body, {
      status: saved.statusCode,
      headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof InputError) return response(error.message, error.status);
    if (error instanceof PdfInputError) return response(error.message, 422);
    return response("آپلود یا پردازش PDF انجام نشد؛ دوباره تلاش کنید", 503);
  }
}
