import assert from "node:assert/strict";
import { test } from "node:test";
import { assertAllowedQuery, assertSafeApiInput } from "../../src/server/security/input-validation.ts";

const invalid = (input) => assert.throws(() => assertSafeApiInput(input), /ساختار یا نوع ورودی/);

test("MongoDB operators cannot pass as query or JSON body fields", () => {
  for (const key of ["$ne", "$gt", "$where", "$regex", "$expr", "$or", "profile.role", "__proto__", "constructor", "prototype"]) {
    invalid(JSON.parse(`{"${key}": "admin"}`));
    invalid({ filter: JSON.parse(`{"${key}": true}`) });
  }
});

test("malformed and unexpected data structures are rejected", () => {
  invalid({ limit: Number.POSITIVE_INFINITY });
  invalid({ items: new Array(1001).fill(1) });
  invalid({ text: "x".repeat(16001) });
  invalid({ nested: [undefined] });
  invalid({ circular: (() => { const a = {}; a.self = a; return a; })() });
  let deep = { field: "ok" };
  for (let i = 0; i < 14; i++) deep = { child: deep };
  invalid(deep);
});

test("query allowlist rejects unknown params, arrays and injection", () => {
  assert.doesNotThrow(() => assertAllowedQuery({ courseId: "00000000-0000-4000-8000-000000000000" }, ["courseId"]));
  assert.throws(() => assertAllowedQuery({ courseId: { $ne: null } }, ["courseId"]));
  assert.throws(() => assertAllowedQuery({ courseId: ["a", "b"] }, ["courseId"]));
  assert.throws(() => assertAllowedQuery({ sort: "role" }, ["courseId"]));
  assert.throws(() => assertAllowedQuery({ unexpected: "true" }));
  assert.throws(() => assertAllowedQuery({ courseId: "a".repeat(129) }, ["courseId"]));
});

test("legitimate nested answers, metadata and empty query are accepted", () => {
  assert.doesNotThrow(() => assertSafeApiInput({ questionId: "abc", answer: "x", metadata: { level: 2, tags: ["a", "b"] } }));
  assert.doesNotThrow(() => assertAllowedQuery({}));
});
