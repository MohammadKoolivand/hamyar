// Keep a mutation's key across a lost response, page reload or explicit retry.
// Only a digest and random key are stored; never store passwords or answers here.
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const protectedMutation =
    body !== undefined &&
    (path === "/questions" ||
      path === "/question-drafts/generate" ||
      /\/question-drafts\/[^/]+\/(approve|reject)$/.test(path) ||
      /\/assignments\/[^/]+\/(attempts|hints|complete)$/.test(path) ||
      /\/evaluations\/[^/]+\/review$/.test(path) ||
      /\/missions\/[^/]+\/(publish|cancel)$/.test(path) ||
      /\/students\/[^/]+\/remediation-missions$/.test(path) ||
      /\/students\/[^/]+\/mastery\/[^/]+\/override$/.test(path));
  let storageKey: string | undefined, key: string | undefined;
  if (protectedMutation) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(path + JSON.stringify(body)),
    );
    storageKey =
      "mutation:" +
      Array.from(new Uint8Array(digest))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
    key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
  });
  const data = await response.json();
  // Definitive rejection is safe to amend/retry as a new intent; ambiguous 5xx retains its key.
  if (
    storageKey &&
    ((response.ok && !/\/(attempts|hints)$/.test(path)) ||
      (response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429))
  )
    sessionStorage.removeItem(storageKey);
  if (!response.ok)
    throw new Error(data.message ?? "ارتباط با سرور برقرار نشد");
  return data;
}
