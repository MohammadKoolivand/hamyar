import type { Page } from "@playwright/test";
import type { FastifyInstance } from "fastify";
const pendingRoutes = new WeakMap<Page, Set<Promise<void>>>();
export async function drainBackendRoutes(page: Page) {
  const pending = pendingRoutes.get(page);
  while (pending?.size) await Promise.all([...pending]);
}
// Real application + Mongo fixture, isolated at the browser transport boundary.
// Only injected external dependencies (SMTP/AI) may be controlled by a test.
export async function routeBackend(page: Page, app: FastifyInstance) {
  const pending = new Set<Promise<void>>();
  pendingRoutes.set(page, pending);
  await page.route("**/api/**", async (route) => {
    const operation = (async () => {
      const request = route.request(),
        url = new URL(request.url());
      const response = await app.inject({
        method: request.method() as "GET" | "POST" | "DELETE",
        url: url.pathname + url.search,
        headers: request.headers(),
        ...(request.postDataBuffer()
          ? { payload: request.postDataBuffer()! }
          : {}),
      });
      await route.fulfill({
        status: response.statusCode,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(",") : String(v),
          ]),
        ),
        body: response.rawPayload,
      });
    })();
    pending.add(operation);
    try {
      await operation;
    } finally {
      pending.delete(operation);
    }
  });
}
