/** Structural boundary for untrusted API inputs. This is a defense-in-depth
 * layer; each route must still parse its payload with a field-level schema. */
export class InvalidApiInput extends Error {
  readonly statusCode = 400;
  constructor() { super("ساختار یا نوع ورودی معتبر نیست"); }
}

const BAD_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_DEPTH = 12;
const MAX_ARRAY = 1000;
const MAX_KEYS = 100;
const MAX_KEY_LENGTH = 100;
const MAX_STRING_LENGTH = 16000;
const MAX_NODES = 5000;

export function assertSafeApiInput(value: unknown): void {
  let nodes = 0;
  const seen = new WeakSet<object>();
  function walk(input: unknown, depth: number): void {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new InvalidApiInput();
    if (input === null || typeof input === "boolean") return;
    if (typeof input === "number") {
      if (!Number.isFinite(input)) throw new InvalidApiInput();
      return;
    }
    if (typeof input === "string") {
      if (input.length > MAX_STRING_LENGTH) throw new InvalidApiInput();
      return;
    }
    if (typeof input !== "object") throw new InvalidApiInput();
    if (seen.has(input)) throw new InvalidApiInput();
    seen.add(input);
    if (Array.isArray(input)) {
      if (input.length > MAX_ARRAY) throw new InvalidApiInput();
      for (const element of input) walk(element, depth + 1);
      return;
    }
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) throw new InvalidApiInput();
    const keys = Object.keys(input);
    if (keys.length > MAX_KEYS) throw new InvalidApiInput();
    for (const key of keys) {
      // MongoDB operators and dotted selectors must be authored by the server,
      // never accepted as user-supplied object keys.
      if (!key || key.length > MAX_KEY_LENGTH || key.startsWith("$") || key.includes(".") || BAD_KEYS.has(key))
        throw new InvalidApiInput();
      walk((input as Record<string, unknown>)[key], depth + 1);
    }
  }
  walk(value, 0);
}

/** Explicit allowlist for query parameters: none unless a route opts in. */
export function assertAllowedQuery(
  query: unknown,
  allowed: readonly string[] = [],
): void {
  assertSafeApiInput(query);
  if (query === null || typeof query !== "object" || Array.isArray(query))
    throw new InvalidApiInput();
  const q = query as Record<string, unknown>;
  for (const [key, value] of Object.entries(q)) {
    if (!allowed.includes(key) || typeof value !== "string" || value.length > 128)
      throw new InvalidApiInput();
  }
}
