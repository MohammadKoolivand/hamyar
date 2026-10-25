import { backend } from "@/server/backend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
class PayloadLimit extends Error {}
async function payload(request: Request, limit = 65536) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new PayloadLimit();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const app = await backend();
    const large =
      request.method === "POST" &&
      /^\/api\/exam-imports\/[a-f0-9-]{36}\/files\/(question|answer)$/.test(
        url.pathname,
      );
    if (large) {
      const eid = url.pathname.split("/")[3];
      const authorized = await app.inject({
        method: "GET",
        url: `/api/exam-imports/${eid}`,
        headers: Object.fromEntries(request.headers.entries()),
      });
      if (authorized.statusCode !== 200)
        return new Response(authorized.body, {
          status: authorized.statusCode,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
    }
    const body = !["GET", "HEAD"].includes(request.method)
      ? await payload(request, large ? 20 * 1024 * 1024 : 65536)
      : undefined;
    const headers = Object.fromEntries(request.headers.entries());
    const response = await app.inject({
      method: request.method as
        "GET" | "POST" | "HEAD" | "PUT" | "PATCH" | "DELETE" | "OPTIONS",
      url: url.pathname + url.search,
      headers,
      ...(!["GET", "HEAD"].includes(request.method) ? { payload: body } : {}),
    });
    const output = new Headers();
    for (const [name, value] of Object.entries(response.headers)) {
      if (
        value === undefined ||
        [
          "connection",
          "keep-alive",
          "transfer-encoding",
          "content-length",
        ].includes(name)
      )
        continue;
      for (const item of Array.isArray(value) ? value : [value])
        output.append(name, String(item));
    }
    output.set("Cache-Control", "private, no-store");
    return new Response(
      request.method === "HEAD" ? null : new Uint8Array(response.rawPayload),
      {
        status: response.statusCode,
        headers: output,
      },
    );
  } catch (error) {
    if (error instanceof PayloadLimit)
      return Response.json(
        { message: "حجم درخواست بیش از حد مجاز است" },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      { message: "اتصال به پایگاه داده برقرار نشد؛ دوباره تلاش کنید" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
  handle as OPTIONS,
};
