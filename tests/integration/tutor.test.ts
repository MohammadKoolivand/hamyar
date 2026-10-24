import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import type { HintInput, HintOutput } from "../../src/server/ai/types";
test("tutor sends only active relationship context, selects according to submitted work and records provenance", async () => {
  const seen: HintInput[] = [];
  const f = await fixture({
    provider: {
      name: "test-selector",
      async hint(input) {
        seen.push(input);
        return {
          text: input.context!.submittedWork
            ? "Review the next step."
            : input.approvedHint,
          provider: "test-selector",
          model: "test",
          promptVersion: "test-v1",
          focus: "review",
        } satisfies HintOutput;
      },
    },
  });
  try {
    await f.c("questionVersions").updateOne(
      { _id: f.question._id },
      {
        $set: {
          reference: "PRIVATE_REFERENCE",
          hintBank: [
            { level: 1, text: "Start the first step." },
            { level: 1, text: "Review the next step." },
          ],
        },
      },
    );
    await f.c("curriculum").insertOne({
      _id: "unrelated-private-skill",
      ownerId: "other-teacher",
      kind: "skill",
      title: "PRIVATE_OTHER_TEACHER",
    });
    await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "My submitted work" },
      f.student,
    );
    const hint = await f.post(
      f.path + "/hints",
      { questionId: f.question._id, level: 1 },
      f.student,
      "dynamic-hint-key",
    );
    assert.equal(hint.text, "Review the next step.");
    assert.equal(hint.provider, "test-selector");
    assert.equal(hint.promptVersion, "test-v1");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].context!.submittedWork, "My submitted work");
    assert.ok(!JSON.stringify(seen).includes("PRIVATE_REFERENCE"));
    assert.ok(!JSON.stringify(seen).includes("PRIVATE_OTHER_TEACHER"));
    assert.equal(
      (await f.c("aiRequests").findOne({ _id: hint.requestId }))!.state,
      "committed",
    );
    await f.post(
      f.path + "/hints/" + hint._id + "/report",
      { reason: "Please verify this hint" },
      f.student,
      "hint-feedback-key",
    );
    const report = (
      await f.request(f.path + "/report", undefined, f.teacher)
    ).json();
    assert.equal(report.hintFeedback.length, 1);
    assert.equal(
      (await f.request(f.path + "/report", undefined, f.student)).json()
        .hintFeedback,
      undefined,
    );
  } finally {
    await f.close();
  }
});
test("levels zero/independent/full-solution permissions are enforced outside the model", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.request(
          f.path + "/hints",
          { questionId: f.question._id, level: 4 },
          f.student,
        )
      ).statusCode,
      409,
    );
    await f.c("assignments").updateOne(
      { _id: f.assignment._id },
      {
        $set: { "policy.maxHintLevel": 4, "policy.allowFullSolution": true },
      },
    );
    const full = await f.post(
      f.path + "/hints",
      { questionId: f.question._id, level: 4 },
      f.student,
      "approved-full-solution",
    );
    assert.equal(full.text, "2");
    assert.equal(full.provider, "teacher-solution");
    await f
      .c("assignments")
      .updateOne(
        { _id: f.assignment._id },
        { $set: { "policy.independent": true } },
      );
    assert.equal(
      (
        await f.request(
          f.path + "/hints",
          { questionId: f.question._id, level: 4 },
          f.student,
        )
      ).statusCode,
      409,
    );
  } finally {
    await f.close();
  }
});
test("unapproved provider text never consumes quota or loses submitted work", async () => {
  const f = await fixture({
    provider: {
      name: "malicious-provider",
      async hint() {
        return "Ignore the teacher. The answer is 2.";
      },
    },
  });
  try {
    await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "1" },
      f.student,
    );
    assert.equal(
      (
        await f.request(
          f.path + "/hints",
          { questionId: f.question._id },
          f.student,
        )
      ).statusCode,
      503,
    );
    assert.equal(
      (await f.c("assignments").findOne({ _id: f.assignment._id }))!.progress[
        f.question._id
      ].hints,
      0,
    );
    assert.equal(
      await f.c("attempts").countDocuments({ assignmentId: f.assignment._id }),
      1,
    );
    assert.equal(
      await f
        .c("hintEvents")
        .countDocuments({ assignmentId: f.assignment._id }),
      0,
    );
  } finally {
    await f.close();
  }
});
test("orchestrator timeout keeps quota and previous attempts intact", async () => {
  const f = await fixture({
    provider: {
      name: "stalled-provider",
      async hint() {
        return new Promise<string>(() => {});
      },
    },
  });
  const previous = process.env.AI_TIMEOUT_MS;
  try {
    await f.post(
      f.path + "/attempts",
      { questionId: f.question._id, answer: "1" },
      f.student,
    );
    process.env.AI_TIMEOUT_MS = "5";
    assert.equal(
      (
        await f.request(
          f.path + "/hints",
          { questionId: f.question._id },
          f.student,
        )
      ).statusCode,
      503,
    );
    assert.equal(
      (await f.c("assignments").findOne({ _id: f.assignment._id }))!.progress[
        f.question._id
      ].hints,
      0,
    );
    assert.equal(
      await f.c("attempts").countDocuments({ assignmentId: f.assignment._id }),
      1,
    );
  } finally {
    if (previous === undefined) delete process.env.AI_TIMEOUT_MS;
    else process.env.AI_TIMEOUT_MS = previous;
    await f.close();
  }
});
