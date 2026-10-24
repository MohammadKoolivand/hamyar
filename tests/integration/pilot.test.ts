import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
test("pilot single-process authenticated rate cap is enforced without writes or private errors", async () => {
  const f = await fixture();
  try {
    const count = await f.c("attempts").countDocuments();
    const responses = await Promise.all(
      Array.from({ length: 125 }, () =>
        f.request("/api/auth/me", undefined, f.student),
      ),
    );
    assert.ok(responses.some((r) => r.statusCode === 429));
    assert.ok(responses.every((r) => [200, 429].includes(r.statusCode)));
    assert.equal(await f.c("attempts").countDocuments(), count);
    const limited = responses.find((r) => r.statusCode === 429)!;
    assert.ok(limited.headers["retry-after"]);
    assert.ok(
      !/passwordHash|tokenHash|StrongPass123/.test(
        responses.map((r) => r.body).join(""),
      ),
    );
  } finally {
    await f.close();
  }
});
