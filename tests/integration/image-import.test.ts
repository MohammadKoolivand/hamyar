import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixture } from "../helpers/fixture";

test("raster exam upload normalizes to private PDF and rejects corrupt images and unauthorized users", async () => {
  const f = await fixture();
  try {
    const exam = await f.post(
      "/api/exam-imports",
      {
        title: "اسکن مأموریت",
        subject: "ریاضی",
        source: { family: "practice", practice: "teacher" },
      },
      f.teacher,
    );
    const image = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const upload = (data: Buffer, cookie = f.teacher) =>
      f.app.inject({
        method: "POST",
        url: `/api/exam-imports/${exam._id}/files/question`,
        headers: {
          cookie,
          "content-type": "image/png",
          "x-file-name": "scan.png",
        },
        payload: data,
      });
    assert.equal((await upload(image, f.student)).statusCode, 403);
    assert.equal((await upload(Buffer.from("bad image"))).statusCode, 400);
    const oversized = await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    assert.equal((await upload(oversized)).statusCode, 400);
    const tooLarge = await f.app.inject({
      method: "POST",
      url: `/api/exam-imports/${exam._id}/files/question`,
      headers: {
        cookie: f.teacher,
        "content-type": "application/pdf",
        "x-file-name": "large.pdf",
      },
      payload: Buffer.alloc(20 * 1024 * 1024 + 1),
    });
    assert.equal(tooLarge.statusCode, 413);
    const result = await upload(image);
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().name, "scan.pdf");
    for (const [extension, mime, bytes] of [
      ["jpg", "image/jpeg", await sharp(image).jpeg().toBuffer()],
      ["webp", "image/webp", await sharp(image).webp().toBuffer()],
    ] as const) {
      const uploaded = await f.app.inject({
        method: "POST",
        url: `/api/exam-imports/${exam._id}/files/question`,
        headers: {
          cookie: f.teacher,
          "content-type": mime,
          "x-file-name": `scan.${extension}`,
        },
        payload: bytes,
      });
      assert.equal(uploaded.statusCode, 200, uploaded.body);
      assert.equal(uploaded.json().name, "scan.pdf");
    }

    const download = await f.app.inject({
      method: "GET",
      url: `/api/exam-imports/${exam._id}/files/question`,
      headers: { cookie: f.teacher },
    });
    assert.equal(download.statusCode, 200);
    assert.equal(download.rawPayload.subarray(0, 5).toString(), "%PDF-");
    assert.match(String(download.headers["cache-control"]), /no-store/);
    // PDF.js must read the generated container and its embedded raster.
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({
      data: new Uint8Array(download.rawPayload),
      useSystemFonts: true,
    });
    const document = await loading.promise;
    assert.equal(document.numPages, 1);
    const page = await document.getPage(1);
    assert.deepEqual(page.view, [0, 0, 595, 842]);
    assert.ok((await page.getOperatorList()).fnArray.length > 0);
    await loading.destroy();
  } finally {
    await f.close();
  }
});
