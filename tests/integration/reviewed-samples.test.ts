import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { createContext } from "../../src/server/context";
import {
  importReviewedSamples,
  type ReviewedSample,
} from "../../src/server/imports/reviewed-samples";
import { questionSourceSchema } from "../../src/lib/question-source";

test("reviewed source import is additive, atomic, private, dry by default and repeat safe", async () => {
  const f = await fixture();
  try {
    const teacher = (await f.c("users").findOne({ email: "t@test.dev" }))!;
    const student = (await f.c("users").findOne({ email: "s@test.dev" }))!;
    const ctx = createContext(f.db);
    const entry: ReviewedSample = {
      key: "verified-fixture-q4",
      question: {
        classification: "free",
        statement: "مقدار پنج را بنویسید",
        type: "numeric",
        reference: "5",
        options: [],
        hints: [],
        skillIds: [],
        tolerance: 0,
        source: {
          family: "school",
          administration: "final",
          examDate: "1405/06/17",
          publishedDate: "2026-09-19",
          sourcePage: 1,
          sourcePageUrl: "https://konkur.in/125901/test.html",
          sourceUrl: "https://dl.konkur.in/test.pdf",
        },
      },
      evidence: {
        sourceSha256: "a".repeat(64),
        answerBasis: "published_key",
        answerPage: 3,
        note: "Fixture document and answer, never a real bank sample",
      },
      image: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=",
        "base64",
      ),
    };
    const count = await f.c("questions").countDocuments();
    assert.equal(
      (await importReviewedSamples(ctx, teacher._id, [entry]))[0].status,
      "ready",
    );
    assert.equal(await f.c("questions").countDocuments(), count);
    assert.equal(await f.c("questionAssets").countDocuments(), 0);
    await assert.rejects(
      importReviewedSamples(ctx, student._id, [entry], true),
      /existing teacher/,
    );
    const result = await importReviewedSamples(ctx, teacher._id, [entry], true);
    assert.equal(result[0].status, "imported");
    assert.equal(
      (await importReviewedSamples(ctx, teacher._id, [entry], true))[0].status,
      "existing",
    );
    assert.equal(await f.c("questions").countDocuments(), count + 1);
    assert.equal(await f.c("questionAssets").countDocuments(), 1);
    await assert.rejects(
      importReviewedSamples(
        ctx,
        teacher._id,
        [{ ...entry, question: { ...entry.question, reference: "6" } }],
        true,
      ),
      /has changed/,
    );
    const asset = (await f
      .c("questionAssets")
      .findOne({ ownerId: teacher._id }))!;
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${asset._id}`,
          undefined,
          f.student,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.request(
          `/api/question-assets/${asset._id}`,
          undefined,
          f.teacher,
        )
      ).statusCode,
      200,
    );
    const failure = createContext(f.db, {
      boundary: async (name) => {
        if (name === "after_question_version_insert")
          throw new Error("rollback fixture");
      },
    });
    await assert.rejects(
      importReviewedSamples(
        failure,
        teacher._id,
        [{ ...entry, key: "rollback-fixture-q4" }],
        true,
      ),
      /rollback fixture/,
    );
    assert.equal(await f.c("questions").countDocuments(), count + 1);
    assert.equal(await f.c("questionAssets").countDocuments(), 1);
    assert.equal(
      await f
        .c("auditLogs")
        .countDocuments({ action: "authorized-source-sample-import" }),
      1,
    );
  } finally {
    await f.close();
  }
});

test("source publication and exam dates remain distinct and validated", () => {
  const source = {
    family: "mock",
    examDate: "1405/08/01",
    publishedDate: "2026-10-23",
  };
  assert.ok(questionSourceSchema.safeParse(source).success);
  assert.ok(
    !questionSourceSchema.safeParse({ ...source, examDate: "2026-10-23" })
      .success,
  );
  assert.ok(
    !questionSourceSchema.safeParse({ ...source, publishedDate: "1405/08/01" })
      .success,
  );
  assert.ok(
    !questionSourceSchema.safeParse({
      ...source,
      sourcePageUrl: "javascript:alert(1)",
    }).success,
  );
});
