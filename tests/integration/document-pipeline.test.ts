import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import { runNextExamJob } from "../../src/server/imports/jobs";

test("durable local PDF jobs match actual key numbers, preserve images on publish and delete source safely", async () => {
  const f = await fixture();
  try {
    const exam = await f.post(
      "/api/exam-imports",
      {
        title: "آزمون فارسی محلی",
        subject: "ریاضی",
        source: { family: "mock" },
      },
      f.teacher,
    );
    const path = `/api/exam-imports/${exam._id}`;
    async function upload(kind: string, file: string, cookie = f.teacher) {
      return f.app.inject({
        method: "POST",
        url: `${path}/files/${kind}`,
        headers: {
          cookie,
          "content-type": "application/pdf",
          "x-file-name": file,
        },
        payload: await readFile(`tests/fixtures/exams/${file}`),
      });
    }
    assert.equal(
      (await upload("question", "text-fa.pdf", f.student)).statusCode,
      403,
    );
    assert.equal((await upload("question", "text-fa.pdf")).statusCode, 200);
    assert.equal((await upload("answer", "key-table.pdf")).statusCode, 200);
    await f.post("/api/auth/register", {
      name: "Other teacher",
      email: "other-doc@test.dev",
      password: "StrongPass123!",
    });
    const login = await f.request("/api/auth/login", {
      email: "other-doc@test.dev",
      password: "StrongPass123!",
    });
    const other = "session=" + login.cookies[0].value;
    assert.equal((await f.request(path, undefined, other)).statusCode, 404);
    const job = await f.post(path + "/extract", {}, f.teacher);
    assert.equal(job.state, "queued");
    const repeat = await f.post(path + "/extract", {}, f.teacher);
    assert.equal(repeat._id, job._id);
    // Simulates process death after claim: persisted lease is recovered by a fresh worker context.
    await f.c("examImportJobs").updateOne(
      { _id: job._id },
      {
        $set: {
          state: "running",
          attempts: 1,
          leaseToken: "dead-process",
          leaseUntil: new Date(0),
        },
      },
    );
    await runNextExamJob(createContext(f.db));
    const detail = (await f.request(path, undefined, f.teacher)).json();
    assert.equal(detail.state, "review", JSON.stringify(detail.job));
    assert.equal(detail.job.attempts, 2);
    assert.equal(detail.items.length, 2);
    assert.deepEqual(
      detail.items.map((i: { originalNumber: number }) => i.originalNumber),
      [12, 19],
    );
    assert.equal(
      detail.statistics.matched,
      2,
      JSON.stringify(
        detail.items.map((i: { question: unknown; extraction: unknown }) => ({
          question: i.question,
          extraction: i.extraction,
        })),
      ),
    );
    assert.equal(detail.items[0].question.options.length, 4);
    assert.equal(detail.items[0].question.reference, "پنج");
    assert.equal(
      (await f.request(`${path}/pages/question/1`, undefined, other))
        .statusCode,
      404,
    );
    const first = detail.items[0];
    const sourceRoute = `${path}/items/${first._id}/source-image`;
    assert.equal(
      (await f.request(sourceRoute, { page: 1 }, other)).statusCode,
      404,
    );
    assert.equal(
      (await f.request(sourceRoute, { page: 1 }, f.student)).statusCode,
      403,
    );
    assert.equal(
      (await f.request(sourceRoute, { page: 100 }, f.teacher)).statusCode,
      404,
    );
    assert.equal(
      (await f.request(sourceRoute, { page: 0 }, f.teacher)).statusCode,
      400,
    );
    assert.ok(detail.sourcePages.some((p: { page: number }) => p.page === 1));
    const sourceImage = await f.post(sourceRoute, { page: 1 }, f.teacher);
    assert.equal(sourceImage.kind, "image");
    assert.equal(
      (await f.post(sourceRoute, { page: 1 }, f.teacher)).assetId,
      sourceImage.assetId,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${sourceImage.assetId}`,
          undefined,
          other,
        )
      ).statusCode,
      404,
    );
    const corrected = {
      ...first.question,
      visuals: [
        { ...sourceImage, crop: { x: 5, y: 5, width: 90, height: 40 } },
      ],
    };
    await f.post(
      `${path}/items/${first._id}/review`,
      { action: "save", question: corrected },
      f.teacher,
    );
    const saved = (await f.request(path, undefined, f.teacher))
      .json()
      .items.find((i: { _id: string }) => i._id === first._id);
    assert.deepEqual(saved.question.visuals[0].crop, corrected.visuals[0].crop);
    assert.equal(saved.question.statement, first.question.statement);
    const assetId = sourceImage.assetId;
    assert.equal(
      (await f.request(`/api/question-assets/${assetId}`, undefined, f.student))
        .statusCode,
      404,
    );
    assert.equal(
      (await f.request(`/api/question-assets/${assetId}`, undefined, f.teacher))
        .statusCode,
      200,
    );
    const batch = await f.post(
      path + "/approve-batch",
      {
        itemIds: detail.items.map((i: { _id: string }) => i._id),
        confirmed: true,
      },
      f.teacher,
    );
    assert.equal(batch.approved.length, 2, JSON.stringify(batch));
    assert.equal(batch.failed.length, 0);
    const replay = await f.post(
      path + "/approve-batch",
      {
        itemIds: detail.items.map((i: { _id: string }) => i._id),
        confirmed: true,
      },
      f.teacher,
    );
    assert.equal(replay.approved.length, 2);
    assert.equal(
      await f.c("questionVersions").countDocuments({ sourceExamId: exam._id }),
      2,
    );
    const del = await f.app.inject({
      method: "DELETE",
      url: path + "/files",
      headers: { cookie: f.teacher },
    });
    assert.equal(del.statusCode, 200);
    assert.equal(
      (await f.request(`${path}/pages/question/1`, undefined, f.teacher))
        .statusCode,
      404,
    );
    assert.equal(
      (await f.request(`/api/question-assets/${assetId}`, undefined, f.teacher))
        .statusCode,
      200,
    );
    assert.equal(
      await f.c("questionVersions").countDocuments({ sourceExamId: exam._id }),
      2,
    );
  } finally {
    await f.close();
  }
});

test("scanned and mixed Persian PDFs really run OCR; formulas and image keys remain human-reviewed", async () => {
  const f = await fixture();
  try {
    for (const file of ["scan-fa.pdf", "mixed-fa.pdf", "science.pdf"]) {
      const exam = await f.post(
        "/api/exam-imports",
        {
          title: `آزمون ${file}`,
          subject: "ریاضی",
          source: { family: "practice" },
        },
        f.teacher,
      );
      const root = `/api/exam-imports/${exam._id}`;
      assert.equal(
        (
          await f.app.inject({
            method: "POST",
            url: root + "/files/question",
            headers: {
              cookie: f.teacher,
              "content-type": "application/pdf",
              "x-file-name": file,
            },
            payload: await readFile(`tests/fixtures/exams/${file}`),
          })
        ).statusCode,
        200,
      );
      if (file === "scan-fa.pdf")
        await f.app.inject({
          method: "POST",
          url: root + "/files/answer",
          headers: {
            cookie: f.teacher,
            "content-type": "application/pdf",
            "x-file-name": "key-image.pdf",
          },
          payload: await readFile("tests/fixtures/exams/key-image.pdf"),
        });
      await f.post(root + "/extract", {}, f.teacher);
      await runNextExamJob(createContext(f.db));
      const detail = (await f.request(root, undefined, f.teacher)).json();
      assert.equal(detail.state, "review", JSON.stringify(detail.job));
      assert.ok(detail.items.length > 0);
      if (file === "scan-fa.pdf")
        assert.deepEqual(
          detail.items.map((i: { originalNumber: number }) => i.originalNumber),
          [12, 19],
        );
      assert.ok(
        detail.items.every((i: { state: string }) => i.state === "pending"),
      );
      if (file === "scan-fa.pdf")
        assert.ok(
          detail.items.some(
            (i: { extraction: { method: string } }) =>
              i.extraction.method === "ocr",
          ),
        );
      if (file === "mixed-fa.pdf")
        assert.ok(
          detail.items.some(
            (i: { extraction: { method: string } }) =>
              i.extraction.method === "hybrid" || i.extraction.method === "ocr",
          ),
        );
      assert.equal(
        await f
          .c("questionVersions")
          .countDocuments({ sourceExamId: exam._id }),
        0,
      );
    }
  } finally {
    await f.close();
  }
});
