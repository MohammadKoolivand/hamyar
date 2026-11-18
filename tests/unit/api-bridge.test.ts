import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { forwardApiRequest } from "../../src/server/api-bridge";
import { PDF_LIBRARY_UPLOAD_CHUNK_BYTES } from "../../src/lib/pdf-library";

const pdfId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";
const url = `http://localhost:5174/api/pdf-library/${pdfId}/chunks/${uploadId}/0`;

test("Next API bridge accepts 512 KiB PDF chunks and preserves exact octets", async () => {
  const app = Fastify();
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: PDF_LIBRARY_UPLOAD_CHUNK_BYTES }, (_request, bytes, done) => done(null, bytes));
  app.post("/api/pdf-library/:pid/chunks/:uploadId/:position", { bodyLimit: PDF_LIBRARY_UPLOAD_CHUNK_BYTES }, async (request) => {
    const data = request.body as Buffer;
    return { accepted: data.length, signature: data.subarray(0, 4).toString("hex") };
  });
  try {
    const chunk = new Uint8Array(PDF_LIBRARY_UPLOAD_CHUNK_BYTES);
    chunk.set([0x25, 0x50, 0x44, 0x46]);
    const result = await forwardApiRequest(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: chunk,
    }), app);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { accepted: chunk.length, signature: "25504446" });
  } finally {
    await app.close();
  }
});

test("Next API bridge rejects oversized chunks with 413 before Fastify", async () => {
  const app = Fastify();
  let calls = 0;
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_r, body, done) => done(null, body));
  app.post("/api/pdf-library/:pid/chunks/:uploadId/:position", async () => {
    calls++;
    return { ok: true };
  });
  try {
    const result = await forwardApiRequest(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array(PDF_LIBRARY_UPLOAD_CHUNK_BYTES + 1),
    }), app);
    assert.equal(result.status, 413);
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});

test("Next API bridge retains 64 KiB limit on ordinary requests", async () => {
  const app = Fastify();
  let calls = 0;
  app.post("/api/test", async () => {
    calls++;
    return { ok: true };
  });
  try {
    const response = await forwardApiRequest(new Request("http://localhost:5174/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(65536) }),
    }), app);
    assert.equal(response.status, 413);
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});

test("Next API bridge forwards raw-review JSON larger than 64 KiB", async () => {
  const app = Fastify({ bodyLimit: 65536 });
  app.post("/api/admin/exam-imports/raw-review", { bodyLimit: 12 * 1024 * 1024 }, async (request) => {
    const input = request.body as { data: string };
    return { accepted: input.data.length };
  });
  try {
    const data = "x".repeat(90 * 1024);
    const response = await forwardApiRequest(new Request(
      "http://localhost:5174/api/admin/exam-imports/raw-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data }),
      }), app);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: data.length });
  } finally {
    await app.close();
  }
});

test("Next API bridge keeps raw-review payloads limited to 12 MiB", async () => {
  const app = Fastify();
  let calls = 0;
  app.post("/api/admin/exam-imports/raw-review", async () => {
    calls++;
    return { ok: true };
  });
  try {
    const response = await forwardApiRequest(new Request(
      "http://localhost:5174/api/admin/exam-imports/raw-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: "x".repeat(12 * 1024 * 1024) }),
      }), app);
    assert.equal(response.status, 413);
    assert.equal(calls, 0);
  } finally {
    await app.close();
  }
});
