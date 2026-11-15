import { backend } from "@/server/backend";
import { forwardApiRequest } from "@/server/api-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    return await forwardApiRequest(request, await backend());
  } catch {
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
